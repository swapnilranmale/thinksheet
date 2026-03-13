import { getErrorMessage } from "@/lib/api";
import { getInitials, avatarColor, fmtDate } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
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
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  Users,
  Eye,
  Calendar,
  Loader2,
  FolderOpen,
  Building2,
  CircleDashed,
} from "lucide-react";
import { toast } from "sonner";
import {
  managerTimesheetService,
  projectTimesheetService,
  streamlineService,
  ResourceMasterProject,
  ProjectTeamMember,
  Timesheet,
} from "@/services/timesheet";

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const CURRENT_MONTH = NOW.getMonth();

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "submitted" | "draft" | "not_started" }) {
  if (status === "submitted")
    return <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 text-xs"><CheckCircle2 className="w-3 h-3" />Submitted</Badge>;
  if (status === "draft")
    return <Badge variant="outline" className="gap-1 text-xs text-orange-600 border-orange-200"><Clock className="w-3 h-3" />In Progress</Badge>;
  return <Badge variant="secondary" className="text-xs text-slate-500 gap-1"><CircleDashed className="w-3 h-3" />Not Started</Badge>;
}

// ── Client group type ─────────────────────────────────────────────────────────

interface ClientGroup {
  client_id: string;
  client_name: string;
  projects: ResourceMasterProject[];
}

// ── View enum ─────────────────────────────────────────────────────────────────

type View = "clients" | "projects" | "resources" | "timesheet";

// ── Component ─────────────────────────────────────────────────────────────────

export default function ManagerTimesheetReviewPage() {
  const [view, setView] = useState<View>("clients");
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);

  // Data
  const [clients, setClients] = useState<ClientGroup[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  const [selectedClient, setSelectedClient] = useState<ClientGroup | null>(null);

  const [selectedProject, setSelectedProject] = useState<ResourceMasterProject | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectTeamMember[]>([]);
  const [loadingProject, setLoadingProject] = useState(false);

  const [viewingMember, setViewingMember] = useState<ProjectTeamMember | null>(null);
  const [viewingTimesheet, setViewingTimesheet] = useState<Timesheet | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Load clients ─────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingClients(true);
        const res = await streamlineService.getMyResourceProjects();
        const projects = res.data ?? [];
        if (cancelled) return;
        const map = new Map<string, ClientGroup>();
        for (const p of projects) {
          const key = p.client_id || p.client_name;
          if (!map.has(key)) map.set(key, { client_id: key, client_name: p.client_name, projects: [] });
          map.get(key)!.projects.push(p);
        }
        setClients(Array.from(map.values()));
      } catch (err) {
        if (!cancelled) toast.error(getErrorMessage(err, "Failed to load projects"));
      } finally {
        if (!cancelled) setLoadingClients(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Load project team ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedProject) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingProject(true);
        const res = await projectTimesheetService.getProjectTeam(
          selectedProject.project_id, selectedMonth + 1, selectedYear
        );
        if (!cancelled) setProjectMembers(res.data);
      } catch (err) {
        if (!cancelled) toast.error(getErrorMessage(err, "Failed to load team"));
      } finally {
        if (!cancelled) setLoadingProject(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedProject, selectedMonth, selectedYear]);

  // Memoised timesheet computations — must be called before any early returns
  const timesheetStats = useMemo(() => {
    const entries = [...(viewingTimesheet?.entries ?? [])].sort((a, b) => a.date.localeCompare(b.date));
    return {
      entries,
      totalWorked:   entries.reduce((s, e) => s + (e.worked_hours   || 0), 0),
      totalBillable: entries.reduce((s, e) => s + (e.billable_hours || 0), 0),
      totalActual:   entries.reduce((s, e) => s + (e.actual_hours   || 0), 0),
      completed:     entries.filter((e) => e.completed_task).length,
      unplanned:     entries.filter((e) => e.unplanned_task).length,
    };
  }, [viewingTimesheet]);

  // ── Load individual timesheet ─────────────────────────────────────────────

  async function openTimesheet(member: ProjectTeamMember) {
    setViewingMember(member);
    setDetailLoading(true);
    setView("timesheet");
    try {
      const res = await managerTimesheetService.getEmployeeTimesheet(
        member.employee_id, selectedMonth + 1, selectedYear, selectedProject?.project_id
      );
      setViewingTimesheet(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load timesheet"));
      setView("resources");
    } finally {
      setDetailLoading(false);
    }
  }

  function goToClients() { setView("clients"); setSelectedClient(null); setSelectedProject(null); }
  function goToProjects(client: ClientGroup) { setSelectedClient(client); setView("projects"); }
  function goToResources(project: ResourceMasterProject) { setSelectedProject(project); setView("resources"); }
  function goBackToResources() { setView("resources"); setViewingMember(null); setViewingTimesheet(null); }

  // ── Month/Year selector (shared) ──────────────────────────────────────────

  function MonthYearPicker() {
    return (
      <div className="flex items-center gap-2">
        <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
          <SelectTrigger className="w-36 h-9">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{MONTHS[selectedMonth]}</span>
            </div>
          </SelectTrigger>
          <SelectContent searchable>
            {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-0.5 border rounded-lg px-1 h-9">
          <button onClick={() => setSelectedYear(y => y - 1)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-slate-700 w-12 text-center select-none">{selectedYear}</span>
          <button onClick={() => setSelectedYear(y => y + 1)} disabled={selectedYear >= CURRENT_YEAR + 1} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-40">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Breadcrumb ────────────────────────────────────────────────────────────

  function Breadcrumb() {
    return (
      <div className="flex items-center gap-1.5 text-sm mb-5">
        <button onClick={goToClients} className={view === "clients" ? "font-semibold text-slate-800" : "text-slate-400 hover:text-slate-700 transition-colors"}>
          Timesheets
        </button>
        {(view === "projects" || view === "resources" || view === "timesheet") && selectedClient && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <button onClick={() => setView("projects")} className={view === "projects" ? "font-semibold text-slate-800" : "text-slate-400 hover:text-slate-700 transition-colors truncate max-w-[140px]"}>
              {selectedClient.client_name}
            </button>
          </>
        )}
        {(view === "resources" || view === "timesheet") && selectedProject && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <button onClick={goBackToResources} className={view === "resources" ? "font-semibold text-slate-800" : "text-slate-400 hover:text-slate-700 transition-colors truncate max-w-[140px]"}>
              {selectedProject.project_name}
            </button>
          </>
        )}
        {view === "timesheet" && viewingMember && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span className="font-semibold text-slate-800 truncate max-w-[160px]">{viewingMember.employee_name}</span>
          </>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW 1: Clients
  // ════════════════════════════════════════════════════════════════════════════

  if (view === "clients") {
    return (
      <DashboardLayout>
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Employee Timesheets</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                {loadingClients ? "Loading..." : `${clients.length} client${clients.length !== 1 ? "s" : ""} · ${clients.reduce((s, c) => s + c.projects.length, 0)} projects`}
              </p>
            </div>
            <MonthYearPicker />
          </div>

          {loadingClients ? (
            <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /><span>Loading...</span>
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
              <Building2 className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-medium text-slate-600">No clients found</p>
              <p className="text-sm">Sync to populate project data</p>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto flex-1 flex flex-col gap-2">
                {clients.map((client) => (
                  <button
                    key={client.client_id}
                    onClick={() => goToProjects(client)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-[#217346]/30 hover:shadow-sm transition-all text-left group"
                  >
                    <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center shrink-0 ring-2 ring-blue-100">
                      <Building2 className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 group-hover:text-[#217346] transition-colors">{client.client_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {client.projects.length} project{client.projects.length !== 1 ? "s" : ""} · {client.projects.reduce((s, p) => s + p.resource_count, 0)} resources
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#217346] transition-colors shrink-0" />
                  </button>
                ))}
              </div>
              <div className="shrink-0 pt-2 px-1">
                <span className="text-xs text-slate-400">
                  Showing <strong>{clients.length}</strong> client{clients.length !== 1 ? "s" : ""} · Page <strong>1</strong> of <strong>1</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW 2: Projects of a client
  // ════════════════════════════════════════════════════════════════════════════

  if (view === "projects" && selectedClient) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex flex-col min-h-0">
          <Breadcrumb />
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{selectedClient.client_name}</h1>
              <p className="text-slate-500 text-sm mt-0.5">{selectedClient.projects.length} project{selectedClient.projects.length !== 1 ? "s" : ""}</p>
            </div>
            <MonthYearPicker />
          </div>

          <div className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto flex-1 flex flex-col gap-2">
              {selectedClient.projects.map((project) => (
                <button
                  key={project.project_id}
                  onClick={() => goToResources(project)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-[#217346]/30 hover:shadow-sm transition-all text-left group"
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#217346]/20 to-[#217346]/10 flex items-center justify-center shrink-0 ring-2 ring-[#217346]/10">
                    <FolderOpen className="w-5 h-5 text-[#217346]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 group-hover:text-[#217346] transition-colors">{project.project_name}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{project.resource_count} resource{project.resource_count !== 1 ? "s" : ""}</span>
                      {project.start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(project.start_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          {" – "}
                          {project.end_date ? new Date(project.end_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "ongoing"}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#217346] transition-colors shrink-0" />
                </button>
              ))}
            </div>
            <div className="shrink-0 pt-2 px-1">
              <span className="text-xs text-slate-400">
                Showing <strong>{selectedClient.projects.length}</strong> project{selectedClient.projects.length !== 1 ? "s" : ""} · Page <strong>1</strong> of <strong>1</strong>
              </span>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW 3: Resources of a project
  // ════════════════════════════════════════════════════════════════════════════

  if (view === "resources" && selectedProject) {
    const submittedCount  = projectMembers.filter((m) => m.status === "submitted").length;
    const draftCount      = projectMembers.filter((m) => m.status === "draft").length;
    const notStartedCount = projectMembers.filter((m) => m.status === "not_started").length;

    return (
      <DashboardLayout>
        <div className="flex-1 flex flex-col min-h-0">
          <Breadcrumb />
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{selectedProject.project_name}</h1>
              <p className="text-slate-500 text-sm mt-0.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />{selectedProject.client_name}
              </p>
            </div>
            <MonthYearPicker />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Submitted",   count: submittedCount,  icon: CheckCircle2, iconCls: "text-green-500",  bg: "bg-green-50",  text: "text-green-700" },
              { label: "In Progress", count: draftCount,      icon: Clock,        iconCls: "text-orange-500", bg: "bg-orange-50", text: "text-orange-700" },
              { label: "Not Started", count: notStartedCount, icon: CircleDashed, iconCls: "text-slate-400",  bg: "bg-slate-50",  text: "text-slate-600" },
            ].map(({ label, count, icon: Icon, iconCls, bg, text }) => (
              <div key={label} className={`flex items-center gap-3 p-4 rounded-xl border ${bg}`}>
                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                  <Icon className={`w-4.5 h-4.5 ${iconCls}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${text}`}>{count}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Resource list */}
          {loadingProject ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /><span>Loading resources...</span>
            </div>
          ) : projectMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
              <Users className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-medium text-slate-600">No resources found</p>
              <p className="text-sm">No employees mapped to this project</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#217346] text-white text-xs">
                      <th className="px-4 py-3 text-left font-semibold w-8">#</th>
                      <th className="px-4 py-3 text-left font-semibold">Employee</th>
                      <th className="px-4 py-3 text-center font-semibold">Entries</th>
                      <th className="px-4 py-3 text-center font-semibold">Hours Logged</th>
                      <th className="px-4 py-3 text-left font-semibold">Last Submitted</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectMembers.map((member, idx) => (
                      <tr key={member.employee_id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-400 text-xs font-mono">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(member.employee_name)}`}>
                              {getInitials(member.employee_name)}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{member.employee_name}</p>
                              <p className="text-xs text-slate-400">{member.unique_id} · {member.designation}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {member.entries_count > 0 ? <span className="font-medium">{member.entries_count}</span> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {member.total_worked > 0 ? <span className="font-medium">{member.total_worked}h</span> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {member.submitted_at
                            ? new Date(member.submitted_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                            : <span className="text-slate-300">Never</span>}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={member.status} /></td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" disabled={member.status === "not_started"} onClick={() => openTimesheet(member)}>
                            <Eye className="w-3 h-3" />View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="shrink-0 border-t border-slate-100 px-5 py-3 flex items-center justify-between bg-white">
                <span className="text-xs text-slate-400">
                  Showing <strong>{projectMembers.length}</strong> resource{projectMembers.length !== 1 ? "s" : ""} · Page <strong>1</strong> of <strong>1</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW 4: Individual timesheet detail
  // ════════════════════════════════════════════════════════════════════════════

  if (view === "timesheet" && viewingMember) {
    const { entries, totalBillable } = timesheetStats;
    const workingDays = entries.filter(e => e.status === "Working" || e.status === "Extra Working").length;

    return (
      <DashboardLayout>
        <div className="flex-1 flex flex-col min-h-0">
          <Breadcrumb />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FolderOpen className="w-5 h-5 text-[#217346]" />
              <div>
                <h1 className="text-lg font-bold text-slate-900">{viewingMember.employee_name}</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {viewingMember.designation} · {viewingMember.unique_id} · {MONTHS[selectedMonth]} {selectedYear}
                </p>
              </div>
            </div>
            <StatusBadge status={viewingMember.status} />
          </div>

          {detailLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /><span>Loading timesheet...</span>
            </div>
          ) : (
            <>
              {/* Summary cards — matching employee view */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
                  <p className="text-xs text-slate-400 font-medium">Total Billable Hours</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{totalBillable}h</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
                  <p className="text-xs text-slate-400 font-medium">Working Days</p>
                  <p className="text-2xl font-bold text-[#217346] mt-1">{workingDays}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
                  <p className="text-xs text-slate-400 font-medium">Total Worked Hours</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{totalBillable}h</p>
                </div>
              </div>

              {/* Entries table — same as employee view */}
              {entries.length === 0 ? (
                <div className="flex-1 border rounded-lg flex flex-col items-center justify-center py-16 text-slate-400 bg-white">
                  <Clock className="w-10 h-10 mb-3 opacity-25" />
                  <p className="font-medium">No entries for this month</p>
                  <p className="text-sm">Employee hasn't filled in any data yet</p>
                </div>
              ) : (
                <div className="flex-1 border border-slate-200 rounded-xl overflow-auto bg-white">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#217346] text-white text-xs">
                        <th className="border border-[#1a5c38] px-3 py-2.5 text-left font-semibold w-16">Sr No</th>
                        <th className="border border-[#1a5c38] px-3 py-2.5 text-left font-semibold w-24">Status</th>
                        <th className="border border-[#1a5c38] px-3 py-2.5 text-left font-semibold w-32">Date</th>
                        <th className="border border-[#1a5c38] px-3 py-2.5 text-left font-semibold w-28">Day</th>
                        <th className="border border-[#1a5c38] px-3 py-2.5 text-left font-semibold">Task Description</th>
                        <th className="border border-[#1a5c38] px-3 py-2.5 text-right font-semibold w-32">Billable Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, idx) => {
                        const d = new Date(entry.date);
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        const isHoliday = entry.status === "Holiday";
                        const rowBg = isHoliday ? "bg-red-50/50" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/50";
                        return (
                          <tr key={idx} className={`${rowBg} hover:bg-blue-50/50 transition-colors`}>
                            <td className="border border-gray-200 px-3 py-2.5 text-slate-400 font-mono text-xs">{idx + 1}</td>
                            <td className="border border-gray-200 px-3 py-2.5">
                              {isHoliday ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-600">Holiday</span>
                              ) : entry.status === "Extra Working" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-600">Extra Working</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">Working</span>
                              )}
                            </td>
                            <td className={`border border-gray-200 px-3 py-2.5 whitespace-nowrap font-medium text-sm ${isWeekend ? "text-red-500" : "text-slate-700"}`}>
                              {d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                            </td>
                            <td className={`border border-gray-200 px-3 py-2.5 font-medium text-sm ${isWeekend ? "text-red-500" : "text-slate-500"}`}>
                              {d.toLocaleDateString("en-IN", { weekday: "long" })}
                            </td>
                            <td className="border border-gray-200 px-3 py-2.5 text-sm">
                              {!(entry.tasks?.length) ? <span className="text-gray-300">—</span>
                                : entry.tasks.length === 1 ? <span className="text-slate-700">{entry.tasks[0]}</span>
                                : <ul className="space-y-0.5">{entry.tasks.map((t, ti) => (
                                    <li key={ti} className="flex items-start gap-1.5 text-slate-700"><span className="text-slate-400 shrink-0">▸</span><span>{t}</span></li>
                                  ))}</ul>}
                            </td>
                            <td className="border border-gray-200 px-3 py-2.5 text-right font-mono font-semibold text-sm text-slate-700">{entry.billable_hours ?? 0}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-[#217346] text-white font-semibold sticky bottom-0">
                        <td colSpan={5} className="border border-[#1a5c38] px-3 py-2.5 text-right text-xs uppercase tracking-wider">Total Billable Hours</td>
                        <td className="border border-[#1a5c38] px-3 py-2.5 text-right font-mono font-bold text-sm">{totalBillable}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </DashboardLayout>
    );
  }

  return null;
}
