import { getErrorMessage } from "@/lib/api";
import { getInitials, avatarColor, fmtDate } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
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
  ThumbsUp,
  ThumbsDown,
  XCircle,
  AlertCircle,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  managerTimesheetService,
  projectTimesheetService,
  projectSubmissionService,
  streamlineService,
  ResourceMasterProject,
  ProjectTeamMember,
  ProjectSubmission,
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

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1 text-xs"><ThumbsUp className="w-3 h-3" />Approved</Badge>;
  if (status === "rejected")
    return <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 text-xs"><XCircle className="w-3 h-3" />Rejected</Badge>;
  if (status === "submitted")
    return <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1 text-xs"><CheckCircle2 className="w-3 h-3" />Submitted</Badge>;
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

  // Approve / Reject state
  const [approving, setApproving] = useState(false);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Project submission state
  const [projectSubmission, setProjectSubmission] = useState<ProjectSubmission | null>(null);
  const [submitProjectOpen, setSubmitProjectOpen] = useState(false);
  const [submittingProject, setSubmittingProject] = useState(false);

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

  // ── Load project submission status ──────────────────────────────────────

  useEffect(() => {
    if (!selectedProject) { setProjectSubmission(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await projectSubmissionService.getStatus(
          selectedProject.project_id, selectedMonth + 1, selectedYear
        );
        if (!cancelled) setProjectSubmission(res.data);
      } catch {
        if (!cancelled) setProjectSubmission(null);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedProject, selectedMonth, selectedYear, projectMembers]);

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

  // ── Approve / Reject handlers ──────────────────────────────────────────

  async function handleApprove() {
    if (!viewingTimesheet) return;
    setApproveConfirmOpen(false);
    setApproving(true);
    try {
      const res = await managerTimesheetService.approve(viewingTimesheet._id);
      setViewingTimesheet(res.data);
      // Also update the member status in the resources list
      if (viewingMember) {
        setViewingMember({ ...viewingMember, status: "approved" });
        setProjectMembers(prev => prev.map(m =>
          m.employee_id === viewingMember.employee_id ? { ...m, status: "approved" as const } : m
        ));
      }
      toast.success("Timesheet approved successfully");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to approve timesheet"));
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    if (!viewingTimesheet || !rejectReason.trim()) return;
    setRejectDialogOpen(false);
    setApproving(true);
    try {
      const res = await managerTimesheetService.reject(viewingTimesheet._id, rejectReason.trim());
      setViewingTimesheet(res.data);
      if (viewingMember) {
        setViewingMember({ ...viewingMember, status: "rejected" });
        setProjectMembers(prev => prev.map(m =>
          m.employee_id === viewingMember.employee_id ? { ...m, status: "rejected" as const } : m
        ));
      }
      toast.success("Timesheet rejected");
      setRejectReason("");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to reject timesheet"));
    } finally {
      setApproving(false);
    }
  }

  // ── Submit Project handler ──────────────────────────────────────────────

  async function handleSubmitProject() {
    if (!selectedProject) return;
    setSubmitProjectOpen(false);
    setSubmittingProject(true);
    try {
      const res = await projectSubmissionService.submit(
        selectedProject.project_id,
        selectedMonth + 1,
        selectedYear,
        {
          project_name: selectedProject.project_name,
          project_code: selectedProject.project_code,
          client_id: selectedProject.client_id,
          client_name: selectedProject.client_name,
        }
      );
      setProjectSubmission(res.data);
      toast.success("Project submitted to admin successfully");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to submit project"));
    } finally {
      setSubmittingProject(false);
    }
  }

  function goToClients() { setView("clients"); setSelectedClient(null); setSelectedProject(null); }
  function goToProjects(client: ClientGroup) { setSelectedClient(client); setView("projects"); }
  function goToResources(project: ResourceMasterProject) { setSelectedProject(project); setView("resources"); }
  function goBackToResources() { setView("resources"); setViewingMember(null); setViewingTimesheet(null); }

  // ── Month/Year selector (shared) ──────────────────────────────────────────
  // ManagerTimesheetReviewPage uses 0-indexed months (0=Jan); MonthCalendarPicker too.

  function MonthYearPicker() {
    return (
      <MonthCalendarPicker
        month={selectedMonth}
        year={selectedYear}
        onChange={(m, y) => { setSelectedMonth(m); setSelectedYear(y); }}
        maxYear={CURRENT_YEAR + 1}
        align="right"
      />
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
    const approvedCount   = projectMembers.filter((m) => m.status === "approved").length;
    const submittedCount  = projectMembers.filter((m) => m.status === "submitted").length;
    const rejectedCount   = projectMembers.filter((m) => m.status === "rejected").length;
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
            <div className="flex items-center gap-2">
              <MonthYearPicker />
              {/* Submit Project button */}
              {projectSubmission ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1.5 text-xs px-3 py-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Project Submitted
                </Badge>
              ) : (
                <Button
                  size="sm"
                  className="gap-1.5 bg-[#217346] hover:bg-[#185c37] text-white"
                  disabled={submittingProject || approvedCount !== projectMembers.length || projectMembers.length === 0}
                  onClick={() => setSubmitProjectOpen(true)}
                  title={approvedCount !== projectMembers.length ? "All timesheets must be approved before submitting" : "Submit project to admin"}
                >
                  {submittingProject ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Submit Project
                </Button>
              )}
            </div>
          </div>

          {/* Project submitted banner */}
          {projectSubmission && (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800">
                  Project submitted to admin
                </p>
                <p className="text-xs text-emerald-600">
                  Submitted on {new Date(projectSubmission.submitted_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  {" · "}{projectSubmission.total_employees} employees · {projectSubmission.total_billable_hours}h billable
                </p>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-5 gap-3 mb-5">
            {[
              { label: "Approved",    count: approvedCount,   icon: ThumbsUp,     iconCls: "text-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
              { label: "Submitted",   count: submittedCount,  icon: CheckCircle2, iconCls: "text-blue-500",    bg: "bg-blue-50",    text: "text-blue-700" },
              { label: "Rejected",    count: rejectedCount,   icon: XCircle,      iconCls: "text-red-500",     bg: "bg-red-50",     text: "text-red-700" },
              { label: "In Progress", count: draftCount,      icon: Clock,        iconCls: "text-orange-500",  bg: "bg-orange-50",  text: "text-orange-700" },
              { label: "Not Started", count: notStartedCount, icon: CircleDashed, iconCls: "text-slate-400",   bg: "bg-slate-50",   text: "text-slate-600" },
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

        {/* ── Submit Project confirmation dialog ── */}
        <AlertDialog open={submitProjectOpen} onOpenChange={setSubmitProjectOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Send className="w-5 h-5 text-[#217346]" />
                Submit Project to Admin
              </AlertDialogTitle>
              <AlertDialogDescription>
                Submit <strong>{selectedProject.project_name}</strong> for{" "}
                <strong>{MONTHS[selectedMonth]} {selectedYear}</strong> to admin?
                <br /><br />
                <span className="text-slate-600">
                  {approvedCount} approved timesheet{approvedCount !== 1 ? "s" : ""} · {projectMembers.length} employee{projectMembers.length !== 1 ? "s" : ""}
                </span>
                <br />
                All administrators will be notified.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSubmitProject}
                className="bg-[#217346] hover:bg-[#185c37] text-white"
              >
                Submit Project
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
            <div className="flex items-center gap-2">
              <StatusBadge status={viewingTimesheet?.status || viewingMember.status} />
              {/* Approve / Reject buttons — only for submitted timesheets */}
              {viewingTimesheet?.status === "submitted" && (
                <>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={approving}
                    onClick={() => setApproveConfirmOpen(true)}
                  >
                    {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
                    disabled={approving}
                    onClick={() => { setRejectReason(""); setRejectDialogOpen(true); }}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    Reject
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Rejection reason banner — show if timesheet was rejected */}
          {viewingTimesheet?.status === "rejected" && viewingTimesheet.rejection_reason && (
            <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Timesheet Rejected</p>
                <p className="text-xs text-red-600 mt-0.5">{viewingTimesheet.rejection_reason}</p>
              </div>
            </div>
          )}

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

        {/* ── Approve confirmation dialog ── */}
        <AlertDialog open={approveConfirmOpen} onOpenChange={setApproveConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <ThumbsUp className="w-5 h-5 text-emerald-600" />
                Approve Timesheet
              </AlertDialogTitle>
              <AlertDialogDescription>
                Approve <strong>{viewingMember.employee_name}</strong>'s timesheet for{" "}
                <strong>{MONTHS[selectedMonth]} {selectedYear}</strong>?
                The employee will be notified.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleApprove}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Approve
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Reject dialog with reason ── */}
        <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <ThumbsDown className="w-5 h-5 text-red-600" />
                Reject Timesheet
              </AlertDialogTitle>
              <AlertDialogDescription>
                Reject <strong>{viewingMember.employee_name}</strong>'s timesheet for{" "}
                <strong>{MONTHS[selectedMonth]} {selectedYear}</strong>?
                Please provide a reason — the employee will be notified and can re-submit.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 resize-none"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                Reject Timesheet
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DashboardLayout>
    );
  }

  return null;
}
