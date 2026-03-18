import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { MonthCalendarPicker } from "@/components/ui/month-calendar-picker";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Clock,
  Send,
  Save,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  FolderOpen,
  Pencil,
  Download,
  FileSpreadsheet,
  FileText,
  File,
} from "lucide-react";
import { toast } from "sonner";
import { timesheetService, Timesheet, TimesheetEntry, DayStatus } from "@/services/timesheet";
import { getErrorMessage } from "@/lib/api";
import { getDaysInMonth, toDateKey, statusRowBg, statusBadgeClass, tableTh, tableTd, tableThTotal } from "@/lib/utils";
import {
  buildExportRows,
  exportToXLSX,
  exportToCSV,
  exportToPDF,
  ExportFormat,
} from "@/lib/timesheetExport";

// ── Constants ──────────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STATUS_OPTIONS: DayStatus[] = ["Working", "On leave", "Holiday", "Extra Working"];
const WEEKEND_STATUS_OPTIONS: DayStatus[] = ["Holiday", "Extra Working"];

const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const CURRENT_MONTH = NOW.getMonth(); // 0-indexed

// ── Types ──────────────────────────────────────────────────────────────────────

type CellEntry = {
  _id?: string;
  status: DayStatus;
  tasks: string;
  worked_hours: number;
  billable_hours: number;
  actual_hours: number;
  completed_task: boolean;
  completed_task_description: string;
  unplanned_task: boolean;
  comments: string;
  saved?: boolean;
};

type CellsMap = Record<string, CellEntry>; // keyed by "YYYY-MM-DD"

function defaultStatus(d: Date): DayStatus {
  const day = d.getDay();
  // Saturday (6) and Sunday (0) default to Holiday
  if (day === 0 || day === 6) return "Holiday";
  return "Working";
}

function getStatusOptionsForDay(d: Date): DayStatus[] {
  const day = d.getDay();
  if (day === 0 || day === 6) return WEEKEND_STATUS_OPTIONS; // Sat & Sun: Holiday or Extra Working
  return STATUS_OPTIONS;                                      // Weekdays: all options
}

function defaultBillable(_status: DayStatus): number {
  return 0;
}

function emptyCell(d?: Date): CellEntry {
  const st = d ? defaultStatus(d) : "Working";
  return {
    status: st,
    tasks: "",
    worked_hours: defaultBillable(st),
    billable_hours: defaultBillable(st),
    actual_hours: 0,
    completed_task: false,
    completed_task_description: "",
    unplanned_task: false,
    comments: "",
    saved: false,
  };
}

function buildCellsFromEntries(entries: TimesheetEntry[], days: Date[]): CellsMap {
  const map: CellsMap = {};

  // First seed all days with defaults
  for (const d of days) {
    const key = toDateKey(d);
    map[key] = emptyCell(d);
  }

  // Then overlay saved entries
  for (const e of entries) {
    const key = e.date?.slice(0, 10);
    if (!key || !map[key]) continue;

    const tasks = Array.isArray(e.tasks) ? e.tasks.filter(Boolean) : [];
    const hasContent = tasks.length > 0 || (e.billable_hours ?? 0) > 0 || (e.worked_hours ?? 0) > 0;

    // For weekends: if the saved entry is "Working" but has no actual content,
    // apply the "Holiday" default (fixes legacy data saved before weekend auto-default)
    const d = new Date(e.date);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    let status = e.status || map[key].status;
    if (isWeekend && status === "Working" && !hasContent) {
      status = "Holiday";
    }

    map[key] = {
      _id: e._id,
      status,
      tasks: tasks.join("\n"),
      worked_hours: e.worked_hours ?? 0,
      billable_hours: e.billable_hours ?? 0,
      actual_hours: e.actual_hours ?? 0,
      completed_task: e.completed_task ?? false,
      completed_task_description: e.completed_task_description ?? "",
      unplanned_task: e.unplanned_task ?? false,
      comments: e.comments ?? "",
      saved: true,
    };
  }
  return map;
}

function isToday(d: Date) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate();
}

// ── Isolated cell components (prevent parent re-render on every keystroke) ─────

const TaskCell = memo(function TaskCell({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  // Sync if parent value changes (e.g. undo/redo)
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <textarea
      value={local}
      placeholder="Enter task description..."
      rows={local ? Math.max(1, local.split("\n").length) : 1}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onCommit(local); }}
      className="w-full border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 rounded-sm outline-none px-1 py-0.5 text-xs resize-none placeholder:text-gray-300"
    />
  );
});

const BillableCell = memo(function BillableCell({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (v: number) => void;
}) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  return (
    <input
      type="number"
      min={0}
      max={24}
      step={0.5}
      value={local}
      onChange={(e) => {
        const raw = e.target.value;
        // Allow empty for typing, but clamp any parsed value to 0–24
        if (raw === "" || raw === ".") { setLocal(raw); return; }
        const v = parseFloat(raw);
        if (isNaN(v)) return;
        if (v > 24) { setLocal("24"); return; }
        if (v < 0) { setLocal("0"); return; }
        setLocal(raw);
      }}
      onBlur={() => {
        const v = parseFloat(local);
        const next = isNaN(v) ? 0 : Math.min(Math.max(v, 0), 24);
        setLocal(String(next));
        if (next !== value) onCommit(next);
      }}
      className="w-16 text-center font-mono font-semibold bg-transparent border-0 focus:bg-white focus:ring-1 focus:ring-blue-400 rounded-sm outline-none px-1 py-0.5 text-xs"
    />
  );
});

// ── MonthYearPicker ─────────────────────────────────────────────────────────────
// Thin wrapper: EmployeeTimesheetPage uses 0-indexed months (0=Jan, 11=Dec).
// MonthCalendarPicker also uses 0-indexed, so pass through directly.

function MonthYearPicker({
  month, year, disabled, onChange,
}: {
  month: number; year: number; disabled?: boolean;
  onChange: (month: number, year: number) => void;
}) {
  return (
    <MonthCalendarPicker
      month={month}
      year={year}
      disabled={disabled}
      onChange={onChange}
      maxYear={CURRENT_YEAR + 1}
      align="right"
    />
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function EmployeeTimesheetPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectName = searchParams.get("projectName") ?? "Timesheet";
  const projectId = searchParams.get("projectId") ?? null;

  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);

  // Submit confirmation
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);

  // Export dialog
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("xlsx");
  const [exportFromDate, setExportFromDate] = useState("");
  const [exportToDate, setExportToDate] = useState("");

  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [cells, setCells] = useState<CellsMap>({});
  const cellsRef = useRef<CellsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const days = getDaysInMonth(selectedYear, selectedMonth);

  // ── Load timesheet ─────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const apiMonth = selectedMonth + 1;
        const res = await timesheetService.getOwn(apiMonth, selectedYear, projectId);
        if (cancelled) return;
        setTimesheet(res.data);
        const loaded = buildCellsFromEntries(
          res.data?.entries ?? [],
          getDaysInMonth(selectedYear, selectedMonth)
        );
        cellsRef.current = loaded;
        setCells(loaded);
      } catch (err) {
        if (cancelled) return;
        const msg = getErrorMessage(err, "");
        if (msg && !msg.includes("404")) toast.error(msg || "Failed to load timesheet");
        setTimesheet(null);
        const fresh = buildCellsFromEntries([], getDaysInMonth(selectedYear, selectedMonth));
        cellsRef.current = fresh;
        setCells(fresh);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedMonth, selectedYear, projectId]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const status = timesheet?.status ?? "draft";
  const isLocked = status === "submitted" || status === "approved" || status === "rejected";

  const workingEntries = Object.entries(cells).filter(
    ([, c]) => c.status === "Working" || c.status === "Extra Working"
  );
  const totalBillable = Object.values(cells).reduce((s, c) => s + c.billable_hours, 0);
  const totalWorked = workingEntries.reduce((s, [, c]) => s + c.worked_hours, 0);

  // ── Cell mutators ─────────────────────────────────────────────────────────

  function getCell(dateKey: string): CellEntry {
    return cells[dateKey] ?? emptyCell();
  }

  const patchCell = useCallback(function patchCell(dateKey: string, patch: Partial<CellEntry>) {
    setCells((prev) => {
      const existing = prev[dateKey] ?? emptyCell();
      const updated = { ...existing, ...patch };

      // Auto-adjust when status changes
      if (patch.status && patch.status !== existing.status) {
        if (patch.status === "Holiday" || patch.status === "On leave") {
          // Clear billable hours and tasks for non-working statuses
          updated.billable_hours = 0;
          updated.worked_hours = 0;
          updated.tasks = "";
        } else {
          const newBillable = defaultBillable(patch.status);
          updated.billable_hours = newBillable;
          updated.worked_hours = newBillable;
        }
      }

      const next = { ...prev, [dateKey]: updated };
      cellsRef.current = next;
      return next;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRecall() {
    if (!timesheet) return;
    setSaving(true);
    try {
      const res = await timesheetService.recall(timesheet._id);
      setTimesheet(res.data);
      toast.success("Timesheet reopened for editing.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to recall timesheet"));
    } finally {
      setSaving(false);
    }
  }

  // ── Save / Submit ─────────────────────────────────────────────────────────

  function buildEntriesFromCells(cellsSnapshot: CellsMap): Omit<TimesheetEntry, "_id">[] {
    return Object.entries(cellsSnapshot).map(([dateKey, c]) => ({
      date: dateKey,
      status: c.status,
      tasks: c.tasks.split("\n").map((t) => t.trim()).filter(Boolean),
      worked_hours: c.worked_hours,
      billable_hours: c.billable_hours,
      actual_hours: c.actual_hours,
      completed_task: c.completed_task,
      completed_task_description: c.completed_task_description,
      unplanned_task: c.unplanned_task,
      comments: c.comments,
    }));
  }

  async function handleSaveDraft() {
    const entries = buildEntriesFromCells(cells);
    if (entries.length === 0) {
      toast.error("No entries to save.");
      return;
    }
    setSaving(true);
    try {
      const apiMonth = selectedMonth + 1;
      let res;
      if (!timesheet) {
        res = await timesheetService.create(apiMonth, selectedYear, entries, projectId);
      } else {
        res = await timesheetService.update(timesheet._id, entries);
      }
      setTimesheet(res.data);
      const saved = buildCellsFromEntries(res.data.entries, days);
      cellsRef.current = saved;
      setCells(saved);
      toast.success("Timesheet saved as draft");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save draft"));
    } finally {
      setSaving(false);
    }
  }

  function validateCells(snapshot: CellsMap): string[] {
    const errors: string[] = [];
    let emptyTaskCount = 0;
    let zeroBillableCount = 0;

    Object.entries(snapshot).forEach(([, c]) => {
      if (c.status === "Working" || c.status === "Extra Working") {
        if (!c.tasks.trim()) emptyTaskCount++;
        if (!c.billable_hours || c.billable_hours <= 0) zeroBillableCount++;
      }
    });

    if (emptyTaskCount > 0) {
      errors.push(`${emptyTaskCount} working day${emptyTaskCount > 1 ? "s have" : " has"} no task description. Task description is required for all working days.`);
    }
    if (zeroBillableCount > 0) {
      errors.push(`${zeroBillableCount} working day${zeroBillableCount > 1 ? "s have" : " has"} zero billable hours. Billable hours must be greater than zero for working days.`);
    }

    return errors;
  }

  function handleSubmitClick() {
    // Use ref to get the latest cells (avoids stale closure)
    const errors = validateCells(cellsRef.current);

    if (errors.length > 0) {
      errors.forEach((e) => toast.error(e));
      return;
    }

    setSubmitConfirmOpen(true);
  }

  async function handleSubmitConfirmed() {
    setSubmitConfirmOpen(false);

    // Double-check validation with latest cells before submitting
    const preCheckErrors = validateCells(cellsRef.current);
    if (preCheckErrors.length > 0) {
      preCheckErrors.forEach((e) => toast.error(e));
      return;
    }

    setSaving(true);
    try {
      const entries = buildEntriesFromCells(cellsRef.current);
      const apiMonth = selectedMonth + 1;

      if (!timesheet) {
        if (entries.length === 0) {
          toast.error("No entries to submit.");
          setSaving(false);
          return;
        }
        const saved = await timesheetService.create(apiMonth, selectedYear, entries, projectId);
        const submitted = await timesheetService.submit(saved.data._id);
        setTimesheet(submitted.data);
        const s1 = buildCellsFromEntries(submitted.data.entries, days);
        cellsRef.current = s1;
        setCells(s1);
      } else {
        const updated = await timesheetService.update(timesheet._id, entries);
        const submitted = await timesheetService.submit(updated.data._id);
        setTimesheet(submitted.data);
        const s2 = buildCellsFromEntries(submitted.data.entries, days);
        cellsRef.current = s2;
        setCells(s2);
      }
      toast.success("Timesheet submitted! Your manager can now review it.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to submit timesheet"));
    } finally {
      setSaving(false);
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────

  function openExportDialog() {
    // Default: full current month
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
    setExportFromDate(toDateKey(firstDay));
    setExportToDate(toDateKey(lastDay));
    setExportOpen(true);
  }

  function handleExport() {
    if (!exportFromDate || !exportToDate) {
      toast.error("Please select a valid date range.");
      return;
    }
    const from = new Date(exportFromDate);
    const to = new Date(exportToDate);
    if (from > to) {
      toast.error("Start date must be before end date.");
      return;
    }

    const rows = buildExportRows(cells, from, to);
    if (rows.length === 0) {
      toast.error("No data in selected date range.");
      return;
    }

    const exportTotalBillable = rows.reduce((s, r) => s + r.billableHours, 0);
    const name = decodeURIComponent(projectName);
    const monthLabel = exportFromDate === exportToDate
      ? exportFromDate
      : `${exportFromDate} to ${exportToDate}`;
    const filename = `Timesheet_${name}_${exportFromDate}_${exportToDate}`.replace(/\s+/g, "_");

    try {
      if (exportFormat === "xlsx") exportToXLSX(rows, filename);
      else if (exportFormat === "csv") exportToCSV(rows, filename);
      else exportToPDF(rows, filename, { projectName: name, monthLabel, totalBillable: exportTotalBillable });
      toast.success(`Exported as ${exportFormat.toUpperCase()}`);
      setExportOpen(false);
    } catch {
      toast.error("Export failed. Please try again.");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className={`flex-1 flex flex-col min-h-0 animate-fade-in${!isLocked && !loading ? " pb-14" : ""}`}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="gap-1.5 shrink-0">
              <ChevronLeft className="w-4 h-4" />
              Projects
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-[#217346]" />
                <h1 className="text-xl font-bold tracking-tight">{decodeURIComponent(projectName)}</h1>
              </div>
              <p className="text-muted-foreground text-sm mt-0.5">
                Fill in your daily task descriptions and billable hours.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Month / Year picker */}
            <MonthYearPicker
              month={selectedMonth}
              year={selectedYear}
              disabled={saving}
              onChange={(m, y) => { setSelectedMonth(m); setSelectedYear(y); }}
            />

            {status === "submitted" && (
              <Badge className="bg-blue-100 text-blue-700 border border-blue-200 gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Submitted
              </Badge>
            )}
            {status === "approved" && (
              <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approved
              </Badge>
            )}
            {status === "rejected" && (
              <Badge className="bg-red-100 text-red-700 border border-red-200 gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Rejected
              </Badge>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={openExportDialog}
              disabled={loading}
              className="gap-1.5"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-card border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Total Billable Hours</p>
            <p className="text-xl font-bold text-blue-600 mt-0.5">{totalBillable}h</p>
          </div>
          <div className="bg-card border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Working Days</p>
            <p className="text-xl font-bold text-green-600 mt-0.5">{workingEntries.length}</p>
          </div>
          <div className="bg-card border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Total Worked Hours</p>
            <p className="text-xl font-bold mt-0.5">{totalWorked}h</p>
          </div>
        </div>

        {/* ── Status banner ── */}
        {status === "submitted" && (
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
            <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">
                Timesheet submitted for {MONTHS[selectedMonth]} {selectedYear}
              </p>
              <p className="text-xs text-blue-600">
                Your manager can now review your entries. Use &quot;Edit&quot; to recall and make changes.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecall}
              disabled={saving}
              className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-100 shrink-0"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Pencil className="w-3.5 h-3.5" />
              )}
              Edit
            </Button>
          </div>
        )}
        {status === "approved" && (
          <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-800">
                Timesheet approved for {MONTHS[selectedMonth]} {selectedYear}
              </p>
              <p className="text-xs text-emerald-600">
                Your timesheet has been reviewed and approved by your manager.
              </p>
            </div>
          </div>
        )}
        {status === "rejected" && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg mb-4">
            <CheckCircle2 className="w-5 h-5 text-red-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                Timesheet rejected for {MONTHS[selectedMonth]} {selectedYear}
              </p>
              <p className="text-xs text-red-600">
                {timesheet?.rejection_reason || "Please review the feedback and re-submit."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecall}
              disabled={saving}
              className="gap-1.5 border-red-300 text-red-700 hover:bg-red-100 shrink-0"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Pencil className="w-3.5 h-3.5" />
              )}
              Edit &amp; Re-submit
            </Button>
          </div>
        )}

        {/* ── Grid ── */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading timesheet...</span>
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="overflow-auto flex-1">
              <table
                className="w-full text-xs"
                style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: 780 }}
              >
                {/* Sticky header */}
                <thead className="sticky top-0 z-20">
                  <tr className="text-white">
                    <th style={th} className="w-12 text-center bg-[#217346]">Sr No</th>
                    <th style={th} className="w-28 text-center bg-[#217346]">Status</th>
                    <th style={th} className="w-36 text-left bg-[#217346]">Date</th>
                    <th style={th} className="w-24 text-left bg-[#217346]">Day</th>
                    <th style={{ ...th, minWidth: 300 }} className="text-left bg-[#217346]">Task Description</th>
                    <th style={th} className="w-24 text-center bg-[#217346]">Billable Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day, rowIdx) => {
                    const dateKey = toDateKey(day);
                    const cell = getCell(dateKey);
                    const today = isToday(day);
                    const dayName = DAY_NAMES[day.getDay()];
                    const dateDisplay = `${day.getDate()} ${MONTHS[day.getMonth()]} ${day.getFullYear()}`;

                    const rowBg = statusRowBg(cell.status, today);

                    return (
                      <tr
                        key={dateKey}
                        className={rowBg}
                        style={today ? { borderLeft: "3px solid #f59e0b" } : { borderLeft: "3px solid transparent" }}
                      >
                        {/* Sr No */}
                        <td style={td} className="text-center text-gray-500 font-mono font-medium">
                          {rowIdx + 1}
                        </td>

                        {/* Status */}
                        <td style={td} className="text-center">
                          {isLocked ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${statusBadgeClass(cell.status)}`}>
                              {cell.status}
                            </span>
                          ) : (
                            <select
                              value={cell.status}
                              onChange={(e) => patchCell(dateKey, { status: e.target.value as DayStatus, saved: false })}
                              className={`text-[10px] font-semibold rounded px-1.5 py-0.5 border outline-none cursor-pointer ${statusBadgeClass(cell.status)}`}
                            >
                              {getStatusOptionsForDay(day).map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          )}
                        </td>

                        {/* Date */}
                        <td
                          style={td}
                          className={`font-medium whitespace-nowrap ${
                            cell.status === "Holiday" ? "text-red-600" :
                            cell.status === "On leave" ? "text-orange-600" :
                            today ? "text-amber-700 font-bold" : "text-gray-700"
                          }`}
                        >
                          {dateDisplay}
                        </td>

                        {/* Day */}
                        <td
                          style={td}
                          className={`font-medium ${
                            cell.status === "Holiday" ? "text-red-500" :
                            cell.status === "On leave" ? "text-orange-500" :
                            "text-gray-500"
                          }`}
                        >
                          {dayName}
                        </td>

                        {/* Task Description — editable only for Working / Extra Working */}
                        <td style={{ ...td, padding: "3px 6px" }}>
                          {isLocked || cell.status === "Holiday" || cell.status === "On leave" ? (
                            cell.tasks ? (
                              cell.tasks.includes("\n") ? (
                                <ul className="space-y-0.5 list-none">
                                  {cell.tasks.split("\n").filter(Boolean).map((t, ti) => (
                                    <li key={ti} className="flex items-start gap-1">
                                      <span className="text-gray-400 shrink-0 mt-0.5 select-none">&#9656;</span>
                                      <span>{t}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span>{cell.tasks}</span>
                              )
                            ) : (
                              <span className="text-gray-300">—</span>
                            )
                          ) : (
                            <TaskCell
                              value={cell.tasks}
                              onCommit={(v) => patchCell(dateKey, { tasks: v, saved: false })}
                            />
                          )}
                        </td>

                        {/* Billable Hours — editable only for Working / Extra Working */}
                        <td style={td} className="text-center">
                          {isLocked || cell.status === "Holiday" || cell.status === "On leave" ? (
                            <span className={`font-mono font-semibold ${
                              cell.billable_hours > 0 ? "text-gray-800" : "text-gray-400"
                            }`}>
                              {cell.billable_hours}
                            </span>
                          ) : (
                            <BillableCell
                              value={cell.billable_hours}
                              onCommit={(v) => patchCell(dateKey, {
                                billable_hours: v,
                                worked_hours: v,
                                saved: false,
                              })}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Totals row */}
                  <tr
                    className="bg-[#217346] text-white font-bold text-xs sticky bottom-0"
                    style={{ borderTop: "2px solid #185c37" }}
                  >
                    <td style={thTotal} colSpan={5} className="text-right pr-4 uppercase tracking-wider text-[11px]">
                      Total Billable Hours
                    </td>
                    <td style={thTotal} className="text-center font-mono text-sm">
                      {totalBillable}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Floating action bar ── */}
      {!isLocked && !loading && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-end gap-3 px-6 py-3 bg-white border-t shadow-lg"
          style={{ marginLeft: "var(--sidebar-width, 0px)" }}
        >
          <p className="text-xs text-muted-foreground mr-auto">
            <span className="font-semibold text-foreground">{workingEntries.length}</span> working{" "}
            {workingEntries.length === 1 ? "day" : "days"} &middot; {totalBillable}h billable
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={saving}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </Button>
          <Button
            size="sm"
            onClick={handleSubmitClick}
            className="gap-1.5 bg-[#217346] hover:bg-[#185c37] text-white"
          >
            <Send className="w-4 h-4" />
            Submit Timesheet
          </Button>
        </div>
      )}

      {/* Export dialog */}
      <AlertDialog open={exportOpen} onOpenChange={setExportOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-[#217346]" />
              Export Timesheet
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4 pt-1">
                {/* Date range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">From</label>
                    <input
                      type="date"
                      value={exportFromDate}
                      onChange={(e) => setExportFromDate(e.target.value)}
                      className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">To</label>
                    <input
                      type="date"
                      value={exportToDate}
                      onChange={(e) => setExportToDate(e.target.value)}
                      className="w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]"
                    />
                  </div>
                </div>

                {/* Format selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">Format</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["xlsx", "csv", "pdf"] as ExportFormat[]).map((fmt) => {
                      const icons = {
                        xlsx: <FileSpreadsheet className="w-4 h-4" />,
                        csv: <FileText className="w-4 h-4" />,
                        pdf: <File className="w-4 h-4" />,
                      };
                      const labels = { xlsx: "Excel (.xlsx)", csv: "CSV", pdf: "PDF" };
                      const active = exportFormat === fmt;
                      return (
                        <button
                          key={fmt}
                          onClick={() => setExportFormat(fmt)}
                          className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border text-xs font-medium transition-all ${
                            active
                              ? "bg-[#217346] text-white border-[#217346]"
                              : "bg-white text-slate-600 border-slate-200 hover:border-[#217346] hover:text-[#217346]"
                          }`}
                        >
                          {icons[fmt]}
                          {labels[fmt]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExport}
              className="bg-[#217346] hover:bg-[#185c37] text-white"
            >
              <Download className="w-4 h-4" />
              Export
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Submit confirmation dialog */}
      <AlertDialog open={submitConfirmOpen} onOpenChange={setSubmitConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Timesheet</AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                Submit your timesheet for <strong>{MONTHS[selectedMonth]} {selectedYear}</strong>?
                Once submitted, your manager will be notified for review.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmitConfirmed}
              className="bg-[#217346] hover:bg-[#185c37] text-white"
            >
              Submit Timesheet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

// ── Style aliases (from shared utils) ────────────────────────────────────────
const th = tableTh;
const td = tableTd;
const thTotal = tableThTotal;
