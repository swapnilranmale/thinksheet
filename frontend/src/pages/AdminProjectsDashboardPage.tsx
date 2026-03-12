import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { getErrorMessage } from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  Users,
  CheckCircle2,
  Clock,
  CircleDashed,
  Building2,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import {
  projectTimesheetService,
  managerTimesheetService,
  ProjectTeamMember,
  ProjectInfo,
  Timesheet,
} from "@/services/timesheet";
import { clsx } from "clsx";

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function getDaysInMonth(year: number, month: number): Date[] {
  // month is 1-based
  const days: Date[] = [];
  const total = new Date(year, month, 0).getDate();
  for (let d = 1; d <= total; d++) days.push(new Date(year, month - 1, d));
  return days;
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type DayStatus = "Working" | "On leave" | "Holiday" | "Extra Working";

function statusRowBg(status: DayStatus, today: boolean): string {
  if (today) return "bg-amber-50";
  switch (status) {
    case "Holiday": return "bg-red-50";
    case "On leave": return "bg-orange-50";
    case "Extra Working": return "bg-blue-50";
    default: return "";
  }
}

function statusBadgeClass(status: DayStatus): string {
  switch (status) {
    case "Working": return "bg-green-100 text-green-700 border-green-200";
    case "Holiday": return "bg-red-100 text-red-600 border-red-200";
    case "On leave": return "bg-orange-100 text-orange-600 border-orange-200";
    case "Extra Working": return "bg-blue-100 text-blue-600 border-blue-200";
    default: return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function isToday(d: Date) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

// Table cell styles (match employee view)
const th: React.CSSProperties = { padding: "8px 10px", fontWeight: 600, fontSize: 11, letterSpacing: "0.04em", borderBottom: "1px solid rgba(255,255,255,0.15)" };
const td: React.CSSProperties = { padding: "5px 10px", borderBottom: "1px solid #f1f5f9" };
const thTotal: React.CSSProperties = { padding: "8px 10px", fontWeight: 700 };

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  submitted: {
    label: "Submitted",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  draft: {
    label: "In Progress",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock,
  },
  not_started: {
    label: "Not Started",
    badge: "bg-slate-50 text-slate-500 border-slate-200",
    icon: CircleDashed,
  },
};

// ── Month-Year Calendar Picker ────────────────────────────────────────────────

interface MonthPickerProps {
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
}

function MonthPicker({ month, year, onChange }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [pickYear, setPickYear] = useState(year);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => { if (open) setPickYear(year); }, [open, year]);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={clsx(
          "flex items-center gap-2 h-9 px-3.5 rounded-lg border text-sm font-medium transition-all",
          open
            ? "border-[#217346] bg-[#217346]/5 text-[#217346]"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        )}
      >
        <CalendarDays className="w-4 h-4 shrink-0" />
        <span>{MONTHS[month - 1]} {year}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-72 bg-white border border-slate-200 rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setPickYear(y => y - 1)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-slate-800">{pickYear}</span>
            <button onClick={() => setPickYear(y => y + 1)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {MONTH_SHORT.map((m, i) => {
              const mNum = i + 1;
              const isSelected = mNum === month && pickYear === year;
              const isNow = mNum === currentMonth && pickYear === currentYear;
              return (
                <button
                  key={m}
                  onClick={() => { onChange(mNum, pickYear); setOpen(false); }}
                  className={clsx(
                    "py-2 rounded-lg text-xs font-medium transition-all",
                    isSelected ? "bg-[#217346] text-white shadow-sm"
                      : isNow ? "bg-[#217346]/10 text-[#217346] font-semibold"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {m}
                </button>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
            <button onClick={() => { onChange(currentMonth, currentYear); setOpen(false); }} className="flex-1 py-1.5 text-xs font-medium text-[#217346] hover:bg-[#217346]/5 rounded-md">
              This Month
            </button>
            <button
              onClick={() => {
                const prev = currentMonth === 1 ? 12 : currentMonth - 1;
                const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
                onChange(prev, prevY); setOpen(false);
              }}
              className="flex-1 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 rounded-md"
            >
              Last Month
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Employee Timesheet Grid (read-only) ───────────────────────────────────────

interface EmployeeTimesheetViewProps {
  member: ProjectTeamMember;
  projectName: string;
  clientName: string;
  month: number;
  year: number;
  onBack: () => void;
}

function EmployeeTimesheetView({ member, projectName, clientName, month, year, onBack }: EmployeeTimesheetViewProps) {
  const [loading, setLoading] = useState(true);
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);

  useEffect(() => {
    setLoading(true);
    managerTimesheetService.getEmployeeTimesheet(member.employee_id, month, year)
      .then(res => setTimesheet(res.data))
      .catch(err => toast.error(getErrorMessage(err, "Failed to load timesheet")))
      .finally(() => setLoading(false));
  }, [member.employee_id, month, year]);

  const days = getDaysInMonth(year, month);

  // Build cell map from entries
  const cellMap: Record<string, { status: DayStatus; tasks: string; billable_hours: number }> = {};
  if (timesheet?.entries) {
    for (const e of timesheet.entries) {
      const key = e.date.split("T")[0];
      cellMap[key] = {
        status: e.status as DayStatus,
        tasks: Array.isArray(e.tasks) ? e.tasks.join("\n") : (e.tasks || ""),
        billable_hours: e.billable_hours,
      };
    }
  }

  function getCell(key: string) {
    return cellMap[key] ?? { status: "Working" as DayStatus, tasks: "", billable_hours: 0 };
  }

  const totalBillable = Object.values(cellMap).reduce((s, c) => s + (c.billable_hours || 0), 0);
  const workingDays = Object.values(cellMap).filter(c => c.status === "Working" || c.status === "Extra Working").length;
  const isSubmitted = member.status === "submitted";

  return (
    <div className="flex flex-col gap-4">
      {/* Back breadcrumb */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {projectName}
      </button>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-[#217346]/10 flex items-center justify-center text-base font-bold text-[#217346] shrink-0">
          {getInitials(member.employee_name)}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-slate-900">{member.employee_name}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {member.designation || "—"} · {projectName}
            {clientName ? ` · ${clientName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSubmitted && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> Submitted
            </span>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border rounded-lg px-4 py-3">
          <p className="text-xs text-slate-500">Total Billable Hours</p>
          <p className="text-xl font-bold text-blue-600 mt-0.5">{totalBillable}h</p>
        </div>
        <div className="bg-white border rounded-lg px-4 py-3">
          <p className="text-xs text-slate-500">Working Days</p>
          <p className="text-xl font-bold text-green-600 mt-0.5">{workingDays}</p>
        </div>
        <div className="bg-white border rounded-lg px-4 py-3">
          <p className="text-xs text-slate-500">Total Worked Hours</p>
          <p className="text-xl font-bold mt-0.5">{member.total_worked > 0 ? `${member.total_worked}h` : `${totalBillable}h`}</p>
        </div>
      </div>

      {/* Submitted banner */}
      {isSubmitted && member.submitted_at && (
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">
              Timesheet submitted for {MONTHS[month - 1]} {year}
            </p>
            <p className="text-xs text-green-600">
              Submitted on {fmtDate(member.submitted_at)}
            </p>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading timesheet…</span>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden flex flex-col">
          <div className="overflow-auto">
            <table className="w-full text-xs" style={{ borderCollapse: "collapse", minWidth: 780 }}>
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
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${statusBadgeClass(cell.status)}`}>
                          {cell.status}
                        </span>
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
                      <td style={{ ...td, padding: "5px 8px" }}>
                        {cell.tasks ? (
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
                        )}
                      </td>

                      {/* Billable Hours */}
                      <td style={td} className="text-center">
                        <span className={`font-mono font-semibold ${cell.billable_hours > 0 ? "text-gray-800" : "text-gray-400"}`}>
                          {cell.billable_hours}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {/* Totals row */}
                <tr className="bg-[#217346] text-white font-bold text-xs sticky bottom-0" style={{ borderTop: "2px solid #185c37" }}>
                  <td style={thTotal} colSpan={5} className="text-right pr-4 uppercase tracking-wider text-[11px]">
                    Total Worked Hours
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
  );
}

// ── Per-project data ──────────────────────────────────────────────────────────

interface ProjectMeta {
  project_name: string;
  project_code: string;
  client_name: string;
}

interface ProjectData {
  projectId: string;
  meta: ProjectMeta | null;
  projectInfo: ProjectInfo | null;
  team: ProjectTeamMember[];
  loading: boolean;
  error: string | null;
}

// ── Project Section ───────────────────────────────────────────────────────────

interface ProjectSectionProps {
  pd: ProjectData;
  month: number;
  year: number;
  onViewEmployee: (member: ProjectTeamMember, projectName: string, clientName: string) => void;
}

function ProjectSection({ pd, month, year, onViewEmployee }: ProjectSectionProps) {
  const submitted  = pd.team.filter(m => m.status === "submitted").length;
  const inProgress = pd.team.filter(m => m.status === "draft").length;
  const notStarted = pd.team.filter(m => m.status === "not_started").length;
  const total = pd.team.length;

  const projectName = pd.projectInfo?.project_name || pd.meta?.project_name || pd.projectId;
  const projectCode = pd.projectInfo?.project_code || pd.meta?.project_code || "";
  const clientName  = pd.projectInfo?.client_name  || pd.meta?.client_name  || "";

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Project header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#217346]/10 flex items-center justify-center shrink-0">
            <FolderOpen className="w-4 h-4 text-[#217346]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-slate-900 truncate">{projectName}</h2>
              {projectCode && (
                <Badge variant="outline" className="font-mono text-xs border-slate-200 bg-white text-slate-500 shrink-0">
                  {projectCode}
                </Badge>
              )}
            </div>
            {clientName && (
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <Building2 className="w-3 h-3 shrink-0" />
                {clientName}
              </p>
            )}
          </div>

          {!pd.loading && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                <CheckCircle2 className="w-3 h-3" /> {submitted}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                <Clock className="w-3 h-3" /> {inProgress}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-200">
                <CircleDashed className="w-3 h-3" /> {notStarted}
              </span>
              <span className="text-xs text-slate-400 ml-1">{total} member{total !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {!pd.loading && total > 0 && (
        <div className="h-1 flex">
          <div className="bg-emerald-400 transition-all" style={{ width: `${(submitted / total) * 100}%` }} />
          <div className="bg-amber-300 transition-all" style={{ width: `${(inProgress / total) * 100}%` }} />
          <div className="bg-slate-100 flex-1" />
        </div>
      )}

      {/* Body */}
      {pd.loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading team data…</span>
        </div>
      ) : pd.error ? (
        <div className="flex items-center justify-center py-12 text-red-400 text-sm">
          {pd.error}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <Users className="w-8 h-8 mb-2 opacity-20" />
          <p className="text-sm font-medium text-slate-500">No team members found</p>
          <p className="text-xs mt-0.5 text-slate-400">No employees mapped to this project for {MONTHS[month - 1]} {year}</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 border-b border-slate-100">
            <tr>
              <th className="text-left px-5 py-2.5 font-medium text-slate-400 text-xs">Employee</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-400 text-xs">Designation</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-400 text-xs">Status</th>
              <th className="text-right px-4 py-2.5 font-medium text-slate-400 text-xs">Entries</th>
              <th className="text-right px-4 py-2.5 font-medium text-slate-400 text-xs">Worked Hrs</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-400 text-xs">Submitted At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {pd.team.map(member => {
              const cfg = STATUS_CONFIG[member.status];
              const StatusIcon = cfg.icon;
              return (
                <tr
                  key={member.employee_id}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  onClick={() => onViewEmployee(member, projectName, clientName)}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#217346]/10 flex items-center justify-center text-xs font-bold text-[#217346] shrink-0">
                        {getInitials(member.employee_name)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 leading-tight text-sm hover:text-[#217346] transition-colors">
                          {member.employee_name}
                        </p>
                        <p className="text-xs text-slate-400 leading-tight">{member.official_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{member.designation || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={clsx("inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border", cfg.badge)}>
                      <StatusIcon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                    {member.entries_count > 0 ? member.entries_count : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                    {member.total_worked > 0 ? <span>{member.total_worked}h</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(member.submitted_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminProjectsDashboardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const projectIdsParam = searchParams.get("projects") || "";
  const projectIds = projectIdsParam.split(",").map(s => s.trim()).filter(Boolean);

  const now = new Date();
  const [month, setMonth] = useState(
    parseInt(searchParams.get("month") || "") || (now.getMonth() + 1)
  );
  const [year, setYear] = useState(
    parseInt(searchParams.get("year") || "") || now.getFullYear()
  );

  const stateMeta = (location.state || {}) as Record<string, { project_name: string; project_code: string; client_name: string }>;

  const [projects, setProjects] = useState<ProjectData[]>(() =>
    projectIds.map(id => ({
      projectId: id,
      meta: stateMeta[id] ?? null,
      projectInfo: null,
      team: [],
      loading: true,
      error: null,
    }))
  );

  // Employee drill-down state
  const [selectedMember, setSelectedMember] = useState<{
    member: ProjectTeamMember;
    projectName: string;
    clientName: string;
  } | null>(null);

  function handleMonthChange(m: number, y: number) {
    setMonth(m);
    setYear(y);
    setSelectedMember(null); // reset drill-down on month change
  }

  useEffect(() => {
    setProjects(projectIds.map(id => ({
      projectId: id,
      meta: stateMeta[id] ?? null,
      projectInfo: null,
      team: [],
      loading: true,
      error: null,
    })));
    setSelectedMember(null);

    projectIds.forEach(id => {
      projectTimesheetService.getProjectTeam(id, month, year)
        .then(res => {
          setProjects(prev => prev.map(p =>
            p.projectId === id
              ? { ...p, projectInfo: res.project ?? null, team: res.data, loading: false, error: null }
              : p
          ));
        })
        .catch(err => {
          setProjects(prev => prev.map(p =>
            p.projectId === id
              ? { ...p, loading: false, error: getErrorMessage(err, "Failed to load") }
              : p
          ));
          toast.error("Failed to load project");
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, projectIdsParam]);

  const allTeam = projects.flatMap(p => p.team);
  const totalSubmitted  = allTeam.filter(m => m.status === "submitted").length;
  const totalInProgress = allTeam.filter(m => m.status === "draft").length;
  const totalNotStarted = allTeam.filter(m => m.status === "not_started").length;
  const anyLoading = projects.some(p => p.loading);

  if (projectIds.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-24 text-slate-400">
          <FolderOpen className="w-12 h-12 mb-3 opacity-20" />
          <p className="font-medium text-slate-600">No projects selected</p>
          <button onClick={() => navigate("/timesheet/mapping?tab=projects")} className="mt-4 text-sm text-[#217346] underline">
            Go back to Projects
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const firstProject = projects[0];
  const pageTitle = projectIds.length === 1
    ? (firstProject?.projectInfo?.project_name || firstProject?.meta?.project_name || "Project Timesheet")
    : "Project Timesheet Status";
  const pageSubtitle = projectIds.length === 1 && (firstProject?.projectInfo?.client_name || firstProject?.meta?.client_name)
    ? `1 project · ${firstProject.projectInfo?.client_name || firstProject.meta?.client_name}`
    : `${projectIds.length} project${projectIds.length !== 1 ? "s" : ""}`;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">

        {/* Back */}
        <button
          onClick={() => {
            if (selectedMember) { setSelectedMember(null); return; }
            navigate("/timesheet/mapping?tab=projects");
          }}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {selectedMember ? `Back to ${selectedMember.projectName}` : "Back to Projects"}
        </button>

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {selectedMember ? selectedMember.member.employee_name : pageTitle}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {selectedMember
                ? `${selectedMember.member.designation || "—"} · ${selectedMember.projectName}`
                : pageSubtitle}
            </p>
          </div>
          <MonthPicker month={month} year={year} onChange={handleMonthChange} />
        </div>

        {/* Employee timesheet drill-down */}
        {selectedMember ? (
          <EmployeeTimesheetView
            member={selectedMember.member}
            projectName={selectedMember.projectName}
            clientName={selectedMember.clientName}
            month={month}
            year={year}
            onBack={() => setSelectedMember(null)}
          />
        ) : (
          <>
            {/* Summary stats bar (multi-project) */}
            {projectIds.length > 1 && (
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Users className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-medium text-slate-500">Total Members</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{anyLoading ? "—" : allTeam.length}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-medium text-emerald-700">Submitted</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-900">{anyLoading ? "—" : totalSubmitted}</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-medium text-amber-700">In Progress</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-900">{anyLoading ? "—" : totalInProgress}</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <CircleDashed className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-medium text-slate-500">Not Started</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-700">{anyLoading ? "—" : totalNotStarted}</p>
                </div>
              </div>
            )}

            {/* Per-project sections */}
            <div className="space-y-5">
              {projects.map(pd => (
                <ProjectSection
                  key={pd.projectId}
                  pd={pd}
                  month={month}
                  year={year}
                  onViewEmployee={(member, projectName, clientName) =>
                    setSelectedMember({ member, projectName, clientName })
                  }
                />
              ))}
            </div>
          </>
        )}

      </div>
    </DashboardLayout>
  );
}
