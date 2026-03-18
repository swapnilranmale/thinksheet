import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { getErrorMessage } from "@/lib/api";
import { MonthCalendarPicker } from "@/components/ui/month-calendar-picker";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  CheckCircle2,
  Clock,
  CircleDashed,
  Building2,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { projectTimesheetService, ProjectTeamMember } from "@/services/timesheet";
import { getInitials, fmtDate as fmtDateUtil } from "@/lib/utils";
import { clsx } from "clsx";

const fmtDate = fmtDateUtil;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: typeof CheckCircle2; iconClass: string; statBg: string; statText: string; statCount: string }> = {
  approved: {
    label: "Approved",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
    statBg: "bg-emerald-50 border-emerald-100",
    statText: "text-emerald-700",
    statCount: "text-emerald-900",
  },
  submitted: {
    label: "Submitted",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    icon: CheckCircle2,
    iconClass: "text-blue-500",
    statBg: "bg-blue-50 border-blue-100",
    statText: "text-blue-700",
    statCount: "text-blue-900",
  },
  rejected: {
    label: "Rejected",
    badge: "bg-red-50 text-red-700 border-red-200",
    icon: CircleDashed,
    iconClass: "text-red-500",
    statBg: "bg-red-50 border-red-100",
    statText: "text-red-700",
    statCount: "text-red-900",
  },
  draft: {
    label: "In Progress",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock,
    iconClass: "text-amber-500",
    statBg: "bg-amber-50 border-amber-100",
    statText: "text-amber-700",
    statCount: "text-amber-900",
  },
  not_started: {
    label: "Not Started",
    badge: "bg-slate-50 text-slate-500 border-slate-200",
    icon: CircleDashed,
    iconClass: "text-slate-400",
    statBg: "bg-slate-50 border-slate-100",
    statText: "text-slate-500",
    statCount: "text-slate-700",
  },
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Project meta + sibling project list from navigation state
  const stateMeta = location.state as {
    project_name?: string;
    project_code?: string;
    client_name?: string;
    projectList?: { project_id: string; project_name: string; project_code: string; client_name: string }[];
    currentIndex?: number;
  } | null;

  const projectList   = stateMeta?.projectList   ?? [];
  const currentIndex  = stateMeta?.currentIndex  ?? -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < projectList.length - 1;

  function goToSibling(offset: number) {
    const next = projectList[currentIndex + offset];
    if (!next) return;
    navigate(`/projects/${next.project_id}`, {
      state: { ...stateMeta, project_name: next.project_name, project_code: next.project_code, client_name: next.client_name, currentIndex: currentIndex + offset },
      replace: true,
    });
  }

  const now = new Date();
  // month is 1-indexed (1=Jan) for the API; MonthCalendarPicker uses 0-indexed
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [team, setTeam]   = useState<ProjectTeamMember[]>([]);
  const [projectName, setProjectName] = useState(stateMeta?.project_name || "");
  const [projectCode, setProjectCode] = useState(stateMeta?.project_code || "");
  const [clientName,  setClientName]  = useState(stateMeta?.client_name  || "");
  const [loading, setLoading]         = useState(true);

  // When projectId changes (prev/next nav) refresh name fields from new state
  useEffect(() => {
    setProjectName(stateMeta?.project_name || "");
    setProjectCode(stateMeta?.project_code || "");
    setClientName (stateMeta?.client_name  || "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    projectTimesheetService.getProjectTeam(projectId, month, year)
      .then(res => {
        setTeam(res.data);
        if (res.project) {
          if (!projectName) setProjectName(res.project.project_name);
          if (!projectCode) setProjectCode(res.project.project_code);
          if (!clientName) setClientName(res.project.client_name);
        }
      })
      .catch(err => toast.error(getErrorMessage(err, "Failed to load project team")))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, month, year]);

  // Stats — memoised so they don't recalculate on every render
  const { submitted, inProgress, notStarted } = useMemo(() => ({
    submitted:  team.filter(m => m.status === "submitted").length,
    inProgress: team.filter(m => m.status === "draft").length,
    notStarted: team.filter(m => m.status === "not_started").length,
  }), [team]);

  return (
    <DashboardLayout>
      <div>

        {/* Header */}
        <div className="mb-6">
          {/* Top bar: back + project navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate("/workspace?tab=projects")}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to My Projects
            </button>

            {/* Prev / Next project navigation */}
            {projectList.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 mr-1">
                  {currentIndex + 1} / {projectList.length}
                </span>
                <button
                  onClick={() => goToSibling(-1)}
                  disabled={!hasPrev}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Previous project"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => goToSibling(1)}
                  disabled={!hasNext}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Next project"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#217346]/20 to-[#217346]/10 flex items-center justify-center shrink-0 ring-2 ring-[#217346]/10">
              <FolderOpen className="w-5 h-5 text-[#217346]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  {projectName || "Project"}
                </h1>
                {projectCode && (
                  <Badge variant="outline" className="font-mono text-xs border-slate-200 bg-slate-50 text-slate-500">
                    {projectCode}
                  </Badge>
                )}
              </div>
              {clientName && (
                <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  {clientName}
                </p>
              )}
            </div>

            {/* Month / Year picker — MonthCalendarPicker uses 0-indexed; our state is 1-indexed */}
            <div className="shrink-0">
              <MonthCalendarPicker
                month={month - 1}
                year={year}
                onChange={(m, y) => { setMonth(m + 1); setYear(y); }}
                align="right"
              />
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {/* Total */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-slate-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900">{team.length}</p>
            <p className="text-xs text-slate-400 mt-1">Team members</p>
          </div>

          {/* Submitted */}
          <div className={clsx("border rounded-xl p-5", STATUS_CONFIG.submitted.statBg)}>
            <div className="flex items-center justify-between mb-3">
              <span className={clsx("text-xs font-semibold uppercase tracking-wide", STATUS_CONFIG.submitted.statText)}>Submitted</span>
              <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center">
                <CheckCircle2 className={clsx("w-4 h-4", STATUS_CONFIG.submitted.iconClass)} />
              </div>
            </div>
            <p className={clsx("text-3xl font-bold", STATUS_CONFIG.submitted.statCount)}>{submitted}</p>
            <p className={clsx("text-xs mt-1", STATUS_CONFIG.submitted.statText)}>
              {team.length ? Math.round((submitted / team.length) * 100) : 0}% of team
            </p>
          </div>

          {/* In Progress */}
          <div className={clsx("border rounded-xl p-5", STATUS_CONFIG.draft.statBg)}>
            <div className="flex items-center justify-between mb-3">
              <span className={clsx("text-xs font-semibold uppercase tracking-wide", STATUS_CONFIG.draft.statText)}>In Progress</span>
              <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center">
                <Clock className={clsx("w-4 h-4", STATUS_CONFIG.draft.iconClass)} />
              </div>
            </div>
            <p className={clsx("text-3xl font-bold", STATUS_CONFIG.draft.statCount)}>{inProgress}</p>
            <p className={clsx("text-xs mt-1", STATUS_CONFIG.draft.statText)}>Draft saved</p>
          </div>

          {/* Not Started */}
          <div className={clsx("border rounded-xl p-5", STATUS_CONFIG.not_started.statBg)}>
            <div className="flex items-center justify-between mb-3">
              <span className={clsx("text-xs font-semibold uppercase tracking-wide", STATUS_CONFIG.not_started.statText)}>Not Started</span>
              <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center">
                <CircleDashed className={clsx("w-4 h-4", STATUS_CONFIG.not_started.iconClass)} />
              </div>
            </div>
            <p className={clsx("text-3xl font-bold", STATUS_CONFIG.not_started.statCount)}>{notStarted}</p>
            <p className={clsx("text-xs mt-1", STATUS_CONFIG.not_started.statText)}>No activity</p>
          </div>
        </div>

        {/* Team Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Team Members — {MONTHS[month - 1]} {year}
            </h2>
            <span className="text-xs text-slate-400">{team.length} member{team.length !== 1 ? "s" : ""}</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading team data...</span>
            </div>
          ) : team.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Users className="w-10 h-10 mb-3 opacity-20" />
              <p className="font-medium text-slate-500">No team members found</p>
              <p className="text-sm mt-1">No employees are mapped to this project</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-400 text-xs">Employee</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-400 text-xs">Designation</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-400 text-xs">Status</th>
                  <th className="text-right px-5 py-3 font-medium text-slate-400 text-xs">Entries</th>
                  <th className="text-right px-5 py-3 font-medium text-slate-400 text-xs">Worked Hrs</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-400 text-xs">Submitted At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {team.map(member => {
                  const cfg = STATUS_CONFIG[member.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <tr key={member.employee_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#217346]/10 flex items-center justify-center text-xs font-bold text-[#217346] shrink-0">
                            {getInitials(member.employee_name)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 leading-tight">{member.employee_name}</p>
                            <p className="text-xs text-slate-400 leading-tight">{member.official_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{member.designation || "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className={clsx(
                          "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
                          cfg.badge
                        )}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-medium text-slate-700">
                        {member.entries_count > 0 ? member.entries_count : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-medium text-slate-700">
                        {member.total_worked > 0
                          ? <span>{member.total_worked}h</span>
                          : <span className="text-slate-300">—</span>
                        }
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{fmtDate(member.submitted_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
