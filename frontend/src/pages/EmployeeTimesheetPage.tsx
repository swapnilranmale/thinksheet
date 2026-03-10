import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Send,
  Save,
  Calendar,
  CheckCircle2,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { timesheetService, Timesheet, TimesheetEntry } from "@/services/timesheet";

// ── Constants ──────────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const CURRENT_MONTH = NOW.getMonth(); // 0-indexed

// ── Types ──────────────────────────────────────────────────────────────────────

type CellEntry = {
  _id?: string;
  tasks: string;          // newline-separated, stored/displayed like completion note
  worked_hours: number;
  billable_hours: number;
  actual_hours: number;
  completed_task: boolean;
  completed_task_description: string;
  unplanned_task: boolean;
  comments: string;
  saved?: boolean;        // true = row persisted to backend
};

type CellsMap = Record<string, CellEntry>; // keyed by "YYYY-MM-DD"

function emptyCell(): CellEntry {
  return {
    tasks: "",
    worked_hours: 0,
    billable_hours: 0,
    actual_hours: 0,
    completed_task: false,
    completed_task_description: "",
    unplanned_task: false,
    comments: "",
    saved: false,
  };
}

function buildCellsFromEntries(entries: TimesheetEntry[]): CellsMap {
  const map: CellsMap = {};
  for (const e of entries) {
    const key = e.date?.slice(0, 10);
    if (!key) continue;
    map[key] = {
      _id: e._id,
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

function getDaysInMonth(year: number, month: number): Date[] {
  // month is 0-indexed
  const days: Date[] = [];
  const total = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= total; d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isWeekend(d: Date) {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

function isToday(d: Date) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate();
}

// ── Inline number input ────────────────────────────────────────────────────────

function NumInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const [raw, setRaw] = useState(value === 0 ? "" : String(value));
  const ref = useRef<HTMLInputElement>(null);

  // sync when parent resets
  useEffect(() => {
    setRaw(value === 0 ? "" : String(value));
  }, [value]);

  if (disabled) {
    return (
      <span className="text-right font-mono w-14 block text-gray-700">
        {value || "—"}
      </span>
    );
  }

  return (
    <input
      ref={ref}
      type="number"
      min={0}
      max={24}
      step={0.5}
      value={raw}
      placeholder="0"
      onChange={(e) => {
        setRaw(e.target.value);
        const n = parseFloat(e.target.value);
        onChange(isNaN(n) ? 0 : n);
      }}
      onBlur={() => {
        if (raw === "") setRaw("");
      }}
      className="w-14 text-right font-mono bg-transparent border-0 focus:bg-white focus:ring-1 focus:ring-blue-400 rounded-sm outline-none px-1 py-0.5 text-xs"
    />
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function EmployeeTimesheetPage() {
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedYear] = useState(CURRENT_YEAR);

  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [cells, setCells] = useState<CellsMap>({});
  const cellsRef = useRef<CellsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Load timesheet ──────────────────────────────────────────────────────────

  const loadTimesheet = useCallback(async () => {
    try {
      setLoading(true);
      const apiMonth = selectedMonth + 1;
      const res = await timesheetService.getOwn(apiMonth, selectedYear);
      setTimesheet(res.data);
      const loaded = res.data ? buildCellsFromEntries(res.data.entries) : {};
      cellsRef.current = loaded;
      setCells(loaded);
    } catch (err: any) {
      if (!err.message?.includes("404")) {
        toast.error(err.message || "Failed to load timesheet");
      }
      setTimesheet(null);
      setCells({});
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    loadTimesheet();
  }, [loadTimesheet]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const status = timesheet?.status ?? "draft";
  const isLocked = status === "submitted";

  const days = getDaysInMonth(selectedYear, selectedMonth);

  const activeEntries = Object.entries(cells).filter(
    ([, c]) => c.worked_hours > 0
  );

  const totalWorked = activeEntries.reduce((s, [, c]) => s + c.worked_hours, 0);
  const totalBillable = activeEntries.reduce((s, [, c]) => s + c.billable_hours, 0);
  const totalActual = activeEntries.reduce((s, [, c]) => s + c.actual_hours, 0);
  const completedCount = activeEntries.filter(([, c]) => c.completed_task).length;
  const unplannedCount = activeEntries.filter(([, c]) => c.unplanned_task).length;

  // ── Cell mutators ───────────────────────────────────────────────────────────

  function getCell(dateKey: string): CellEntry {
    return cells[dateKey] ?? emptyCell();
  }

  function patchCell(dateKey: string, patch: Partial<CellEntry>) {
    setCells((prev) => {
      const next = {
        ...prev,
        [dateKey]: { ...(prev[dateKey] ?? emptyCell()), ...patch },
      };
      cellsRef.current = next;
      return next;
    });
  }

  // ── Save / Submit ───────────────────────────────────────────────────────────

  function buildEntriesFromCells(cellsSnapshot: CellsMap): Omit<TimesheetEntry, "_id">[] {
    return Object.entries(cellsSnapshot)
      .filter(([, c]) => c.worked_hours > 0)
      .map(([dateKey, c]) => ({
        date: dateKey,
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

  function buildEntries(): Omit<TimesheetEntry, "_id">[] {
    return buildEntriesFromCells(cells);
  }

  async function handleSaveRow(dateKey: string) {
    // Always read from ref — never stale, no async tricks needed
    const currentCells = cellsRef.current;
    const cell = currentCells[dateKey] ?? emptyCell();

    if (!cell.worked_hours) {
      toast.error("Please enter worked hours before saving this row.");
      return;
    }

    const allEntries = buildEntriesFromCells(currentCells);

    try {
      const apiMonth = selectedMonth + 1;
      let res;
      if (!timesheet) {
        res = await timesheetService.create(apiMonth, selectedYear, allEntries);
      } else {
        res = await timesheetService.update(timesheet._id, allEntries);
      }
      setTimesheet(res.data);
      const updated = buildCellsFromEntries(res.data.entries);
      cellsRef.current = updated;
      setCells(updated);
      toast.success("Row saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save row");
    }
  }

  async function handleSaveDraft() {
    const entries = buildEntriesFromCells(cells);
    if (entries.length === 0) {
      toast.error("No entries to save. Fill in worked hours for at least one day.");
      return;
    }
    setSaving(true);
    try {
      const apiMonth = selectedMonth + 1;
      let res;
      if (!timesheet) {
        res = await timesheetService.create(apiMonth, selectedYear, entries);
      } else {
        res = await timesheetService.update(timesheet._id, entries);
      }
      setTimesheet(res.data);
      const saved2 = buildCellsFromEntries(res.data.entries);
      cellsRef.current = saved2;
      setCells(saved2);
      toast.success("Timesheet saved as draft");
    } catch (err: any) {
      toast.error(err.message || "Failed to save draft");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!timesheet) {
      // save first then submit
      setSaving(true);
      try {
        const entries = buildEntriesFromCells(cells);
        if (entries.length === 0) {
          toast.error("No entries to submit.");
          setSaving(false);
          return;
        }
        const apiMonth = selectedMonth + 1;
        const saved = await timesheetService.create(apiMonth, selectedYear, entries);
        const submitted = await timesheetService.submit(saved.data._id);
        setTimesheet(submitted.data);
        const s1 = buildCellsFromEntries(submitted.data.entries);
        cellsRef.current = s1;
        setCells(s1);
        toast.success("Timesheet submitted!");
      } catch (err: any) {
        toast.error(err.message || "Failed to submit");
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      // persist latest edits first
      const entries = buildEntriesFromCells(cells);
      const updated = await timesheetService.update(timesheet._id, entries);
      const submitted = await timesheetService.submit(updated.data._id);
      setTimesheet(submitted.data);
      const s2 = buildCellsFromEntries(submitted.data.entries);
      cellsRef.current = s2;
      setCells(s2);
      toast.success("Timesheet submitted! Your manager can now review it.");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit timesheet");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="flex-1 flex flex-col min-h-0 animate-fade-in pb-20">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Timesheet</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Click any cell to edit. Fill worked hours to activate a row.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={String(selectedMonth)}
              onValueChange={(v) => setSelectedMonth(Number(v))}
              disabled={isLocked || saving}
            >
              <SelectTrigger className="w-44">
                <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, idx) => (
                  <SelectItem key={idx} value={String(idx)}>
                    {m} {selectedYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isLocked ? (
              <Badge className="bg-green-100 text-green-700 border border-green-200 gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Submitted
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Clock className="w-3.5 h-3.5" />
                Draft
              </Badge>
            )}
          </div>
        </div>

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-card border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Total Worked</p>
            <p className="text-xl font-bold mt-0.5">{totalWorked}h</p>
            <p className="text-xs text-muted-foreground">{activeEntries.length} active days</p>
          </div>
          <div className="bg-card border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Billable Hours</p>
            <p className="text-xl font-bold text-blue-600 mt-0.5">{totalBillable}h</p>
            <p className="text-xs text-muted-foreground">
              {totalWorked > 0 ? Math.round((totalBillable / totalWorked) * 100) : 0}% of total
            </p>
          </div>
          <div className="bg-card border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Tasks Completed</p>
            <p className="text-xl font-bold text-green-600 mt-0.5">{completedCount}</p>
            <p className="text-xs text-muted-foreground">of {activeEntries.length} days</p>
          </div>
          <div className="bg-card border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Unplanned Tasks</p>
            <p className="text-xl font-bold text-orange-500 mt-0.5">{unplannedCount}</p>
            <p className="text-xs text-muted-foreground">outside scope</p>
          </div>
        </div>

        {/* ── Submitted banner ── */}
        {isLocked && (
          <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg mb-4">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">
                Timesheet submitted for {MONTHS[selectedMonth]} {selectedYear}
              </p>
              <p className="text-xs text-green-600">
                Your manager can now review your entries. No further edits are allowed.
              </p>
            </div>
          </div>
        )}

        {/* ── Grid ── */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading timesheet…</span>
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="overflow-auto flex-1">
              <table
                className="w-full text-xs"
                style={{ borderCollapse: "collapse", minWidth: 1020 }}
              >
                {/* Sticky header */}
                <thead className="sticky top-0 z-20">
                  <tr className="bg-[#217346] text-white">
                    <th style={th} className="w-8 text-center">#</th>
                    <th style={th} className="w-24 text-left">Date</th>
                    <th style={th} className="w-14 text-left">Day</th>
                    <th style={{ ...th, minWidth: 260 }} className="text-left">Tasks</th>
                    <th style={th} className="w-16 text-right">Worked</th>
                    <th style={th} className="w-16 text-right">Billable</th>
                    <th style={th} className="w-16 text-right">Actual</th>
                    <th style={th} className="w-16 text-center">Done?</th>
                    <th style={th} className="w-20 text-center">Unplanned?</th>
                    <th style={{ ...th, minWidth: 160 }} className="text-left">Completion Note</th>
                    <th style={{ ...th, minWidth: 160 }} className="text-left">Comments</th>
                    {!isLocked && <th style={th} className="w-12 text-center">Save</th>}
                  </tr>
                </thead>
                <tbody>
                  {days.map((day, rowIdx) => {
                    const dateKey = toDateKey(day);
                    const cell = getCell(dateKey);
                    const weekend = isWeekend(day);
                    const today = isToday(day);
                    const active = cell.worked_hours > 0;
                    const dayName = day.toLocaleDateString("en-IN", { weekday: "short" });
                    const dateDisplay = day.toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    });

                    const rowClass = [
                      today ? "bg-amber-50" : weekend ? "bg-blue-50" : rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/60",
                      !active && !isLocked ? "opacity-70" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <tr
                        key={dateKey}
                        className={rowClass}
                        style={today ? { borderLeft: "3px solid #f59e0b" } : { borderLeft: "3px solid transparent" }}
                      >
                        {/* # */}
                        <td style={td} className="text-center text-gray-400 font-mono select-none">
                          {rowIdx + 1}
                        </td>

                        {/* Date */}
                        <td
                          style={td}
                          className={`font-medium whitespace-nowrap ${weekend ? "text-blue-600" : ""} ${today ? "text-amber-600 font-bold" : ""}`}
                        >
                          {dateDisplay}
                        </td>

                        {/* Day */}
                        <td
                          style={td}
                          className={`font-medium ${weekend ? "text-blue-500" : "text-gray-500"}`}
                        >
                          {dayName}
                        </td>

                        {/* Tasks */}
                        <td style={{ ...td, padding: "3px 4px" }}>
                          {isLocked ? (
                            cell.tasks ? (
                              cell.tasks.includes("\n") ? (
                                <ul className="space-y-0.5 list-none px-1">
                                  {cell.tasks.split("\n").filter(Boolean).map((t, ti) => (
                                    <li key={ti} className="flex items-start gap-1">
                                      <span className="text-gray-400 shrink-0 mt-0.5 select-none">▸</span>
                                      <span>{t}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="px-1">{cell.tasks}</span>
                              )
                            ) : (
                              <span className="text-gray-300 px-1">—</span>
                            )
                          ) : (
                            <textarea
                              value={cell.tasks}
                              placeholder="Enter tasks (one per line)…"
                              rows={cell.tasks ? Math.max(1, cell.tasks.split("\n").length) : 1}
                              onChange={(e) => patchCell(dateKey, { tasks: e.target.value, saved: false })}
                              className="w-full border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 rounded-sm outline-none px-1 py-0.5 text-xs resize-none placeholder:text-gray-300"
                            />
                          )}
                        </td>

                        {/* Worked */}
                        <td style={td} className="text-right">
                          <NumInput
                            value={cell.worked_hours}
                            onChange={(v) => patchCell(dateKey, { worked_hours: v, saved: false })}
                            disabled={isLocked}
                          />
                        </td>

                        {/* Billable */}
                        <td style={td} className="text-right">
                          <NumInput
                            value={cell.billable_hours}
                            onChange={(v) => patchCell(dateKey, { billable_hours: v, saved: false })}
                            disabled={isLocked}
                          />
                        </td>

                        {/* Actual */}
                        <td style={td} className="text-right">
                          <NumInput
                            value={cell.actual_hours}
                            onChange={(v) => patchCell(dateKey, { actual_hours: v, saved: false })}
                            disabled={isLocked}
                          />
                        </td>

                        {/* Done? */}
                        <td style={td} className="text-center">
                          {isLocked ? (
                            cell.completed_task ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600 text-[10px] font-bold">
                                ✓
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )
                          ) : (
                            <input
                              type="checkbox"
                              checked={cell.completed_task}
                              onChange={(e) =>
                                patchCell(dateKey, {
                                  completed_task: e.target.checked,
                                  completed_task_description: e.target.checked
                                    ? cell.completed_task_description
                                    : "",
                                  saved: false,
                                })
                              }
                              className="h-3.5 w-3.5 rounded accent-green-600 cursor-pointer"
                            />
                          )}
                        </td>

                        {/* Unplanned? */}
                        <td style={td} className="text-center">
                          {isLocked ? (
                            cell.unplanned_task ? (
                              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-semibold text-[10px] uppercase tracking-wide">
                                Yes
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )
                          ) : (
                            <input
                              type="checkbox"
                              checked={cell.unplanned_task}
                              onChange={(e) =>
                                patchCell(dateKey, { unplanned_task: e.target.checked, saved: false })
                              }
                              className="h-3.5 w-3.5 rounded accent-orange-500 cursor-pointer"
                            />
                          )}
                        </td>

                        {/* Completion Note */}
                        <td style={{ ...td, padding: "3px 4px" }}>
                          {isLocked ? (
                            <span className={cell.completed_task_description ? "text-green-700" : "text-gray-300"}>
                              {cell.completed_task_description || "—"}
                            </span>
                          ) : (
                            <textarea
                              value={cell.completed_task_description}
                              placeholder={cell.completed_task ? "Describe completion…" : ""}
                              rows={cell.completed_task_description ? 2 : 1}
                              onChange={(e) =>
                                patchCell(dateKey, { completed_task_description: e.target.value, saved: false })
                              }
                              className="w-full border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 rounded-sm outline-none px-1 py-0.5 text-xs resize-none placeholder:text-gray-300"
                            />
                          )}
                        </td>

                        {/* Comments */}
                        <td style={{ ...td, padding: "3px 4px" }}>
                          {isLocked ? (
                            <span className={cell.comments ? "text-gray-600" : "text-gray-300"}>
                              {cell.comments || "—"}
                            </span>
                          ) : (
                            <textarea
                              value={cell.comments}
                              placeholder="Notes…"
                              rows={cell.comments ? 2 : 1}
                              onChange={(e) =>
                                patchCell(dateKey, { comments: e.target.value, saved: false })
                              }
                              className="w-full border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 rounded-sm outline-none px-1 py-0.5 text-xs resize-none placeholder:text-gray-300"
                            />
                          )}
                        </td>

                        {/* Per-row Save */}
                        {!isLocked && (
                          <td style={{ ...td, padding: "2px 4px" }} className="text-center">
                            {cell.saved ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-50 text-green-500" title="Saved">
                                <Check className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSaveRow(dateKey)}
                                title="Save this row"
                                className="inline-flex items-center justify-center w-6 h-6 rounded bg-[#217346] hover:bg-[#185c37] text-white transition-colors"
                              >
                                <Save className="w-3 h-3" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}

                  {/* Totals row */}
                  <tr
                    className="bg-[#e8f0fe] font-bold text-xs sticky bottom-0"
                    style={{ borderTop: "2px solid #217346" }}
                  >
                    <td
                      style={{ ...td, borderColor: "#b0c4de" }}
                      colSpan={4}
                      className="text-gray-500 text-[10px] uppercase tracking-wider px-3"
                    >
                      TOTAL — {activeEntries.length} days logged
                    </td>
                    <td style={{ ...td, borderColor: "#b0c4de" }} className="text-right font-mono text-slate-800">
                      {totalWorked}
                    </td>
                    <td style={{ ...td, borderColor: "#b0c4de" }} className="text-right font-mono text-blue-700">
                      {totalBillable}
                    </td>
                    <td style={{ ...td, borderColor: "#b0c4de" }} className="text-right font-mono text-violet-700">
                      {totalActual}
                    </td>
                    <td style={{ ...td, borderColor: "#b0c4de" }} className="text-center text-green-700">
                      {completedCount}/{activeEntries.length}
                    </td>
                    <td style={{ ...td, borderColor: "#b0c4de" }} className="text-center text-orange-600">
                      {unplannedCount}
                    </td>
                    <td style={{ ...td, borderColor: "#b0c4de" }} colSpan={isLocked ? 2 : 3} />
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
            <span className="font-semibold text-foreground">{activeEntries.length}</span> active{" "}
            {activeEntries.length === 1 ? "day" : "days"} · {totalWorked}h worked
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
            Save Draft
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
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
    </DashboardLayout>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────────

const th: React.CSSProperties = {
  border: "1px solid #1a5c38",
  padding: "6px 8px",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "2px 6px",
  verticalAlign: "top",
};
