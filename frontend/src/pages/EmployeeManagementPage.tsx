import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Plus,
  Loader2,
  X,
  UserPlus,
  Mail,
  KeyRound,
  Briefcase,
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

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Field error helper ────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

// ── Projects Tab ──────────────────────────────────────────────────────────────

function ProjectsTab({ onProjectClick }: { onProjectClick: (proj: ResourceMasterProject) => void }) {
  const [projects, setProjects] = useState<ResourceMasterProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    streamlineService.getMyResourceProjects()
      .then(res => setProjects(res.data))
      .catch(err => toast.error(getErrorMessage(err, "Failed to load projects from Streamline360")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading projects from Streamline360...</span>
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
    <div>
      <p className="text-sm text-slate-500 mb-6 font-medium">
        <span className="bg-[#217346]/10 text-[#217346] px-3 py-1 rounded-full inline-block font-semibold">
          {projects.length} project{projects.length !== 1 ? "s" : ""}
        </span>
        <span className="ml-2 text-slate-400">live from Streamline360 Resource Master</span>
      </p>

      <div className="space-y-3.5">
        {projects.map((proj, index) => (
          <div
            key={proj.project_id}
            className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-[#217346]/30 hover:shadow-lg hover:shadow-[#217346]/10 transition-all duration-300 group animate-slide-up"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div
              className="px-6 py-5 flex items-center gap-4 cursor-pointer transition-all duration-300"
              onClick={() => onProjectClick(proj)}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#217346]/20 to-emerald-300/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 border border-[#217346]/10">
                <FolderOpen className="w-5 h-5 text-[#217346]" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900">{proj.project_name || "Unnamed Project"}</p>
                  {proj.project_code && (
                    <Badge variant="outline" className="text-xs border-slate-200 bg-slate-50 text-slate-500 font-mono">
                      {proj.project_code}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-0.5 flex-wrap">
                  {proj.client_name && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {proj.client_name}
                    </span>
                  )}
                  {(proj.start_date || proj.end_date) && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <CalendarRange className="w-3 h-3" />
                      {formatDate(proj.start_date)} – {formatDate(proj.end_date)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Badge variant="outline" className="text-xs border-[#217346]/30 bg-[#217346]/5 text-[#217346]">
                  <Users className="w-3 h-3 mr-1" />
                  {proj.resource_count} resource{proj.resource_count !== 1 ? "s" : ""}
                </Badge>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Validation helpers ────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMP_ID_RE = /^\d+$/;
const NAME_RE = /^[A-Za-z\s.''-]+$/;

function validateCreateFields(
  empId: string,
  empName: string,
  empEmail: string,
  teamId: string,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!empId.trim()) {
    errors.emp_id = "Employee ID is required";
  } else if (!EMP_ID_RE.test(empId.trim())) {
    errors.emp_id = "Employee ID must be numeric (e.g. 340)";
  }

  if (!empName.trim()) {
    errors.emp_name = "Full name is required";
  } else if (empName.trim().length < 2) {
    errors.emp_name = "Name must be at least 2 characters";
  } else if (!NAME_RE.test(empName.trim())) {
    errors.emp_name = "Name can only contain letters, spaces, and hyphens";
  }

  if (!empEmail.trim()) {
    errors.emp_email = "Email is required";
  } else if (!EMAIL_RE.test(empEmail.trim())) {
    errors.emp_email = "Please enter a valid email address";
  }

  if (!teamId) {
    errors.team_id = "Please select a team";
  }

  return errors;
}

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
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>(
    location.pathname === "/projects" ? "projects" : "employees"
  );
  const [employees, setEmployees] = useState<EmployeeMaster[]>([]);
  const [teams, setTeams] = useState<StreamlineTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTeamId, setFilterTeamId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");


  // ── Create state ────────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmpId, setNewEmpId] = useState("");
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpTeamId, setNewEmpTeamId] = useState("");
  const [newEmpDesignation, setNewEmpDesignation] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

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

  // ── Filtered employee list ──────────────────────────────────────────────────
  const filtered = employees
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
    });

  // ── Create ─────────────────────────────────────────────────────────────────
  function openCreateDialog() {
    setNewEmpId("");
    setNewEmpEmail("");
    setNewEmpName("");
    setNewEmpTeamId(teams.length === 1 ? teams[0]._id : "");
    setNewEmpDesignation("");
    setCreateErrors({});
    setCreateOpen(true);
  }

  async function handleCreate() {
    const errors = validateCreateFields(newEmpId, newEmpName, newEmpEmail, newEmpTeamId);
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }
    setCreating(true);
    try {
      const team = teams.find(t => t._id === newEmpTeamId);
      await employeeService.create({
        emp_id: newEmpId.trim(),
        emp_email: newEmpEmail.trim(),
        emp_name: newEmpName.trim(),
        team_id: newEmpTeamId,
        team_name: team?.team_name,
        designation: newEmpDesignation.trim(),
      });
      toast.success(`Employee ${newEmpName.trim()} created. Login: ${newEmpEmail.trim()} / Think@2026`);
      setCreateOpen(false);
      await loadData();
    } catch (err) {
      const msg = getErrorMessage(err, "Failed to create employee");
      // Surface duplicate email as a field error
      if (msg.toLowerCase().includes("already exists") || msg.toLowerCase().includes("email")) {
        setCreateErrors({ emp_email: "An employee with this email already exists" });
      } else {
        toast.error(msg);
      }
    } finally {
      setCreating(false);
    }
  }

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
      <div className="max-w-6xl mx-auto">
        {/* Header with animation */}
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 animate-text-fade">My Workspace</h1>
          <p className="text-slate-500 text-sm mt-2 animate-text-fade" style={{ animationDelay: "0.1s" }}>
            Employees and projects in your assigned teams
          </p>
        </div>

        {/* Tabs with enhanced styling and animations */}
        <div className="flex gap-2 mb-8 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <button
            onClick={() => setActiveTab("employees")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 relative group ${
              activeTab === "employees"
                ? "bg-white text-[#217346] shadow-lg shadow-[#217346]/20 border border-[#217346]/20"
                : "text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200"
            }`}
          >
            <Users className={`w-4 h-4 transition-transform duration-300 ${activeTab === "employees" ? "scale-110" : "group-hover:scale-105"}`} />
            My Employees
            {activeTab === "employees" && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#217346] rounded-full animate-slide-up" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("projects")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 relative group ${
              activeTab === "projects"
                ? "bg-white text-[#217346] shadow-lg shadow-[#217346]/20 border border-[#217346]/20"
                : "text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200"
            }`}
          >
            <FolderOpen className={`w-4 h-4 transition-transform duration-300 ${activeTab === "projects" ? "scale-110" : "group-hover:scale-105"}`} />
            My Projects
            {activeTab === "projects" && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#217346] rounded-full animate-slide-up" />
            )}
          </button>
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

              <Button onClick={openCreateDialog} className="bg-[#217346] hover:bg-[#185c37] text-white gap-2 shrink-0 shadow-lg shadow-[#217346]/20 hover:shadow-xl hover:shadow-[#217346]/30 transition-all duration-300 h-10">
                <Plus className="w-4 h-4" />
                Add Employee
              </Button>
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
                  {searchQuery ? "Try a different search term" : 'Click "Add Employee" to create one'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((emp, index) => (
                  <div
                    key={emp._id}
                    className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex items-center gap-4 hover:border-[#217346]/30 hover:shadow-lg hover:shadow-[#217346]/10 transition-all duration-300 group animate-slide-up"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    {/* Avatar with animation */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#217346]/20 to-emerald-300/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 border border-[#217346]/10">
                      <span className="text-sm font-bold text-[#217346]">{getInitials(emp.employee_name)}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900">{emp.employee_name}</p>
                        {emp.designation && (
                          <span className="text-xs text-slate-500 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-full">
                            <Briefcase className="w-3 h-3" />
                            {emp.designation}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                        <span className="text-xs text-slate-600 flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-[#217346]/60" />
                          {emp.official_email}
                        </span>
                        <span className="text-xs text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded">ID: {emp.unique_id}</span>
                      </div>
                      {emp.team_name && (
                        <Badge variant="outline" className="mt-2 text-xs border-[#217346]/20 bg-[#217346]/5 text-[#217346] font-medium">
                          {emp.team_name}
                        </Badge>
                      )}
                    </div>

                    {/* Actions with animation */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button
                        onClick={() => openEditDialog(emp)}
                        className="p-2.5 rounded-lg hover:bg-[#217346]/10 text-slate-400 hover:text-[#217346] transition-all duration-300 hover:scale-110"
                        title="Edit employee"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setResetTarget(emp)}
                        className="p-2.5 rounded-lg hover:bg-orange-500/10 text-slate-400 hover:text-orange-600 transition-all duration-300 hover:scale-110"
                        title="Reset password"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(emp)}
                        className="p-2.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all duration-300 hover:scale-110"
                        title="Delete employee"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Create Employee Dialog ── */}
        <Dialog open={createOpen} onOpenChange={(open) => { if (!creating) setCreateOpen(open); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#217346]" />
                Add Employee
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Employee ID */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Employee ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newEmpId}
                  onChange={e => {
                    setNewEmpId(e.target.value);
                    if (createErrors.emp_id) setCreateErrors(p => ({ ...p, emp_id: "" }));
                  }}
                  placeholder="e.g. 340"
                  className={`w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346] ${
                    createErrors.emp_id ? "border-red-400 bg-red-50" : "border-slate-300"
                  }`}
                />
                <FieldError msg={createErrors.emp_id} />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newEmpName}
                  onChange={e => {
                    setNewEmpName(e.target.value);
                    if (createErrors.emp_name) setCreateErrors(p => ({ ...p, emp_name: "" }));
                  }}
                  placeholder="e.g. Abhay Ahire"
                  className={`w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346] ${
                    createErrors.emp_name ? "border-red-400 bg-red-50" : "border-slate-300"
                  }`}
                />
                <FieldError msg={createErrors.emp_name} />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newEmpEmail}
                  onChange={e => {
                    setNewEmpEmail(e.target.value);
                    if (createErrors.emp_email) setCreateErrors(p => ({ ...p, emp_email: "" }));
                  }}
                  placeholder="abhay@company.com"
                  className={`w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346] ${
                    createErrors.emp_email ? "border-red-400 bg-red-50" : "border-slate-300"
                  }`}
                />
                <FieldError msg={createErrors.emp_email} />
              </div>

              {/* Team */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Team <span className="text-red-500">*</span>
                </label>
                <Select
                  value={newEmpTeamId}
                  onValueChange={v => {
                    setNewEmpTeamId(v);
                    if (createErrors.team_id) setCreateErrors(p => ({ ...p, team_id: "" }));
                  }}
                >
                  <SelectTrigger className={createErrors.team_id ? "border-red-400 bg-red-50" : ""}>
                    <SelectValue placeholder="Select team..." />
                  </SelectTrigger>
                  <SelectContent searchable>
                    {teams.map(t => <SelectItem key={t._id} value={t._id}>{t.team_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError msg={createErrors.team_id} />
              </div>

              {/* Designation */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Designation</label>
                <input
                  type="text"
                  value={newEmpDesignation}
                  onChange={e => setNewEmpDesignation(e.target.value)}
                  placeholder="e.g. Software Engineer"
                  className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]"
                />
              </div>

              <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                Default password: <span className="font-mono font-medium text-slate-600">Think@2026</span> — employee must change on first login
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="bg-[#217346] hover:bg-[#185c37] text-white gap-2"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Employee
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
