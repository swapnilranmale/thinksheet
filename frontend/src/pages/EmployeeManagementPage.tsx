import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Users,
  Loader2,
  X,
  Mail,
  KeyRound,
  FolderOpen,
  Building2,
  CalendarRange,
  ChevronRight,
  Search,
  Pencil,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import {
  employeeService,
  streamlineService,
  EmployeeMaster,
  StreamlineTeam,
  ResourceMasterProject,
} from "@/services/timesheet";

import { authService } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { getInitials, fmtDate as formatDate } from "@/lib/utils";

// ── Field error helper ────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

// ── Projects Tab ──────────────────────────────────────────────────────────────

function ProjectsTab({ onProjectClick }: { onProjectClick: (proj: ResourceMasterProject) => void }) {
  const [projects, setProjects] = useState<ResourceMasterProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    streamlineService.getMyResourceProjects()
      .then(res => setProjects(res.data))
      .catch(err => toast.error(getErrorMessage(err, "Failed to load projects from Streamline360")))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(p =>
      p.project_name?.toLowerCase().includes(q) ||
      p.project_code?.toLowerCase().includes(q) ||
      p.client_name?.toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading projects...</span>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center py-16 text-slate-400">
        <FolderOpen className="w-10 h-10 mb-3 opacity-30" />
        <p className="font-medium text-slate-600">No projects found</p>
        <p className="text-sm mt-1">No Resource Master data available for your teams in Streamline360</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search projects…"
            className="w-full h-10 pl-9 pr-4 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#217346]/50 focus:border-[#217346] transition-all duration-200 hover:border-slate-400"
          />
        </div>
        <p className="text-sm text-slate-500 whitespace-nowrap font-medium bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
          {filtered.length} project{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center py-16 text-slate-400">
          <FolderOpen className="w-10 h-10 mb-3 opacity-30" />
          <p className="font-medium text-slate-600">No projects match your search</p>
          <p className="text-sm mt-1">Try a different search term</p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 flex flex-col gap-2">
            {filtered.map((proj) => (
              <button
                key={proj.project_id}
                onClick={() => onProjectClick(proj)}
                className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 flex items-center gap-3 hover:border-[#217346]/30 hover:shadow-sm transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#217346]/10 flex items-center justify-center shrink-0">
                  <FolderOpen className="w-4 h-4 text-[#217346]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 group-hover:text-[#217346] transition-colors">{proj.project_name || "Unnamed Project"}</p>
                    {proj.project_code && (
                      <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{proj.project_code}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {proj.client_name && <span className="flex items-center gap-1 text-xs text-slate-500"><Building2 className="w-3 h-3" />{proj.client_name}</span>}
                    {(proj.start_date || proj.end_date) && (
                      <span className="flex items-center gap-1 text-xs text-slate-400"><CalendarRange className="w-3 h-3" />{formatDate(proj.start_date)} – {formatDate(proj.end_date)}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-[#217346] bg-[#217346]/8 px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {proj.resource_count} resource{proj.resource_count !== 1 ? "s" : ""}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#217346] transition-colors shrink-0" />
              </button>
            ))}
          </div>
          <div className="shrink-0 pt-2 px-1">
            <span className="text-xs text-slate-400">
              Showing <strong>{filtered.length}</strong> project{filtered.length !== 1 ? "s" : ""} · Page <strong>1</strong> of <strong>1</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Validation helpers ────────────────────────────────────────────────────────

const NAME_RE = /^[A-Za-z\s.''-]+$/;

function validateEditFields(empName: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!empName.trim()) {
    errors.emp_name = "Full name is required";
  } else if (empName.trim().length < 2) {
    errors.emp_name = "Name must be at least 2 characters";
  } else if (!NAME_RE.test(empName.trim())) {
    errors.emp_name = "Name can only contain letters, spaces, and hyphens";
  }
  return errors;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "employees" | "projects";

export default function EmployeeManagementPage() {
  useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam === "employees" ? "employees" : "projects"
  );

  // Sync tab when URL search param changes (e.g. sidebar click)
  useEffect(() => {
    const t = searchParams.get("tab");
    setActiveTab(t === "employees" ? "employees" : "projects");
  }, [searchParams]);
  const [employees, setEmployees] = useState<EmployeeMaster[]>([]);
  const [teams, setTeams] = useState<StreamlineTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTeamId, setFilterTeamId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");


  // ── Edit state ──────────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<EmployeeMaster | null>(null);
  const [editEmpName, setEditEmpName] = useState("");
  const [editEmpDesignation, setEditEmpDesignation] = useState("");
  const [editEmpTeamId, setEditEmpTeamId] = useState("");
  const [editing, setEditing] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // ── Delete & Reset ──────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<EmployeeMaster | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resetTarget, setResetTarget] = useState<EmployeeMaster | null>(null);
  const [resetting, setResetting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [empRes, allTeams] = await Promise.all([
        employeeService.getAll(),
        streamlineService.getEngineeringTeams(),
      ]);
      setEmployees(empRes.data);

      const meRes = await authService.me();
      const myTeamIds: string[] = (meRes.data.user as any).team_ids || [];

      setTeams(allTeams.filter(t => myTeamIds.includes(t._id)));
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load data"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filtered employee list — memoised ──────────────────────────────────────
  const filtered = useMemo(() => employees
    .filter(e => filterTeamId === "all" || e.team_id === filterTeamId)
    .filter(e => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        e.employee_name.toLowerCase().includes(q) ||
        e.official_email.toLowerCase().includes(q) ||
        e.unique_id.toLowerCase().includes(q) ||
        (e.designation || "").toLowerCase().includes(q)
      );
    }), [employees, filterTeamId, searchQuery]);

  // ── Edit ───────────────────────────────────────────────────────────────────
  function openEditDialog(emp: EmployeeMaster) {
    setEditTarget(emp);
    setEditEmpName(emp.employee_name);
    setEditEmpDesignation(emp.designation || "");
    setEditEmpTeamId(emp.team_id || "");
    setEditErrors({});
  }

  async function handleEdit() {
    if (!editTarget) return;
    const errors = validateEditFields(editEmpName);
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }
    setEditing(true);
    try {
      const team = teams.find(t => t._id === editEmpTeamId);
      await employeeService.update(editTarget._id, {
        emp_name: editEmpName.trim(),
        designation: editEmpDesignation.trim(),
        team_id: editEmpTeamId || undefined,
        team_name: team?.team_name,
      });
      toast.success(`Employee ${editEmpName.trim()} updated`);
      setEditTarget(null);
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update employee"));
    } finally {
      setEditing(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await employeeService.remove(deleteTarget._id);
      toast.success("Employee deleted");
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete employee"));
    } finally {
      setDeleting(false);
    }
  }

  // ── Reset Password ─────────────────────────────────────────────────────────
  async function handleResetPassword() {
    if (!resetTarget) return;
    setResetting(true);
    try {
      await authService.resetPasswordByEmail(resetTarget.official_email);
      toast.success(`Password reset for ${resetTarget.employee_name}. New password: Think@2026`);
      setResetTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to reset password"));
    } finally {
      setResetting(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="w-full h-full flex flex-col">
        {/* Header */}
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 animate-text-fade">
            {activeTab === "projects" ? "My Projects" : "My Employees"}
          </h1>
          <p className="text-slate-500 text-sm mt-2 animate-text-fade" style={{ animationDelay: "0.1s" }}>
            {activeTab === "projects" ? "Projects in your assigned teams" : "Employees in your assigned teams"}
          </p>
        </div>

        {/* ── Projects Tab ── */}
        {activeTab === "projects" && (
          <ProjectsTab
            onProjectClick={(proj) =>
              navigate(`/projects/${proj.project_id}`, {
                state: { project_name: proj.project_name, project_code: proj.project_code, client_name: proj.client_name }
              })
            }
          />
        )}

        {/* ── Employees Tab ── */}
        {activeTab === "employees" && (
          <>
            {/* Toolbar with animation */}
            <div className="flex items-center justify-between mb-6 gap-4 flex-wrap animate-slide-up" style={{ animationDelay: "0.15s" }}>
              <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by name, email or ID…"
                    className="w-full h-10 pl-9 pr-4 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#217346]/50 focus:border-[#217346] transition-all duration-200 hover:border-slate-400"
                  />
                </div>

                {/* Team filter */}
                {teams.length > 1 && (
                  <Select value={filterTeamId} onValueChange={setFilterTeamId}>
                    <SelectTrigger className="w-48 h-10 rounded-lg border-slate-300 hover:border-slate-400 transition-colors duration-200">
                      <SelectValue placeholder="Filter by team" />
                    </SelectTrigger>
                    <SelectContent searchable>
                      <SelectItem value="all">All My Teams</SelectItem>
                      {teams.map(t => (
                        <SelectItem key={t._id} value={t._id}>{t.team_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <p className="text-sm text-slate-500 whitespace-nowrap font-medium bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                  {filtered.length} employee{filtered.length !== 1 ? "s" : ""}
                </p>
              </div>

            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading employees...</span>
              </div>
            ) : teams.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center py-16 text-slate-400">
                <UserCog className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-medium text-slate-600">No teams assigned</p>
                <p className="text-sm mt-1">Ask your administrator to assign you to a team</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center py-16 text-slate-400">
                <Users className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-medium text-slate-600">
                  {searchQuery ? "No employees match your search" : "No employees in your teams"}
                </p>
                <p className="text-sm mt-1">
                  {searchQuery ? "Try a different search term" : "Sync from Streamline360 to populate employees"}
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="divide-y divide-slate-100">
                  {filtered.map((emp) => (
                    <div
                      key={emp._id}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/80 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-full bg-[#217346]/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-[#217346]">{getInitials(emp.employee_name)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900">{emp.employee_name}</p>
                          {emp.designation && (
                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{emp.designation}</span>
                          )}
                          {emp.team_name && (
                            <span className="text-xs text-[#217346] bg-[#217346]/8 px-2 py-0.5 rounded">{emp.team_name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{emp.official_email}</span>
                          <span className="font-mono">ID: {emp.unique_id}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditDialog(emp)} className="p-2 rounded-lg hover:bg-[#217346]/10 text-slate-400 hover:text-[#217346] transition-colors" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setResetTarget(emp)} className="p-2 rounded-lg hover:bg-orange-50 text-slate-400 hover:text-orange-600 transition-colors" title="Reset password">
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(emp)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="shrink-0 border-t border-slate-100 px-5 py-3 flex items-center justify-between bg-white">
                  <span className="text-xs text-slate-400">
                    Showing <strong>{filtered.length}</strong> employee{filtered.length !== 1 ? "s" : ""} · Page <strong>1</strong> of <strong>1</strong>
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Edit Employee Dialog ── */}
        <Dialog open={!!editTarget} onOpenChange={(open) => { if (!editing && !open) setEditTarget(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#217346]" />
                Edit Employee
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editEmpName}
                  onChange={e => {
                    setEditEmpName(e.target.value);
                    if (editErrors.emp_name) setEditErrors(p => ({ ...p, emp_name: "" }));
                  }}
                  placeholder="e.g. Abhay Ahire"
                  className={`w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346] ${
                    editErrors.emp_name ? "border-red-400 bg-red-50" : "border-slate-300"
                  }`}
                />
                <FieldError msg={editErrors.emp_name} />
              </div>

              {/* Designation */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Designation</label>
                <input
                  type="text"
                  value={editEmpDesignation}
                  onChange={e => setEditEmpDesignation(e.target.value)}
                  placeholder="e.g. Software Engineer"
                  className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]"
                />
              </div>

              {/* Team */}
              {teams.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Team</label>
                  <Select value={editEmpTeamId} onValueChange={setEditEmpTeamId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team..." />
                    </SelectTrigger>
                    <SelectContent searchable>
                      {teams.map(t => <SelectItem key={t._id} value={t._id}>{t.team_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Read-only info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Email</label>
                  <p className="text-sm text-slate-600 truncate">{editTarget?.official_email}</p>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Employee ID</label>
                  <p className="text-sm text-slate-600 font-mono">{editTarget?.unique_id}</p>
                </div>
                {editTarget?.resource_id && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Resource ID</label>
                    <p className="text-sm text-slate-600 font-mono">{editTarget.resource_id}</p>
                  </div>
                )}
                {editTarget?.actual_resource && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Actual Resource</label>
                    <p className="text-sm text-slate-600">{editTarget.actual_resource}</p>
                  </div>
                )}
                {editTarget?.profile_resource && (
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-400 mb-1">Profile Resource</label>
                    <p className="text-sm text-slate-600">{editTarget.profile_resource}</p>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editing}>Cancel</Button>
              <Button
                onClick={handleEdit}
                disabled={editing}
                className="bg-[#217346] hover:bg-[#185c37] text-white gap-2"
              >
                {editing && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete Confirm ── */}
        <AlertDialog open={!!deleteTarget} onOpenChange={() => { if (!deleting) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Employee</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deleteTarget?.employee_name}</strong>? Their account will be deactivated and cannot be recovered.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete} disabled={deleting}>
                {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Reset Password Confirm ── */}
        <AlertDialog open={!!resetTarget} onOpenChange={() => { if (!resetting) setResetTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Password</AlertDialogTitle>
              <AlertDialogDescription>
                Reset password for <strong>{resetTarget?.employee_name}</strong> to{" "}
                <code className="bg-slate-100 px-1 rounded font-mono text-sm">Think@2026</code>?{" "}
                They will be required to change it on next login.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-orange-600 hover:bg-orange-700" onClick={handleResetPassword} disabled={resetting}>
                {resetting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Reset Password
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
