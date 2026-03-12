import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
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
  Calendar,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Pencil,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
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

function defaultStatus(_d: Date): DayStatus {
  return "Working";
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
    map[key] = {
      _id: e._id,
      status: e.status || map[key].status,
      tasks: Array.isArray(e.tasks) ? e.tasks.filter(Boolean).join("\n") : (e.tasks ?? ""),
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
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const v = parseFloat(local);
        const next = isNaN(v) ? 0 : v;
        if (next !== value) onCommit(next);
      }}
      className="w-16 text-center font-mono font-semibold bg-transparent border-0 focus:bg-white focus:ring-1 focus:ring-blue-400 rounded-sm outline-none px-1 py-0.5 text-xs"
    />
  );
});

// ── MonthYearPicker ────────────────────────────────────────────────────────────

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function MonthYearPicker({
  month, year, disabled, onChange,
}: {
  month: number; year: number; disabled?: boolean;
  onChange: (month: number, year: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const ref = useRef<HTMLDivElement>(null);

  // sync pickerYear when year changes externally
  useEffect(() => { setPickerYear(year); }, [year]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function select(m: number) {
    onChange(m, pickerYear);
    setOpen(false);
  }

  const isCurrentMonth = (m: number) => m === month && pickerYear === year;
  const isToday = (m: number) => m === CURRENT_MONTH && pickerYear === CURRENT_YEAR;

  return (
    <div ref={ref} className="relative">
      <button
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 h-10 px-3 rounded-lg border border-input bg-white hover:bg-slate-50 text-sm font-medium shadow-sm transition-colors disabled:opacity-40 min-w-[160px]"
      >
        <Calendar className="w-4 h-4 text-[#217346] shrink-0" />
        <span className="flex-1 text-left">{MONTHS[month]}</span>
        <span className="text-muted-foreground font-normal">{year}</span>
        <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border rounded-xl shadow-xl p-3 w-[240px]">
          {/* Year row */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setPickerYear(y => y - 1)}
              className="p-1 rounded hover:bg-slate-100 text-slate-500"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-slate-800">{pickerYear}</span>
            <button
              onClick={() => setPickerYear(y => Math.min(y + 1, CURRENT_YEAR + 1))}
              disabled={pickerYear >= CURRENT_YEAR + 1}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1">
            {MONTH_SHORT.map((m, idx) => {
              const active = isCurrentMonth(idx);
              const today = isToday(idx);
              return (
                <button
                  key={idx}
                  onClick={() => select(idx)}
                  className={[
                    "rounded-lg py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-[#217346] text-white shadow-sm"
                      : today
                      ? "border border-[#217346] text-[#217346] hover:bg-green-50"
                      : "hover:bg-slate-100 text-slate-700",
                  ].join(" ")}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
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
  const [submitWarnings, setSubmitWarnings] = useState<string[]>([]);

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
  const isLocked = status === "submitted";

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

      // Auto-adjust billable hours when status changes
      if (patch.status && patch.status !== existing.status) {
        const newBillable = defaultBillable(patch.status);
        updated.billable_hours = newBillable;
        updated.worked_hours = newBillable;
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

  function handleSubmitClick() {
    const warnings: string[] = [];
    Object.entries(cells).forEach(([, c]) => {
      if ((c.status === "Working" || c.status === "Extra Working") && !c.tasks.trim()) {
        warnings.push("working");
      }
    });
    const emptyWorkingDays = warnings.length;
    if (emptyWorkingDays > 0) {
      setSubmitWarnings([
        `${emptyWorkingDays} working day${emptyWorkingDays > 1 ? "s have" : " has"} no task description filled in.`,
      ]);
      setSubmitConfirmOpen(true);
    } else {
      setSubmitConfirmOpen(true);
      setSubmitWarnings([]);
    }
  }

  async function handleSubmitConfirmed() {
    setSubmitConfirmOpen(false);
    setSaving(true);
    try {
      const entries = buildEntriesFromCells(cells);
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
      <div className="flex-1 flex flex-col min-h-0 animate-fade-in pb-20">

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

            {isLocked && (
              <Badge className="bg-green-100 text-green-700 border border-green-200 gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Submitted
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

        {/* ── Submitted banner ── */}
        {isLocked && (
          <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg mb-4">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">
                Timesheet submitted for {MONTHS[selectedMonth]} {selectedYear}
              </p>
              <p className="text-xs text-green-600">
                Your manager can now review your entries. Use &quot;Edit&quot; to recall and make changes.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecall}
              disabled={saving}
              className="gap-1.5 border-green-300 text-green-700 hover:bg-green-100 shrink-0"
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
                style={{ borderCollapse: "collapse", minWidth: 780 }}
              >
                {/* Sticky header */}
                <thead className="sticky top-0 z-20">
                  <tr className="bg-[#217346] text-white">
                    <th style={th} className="w-12 text-center">Sr No</th>
                    <th style={th} className="w-28 text-center">Status</th>
                    <th style={th} className="w-36 text-left">Date</th>
                    <th style={th} className="w-24 text-left">Day</th>
                    <th style={{ ...th, minWidth: 300 }} className="text-left">Task Description</th>
                    <th style={th} className="w-24 text-center">Billable Hours</th>
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
                              {STATUS_OPTIONS.map((s) => (
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

                        {/* Task Description */}
                        <td style={{ ...td, padding: "3px 6px" }}>
                          {isLocked ? (
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

                        {/* Billable Hours */}
                        <td style={td} className="text-center">
                          {isLocked ? (
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
            disabled={saving}
            className="gap-1.5 bg-[#217346] hover:bg-[#185c37] text-white"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
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
            <AlertDialogTitle className="flex items-center gap-2">
              {submitWarnings.length > 0 && (
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              )}
              Submit Timesheet
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3">
                {submitWarnings.length > 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-amber-800 space-y-1">
                    {submitWarnings.map((w, i) => (
                      <p key={i} className="flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                        {w}
                      </p>
                    ))}
                    <p className="text-xs text-amber-600 mt-1">You can still submit, but consider filling in task descriptions first.</p>
                  </div>
                ) : null}
                <p>
                  Submit your timesheet for <strong>{MONTHS[selectedMonth]} {selectedYear}</strong>?
                  Once submitted, your manager will be notified for review.
                </p>
              </div>
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
