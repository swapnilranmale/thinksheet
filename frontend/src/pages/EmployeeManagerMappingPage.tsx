import { useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
  Pencil,
  Loader2,
  UserPlus,
  Shield,
  Mail,
  Briefcase,
  KeyRound,
  Upload,
  Download,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Building2,
  CalendarRange,
  Search,
  Eye,
  IdCard,
} from "lucide-react";
import { toast } from "sonner";
import {
  employeeService,
  streamlineService,
  EmployeeMaster,
  StreamlineTeam,
  SyncResult,
  activityLogService,
  ActivityLog,
  ResourceMasterProject,
} from "@/services/timesheet";
import { authService } from "@/lib/auth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ManagerRecord {
  _id: string;
  full_name: string;
  email: string;
  designation?: string;
  is_active?: boolean;
  team_ids?: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

// ── Validation helpers ────────────────────────────────────────────────────────

const MGR_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMP_ID_RE = /^\d+$/;
const NAME_RE = /^[A-Za-z\s.''-]+$/;

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

// ── Create Manager Dialog ─────────────────────────────────────────────────────

function CreateManagerDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [designation, setDesignation] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [teams, setTeams] = useState<StreamlineTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setTeamsLoading(true);
      streamlineService.getTeams()
        .then(setTeams)
        .catch(() => toast.error("Failed to load teams"))
        .finally(() => setTeamsLoading(false));
    }
  }, [open]);

  function reset() {
    setFullName(""); setEmail(""); setPassword(""); setDesignation("");
    setSelectedTeamIds([]); setErrors({});
  }

  function clearError(field: string) {
    setErrors(prev => { const next = { ...prev }; delete next[field]; return next; });
  }

  function toggleTeam(teamId: string) {
    setSelectedTeamIds(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
    clearError("teams");
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = "Full name is required";
    else if (fullName.trim().length < 2) errs.fullName = "Name must be at least 2 characters";
    if (!email.trim()) errs.email = "Email is required";
    else if (!MGR_EMAIL_RE.test(email.trim())) errs.email = "Enter a valid email address";
    if (!password) errs.password = "Password is required";
    else if (password.length < 6) errs.password = "Password must be at least 6 characters";
    if (selectedTeamIds.length === 0) errs.teams = "Select at least one team";
    return errs;
  }

  async function handleCreate() {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      await authService.createManager(email.trim(), password, fullName.trim(), designation.trim(), selectedTeamIds);
      toast.success(`Manager account created for ${fullName.trim()}`);
      reset();
      onCreated();
      onClose();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (msg?.toLowerCase().includes("email") || msg?.toLowerCase().includes("exists")) {
        setErrors({ email: "A manager with this email already exists" });
      } else {
        toast.error(msg || "Failed to create manager");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#217346]/10 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-[#217346]" />
            </div>
            Create Manager Account
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
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); clearError("fullName"); }}
              placeholder="e.g. Rahul Sharma"
              className={`w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346] ${errors.fullName ? "border-red-400 bg-red-50" : "border-slate-300"}`}
            />
            <FieldError msg={errors.fullName} />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
              placeholder="manager@company.com"
              className={`w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346] ${errors.email ? "border-red-400 bg-red-50" : "border-slate-300"}`}
            />
            <FieldError msg={errors.email} />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
              placeholder="Min. 6 characters"
              className={`w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346] ${errors.password ? "border-red-400 bg-red-50" : "border-slate-300"}`}
            />
            <FieldError msg={errors.password} />
          </div>

          {/* Designation */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Designation</label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Engineering Manager"
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]"
            />
          </div>

          {/* Teams */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Assign Teams <span className="text-red-500">*</span>
              {selectedTeamIds.length > 0 && (
                <span className="ml-2 text-xs text-slate-400 font-normal">({selectedTeamIds.length} selected)</span>
              )}
            </label>
            {teamsLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-3">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading teams...
              </div>
            ) : (
              <div className={`border rounded-lg divide-y max-h-40 overflow-y-auto ${errors.teams ? "border-red-400" : "border-slate-200"}`}>
                {teams.length === 0 ? (
                  <div className="p-3 text-center text-sm text-slate-400">No engineering teams found</div>
                ) : (
                  teams.map(team => (
                    <label key={team._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTeamIds.includes(team._id)}
                        onChange={() => toggleTeam(team._id)}
                        className="h-4 w-4 rounded border-gray-300 accent-[#217346]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{team.team_name}</p>
                        <p className="text-xs text-slate-400">{team.unique_id} · {team.department_id?.department_name}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            )}
            <FieldError msg={errors.teams} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving} className="bg-[#217346] hover:bg-[#185c37] text-white gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Manager
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Managers Tab ──────────────────────────────────────────────────────────────

function ManagersTab() {
  const [managers, setManagers] = useState<ManagerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [teams, setTeams] = useState<StreamlineTeam[]>([]);

  // Reset password state
  const [resetTarget, setResetTarget] = useState<ManagerRecord | null>(null);
  const [resetting, setResetting] = useState(false);

  // Edit manager state
  const [editTarget, setEditTarget] = useState<ManagerRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesignation, setEditDesignation] = useState("");
  const [editTeamIds, setEditTeamIds] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const loadManagers = useCallback(async () => {
    try {
      setLoading(true);
      const [res, teamsData] = await Promise.all([
        authService.getManagers(),
        streamlineService.getTeams(),
      ]);
      setManagers(res.data.data);
      setTeams(teamsData);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load managers"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadManagers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getTeamNames(teamIds: string[] = []) {
    return teamIds
      .map(id => teams.find(t => t._id === id)?.team_name)
      .filter(Boolean) as string[];
  }

  // ── Reset password ─────────────────────────────────────────────────────────
  async function handleResetPassword() {
    if (!resetTarget) return;
    setResetting(true);
    try {
      await authService.resetPassword(resetTarget._id);
      toast.success(`Password reset for ${resetTarget.full_name}. New password: Think@2026`);
      setResetTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to reset password"));
    } finally {
      setResetting(false);
    }
  }

  // ── Edit manager ───────────────────────────────────────────────────────────
  function openEditManager(mgr: ManagerRecord) {
    setEditTarget(mgr);
    setEditName(mgr.full_name);
    setEditDesignation(mgr.designation || "");
    setEditTeamIds(mgr.team_ids || []);
    setEditErrors({});
  }

  function closeEditManager() {
    setEditTarget(null);
    setEditErrors({});
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    const errs: Record<string, string> = {};
    if (!editName.trim()) errs.editName = "Full name is required";
    else if (editName.trim().length < 2) errs.editName = "Name must be at least 2 characters";
    if (editTeamIds.length === 0) errs.editTeams = "Select at least one team";
    if (Object.keys(errs).length > 0) { setEditErrors(errs); return; }

    setEditSaving(true);
    try {
      await authService.updateManager(editTarget._id, {
        full_name: editName.trim(),
        designation: editDesignation.trim(),
        team_ids: editTeamIds,
      });
      toast.success(`Manager ${editName.trim()} updated`);
      closeEditManager();
      await loadManagers();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update manager"));
    } finally {
      setEditSaving(false);
    }
  }

  const totalTeams = new Set(managers.flatMap(m => m.team_ids || [])).size;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <p className="text-sm text-slate-500">
          {managers.length} manager{managers.length !== 1 ? "s" : ""} &middot; {totalTeams} team{totalTeams !== 1 ? "s" : ""} assigned
        </p>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#217346] hover:bg-[#185c37] text-white gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Manager
        </Button>
      </div>

      {/* Manager list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading managers...</span>
        </div>
      ) : managers.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center py-16 text-slate-400">
          <Shield className="w-10 h-10 mb-3 opacity-30" />
          <p className="font-medium text-slate-600">No managers yet</p>
          <p className="text-sm mt-1">Click "Add Manager" to create the first manager account</p>
        </div>
      ) : (
        <div className="space-y-3">
          {managers.map((mgr) => {
            const teamNames = getTeamNames(mgr.team_ids);
            const isActive = mgr.is_active !== false;
            return (
              <div
                key={mgr._id}
                className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-slate-300 transition-colors"
              >
                {/* Avatar */}
                <div className="w-11 h-11 rounded-full bg-[#217346]/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-[#217346]">{getInitials(mgr.full_name)}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900">{mgr.full_name}</p>
                    <Badge
                      variant="outline"
                      className={isActive
                        ? "border-green-200 bg-green-50 text-green-700 text-xs"
                        : "border-slate-200 bg-slate-50 text-slate-500 text-xs"
                      }
                    >
                      {isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {mgr.email}
                    </span>
                    {mgr.designation && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        {mgr.designation}
                      </span>
                    )}
                  </div>
                  {teamNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {teamNames.map(name => (
                        <Badge key={name} variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-700">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditManager(mgr)}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-[#217346] transition-colors"
                    title="Edit manager"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setResetTarget(mgr)}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-orange-600 transition-colors"
                    title="Reset password"
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateManagerDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={loadManagers}
      />

      {/* ── Reset Password Confirm ── */}
      <AlertDialog open={!!resetTarget} onOpenChange={(open) => { if (!resetting && !open) setResetTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password</AlertDialogTitle>
            <AlertDialogDescription>
              Reset password for <strong>{resetTarget?.full_name}</strong> to{" "}
              <code className="bg-slate-100 px-1 rounded font-mono text-sm">Think@2026</code>?{" "}
              They will be required to change it on next login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700"
              onClick={handleResetPassword}
              disabled={resetting}
            >
              {resetting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Reset Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Edit Manager Dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!editSaving && !open) closeEditManager(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-[#217346]" />
              Edit Manager
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
                value={editName}
                onChange={(e) => { setEditName(e.target.value); setEditErrors(p => { const n = { ...p }; delete n.editName; return n; }); }}
                placeholder="e.g. Rahul Sharma"
                className={`w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346] ${editErrors.editName ? "border-red-400 bg-red-50" : "border-slate-300"}`}
              />
              <FieldError msg={editErrors.editName} />
            </div>

            {/* Designation */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Designation</label>
              <input
                type="text"
                value={editDesignation}
                onChange={(e) => setEditDesignation(e.target.value)}
                placeholder="e.g. Engineering Manager"
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]"
              />
            </div>

            {/* Read-only email */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email (read-only)</label>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                {editTarget?.email}
              </p>
            </div>

            {/* Teams */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Assigned Teams <span className="text-red-500">*</span>
                {editTeamIds.length > 0 && (
                  <span className="ml-2 text-xs text-slate-400 font-normal">({editTeamIds.length} selected)</span>
                )}
              </label>
              <div className={`border rounded-lg divide-y max-h-44 overflow-y-auto ${editErrors.editTeams ? "border-red-400" : "border-slate-200"}`}>
                {teams.map(team => (
                  <label key={team._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editTeamIds.includes(team._id)}
                      onChange={() => {
                        setEditTeamIds(prev =>
                          prev.includes(team._id) ? prev.filter(id => id !== team._id) : [...prev, team._id]
                        );
                        setEditErrors(p => { const n = { ...p }; delete n.editTeams; return n; });
                      }}
                      className="h-4 w-4 rounded border-gray-300 accent-[#217346]"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{team.team_name}</p>
                      <p className="text-xs text-slate-400">{team.unique_id}</p>
                    </div>
                  </label>
                ))}
              </div>
              <FieldError msg={editErrors.editTeams} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditManager} disabled={editSaving}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={editSaving} className="bg-[#217346] hover:bg-[#185c37] text-white gap-2">
              {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function EmployeesTab() {
  const [employees, setEmployees] = useState<EmployeeMaster[]>([]);
  const [teams, setTeams] = useState<StreamlineTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTeamId, setFilterTeamId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Upload state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTeamId, setUploadTeamId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create state
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmpId, setNewEmpId] = useState("");
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpTeamId, setNewEmpTeamId] = useState("");
  const [newEmpDesignation, setNewEmpDesignation] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  // View state
  const [viewTarget, setViewTarget] = useState<EmployeeMaster | null>(null);

  // Edit state
  const [editTarget, setEditTarget] = useState<EmployeeMaster | null>(null);
  const [editEmpName, setEditEmpName] = useState("");
  const [editEmpDesignation, setEditEmpDesignation] = useState("");
  const [editEmpTeamId, setEditEmpTeamId] = useState("");
  const [editing, setEditing] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Reset password state
  const [resetTarget, setResetTarget] = useState<EmployeeMaster | null>(null);
  const [resetting, setResetting] = useState(false);

  // Sync from Streamline state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncResultOpen, setSyncResultOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [empRes, teamsData] = await Promise.all([
        employeeService.getAll(),
        streamlineService.getTeams(),
      ]);
      setEmployees(empRes.data);
      setTeams(teamsData);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load employees"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await streamlineService.syncResources();
      setSyncResult(res.data);
      setSyncResultOpen(true);
      toast.success(`Sync complete — ${res.data.employees_synced} employees, ${res.data.mappings_synced} project mappings`);
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Sync from Streamline failed"));
    } finally {
      setSyncing(false);
    }
  }

  async function handleUpload() {
    if (!uploadTeamId || !uploadFile) {
      toast.error("Please select a team and file");
      return;
    }
    setUploading(true);
    setUploadResult(null);
    try {
      const team = teams.find(t => t._id === uploadTeamId);
      const result = await employeeService.bulkUpload(uploadFile, uploadTeamId, team?.team_name || "");
      setUploadResult(result);
      toast.success(`Upload complete: ${result.summary.created} created, ${result.summary.skipped} skipped, ${result.summary.errors} errors`);
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  async function handleCreate() {
    const errs: Record<string, string> = {};
    if (!newEmpId.trim()) errs.emp_id = "Employee ID is required";
    else if (!EMP_ID_RE.test(newEmpId.trim())) errs.emp_id = "Employee ID must be numeric (e.g. 340)";
    if (!newEmpName.trim()) errs.emp_name = "Full name is required";
    else if (newEmpName.trim().length < 2) errs.emp_name = "Name must be at least 2 characters";
    else if (!NAME_RE.test(newEmpName.trim())) errs.emp_name = "Name can only contain letters, spaces, and hyphens";
    if (!newEmpEmail.trim()) errs.emp_email = "Email is required";
    else if (!MGR_EMAIL_RE.test(newEmpEmail.trim())) errs.emp_email = "Enter a valid email address";
    if (!newEmpTeamId) errs.team_id = "Please select a team";
    if (Object.keys(errs).length > 0) { setCreateErrors(errs); return; }

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
      setNewEmpId(""); setNewEmpEmail(""); setNewEmpName(""); setNewEmpTeamId(""); setNewEmpDesignation(""); setCreateErrors({});
      await loadData();
    } catch (err) {
      const msg = getErrorMessage(err, "Failed to create employee");
      if (msg.toLowerCase().includes("already exists") || msg.toLowerCase().includes("email")) {
        setCreateErrors({ emp_email: "An employee with this email already exists" });
      } else {
        toast.error(msg);
      }
    } finally {
      setCreating(false);
    }
  }

  function openEdit(emp: EmployeeMaster) {
    setEditTarget(emp);
    setEditEmpName(emp.employee_name);
    setEditEmpDesignation(emp.designation || "");
    setEditEmpTeamId(emp.team_id || "");
    setEditErrors({});
  }

  async function handleEdit() {
    if (!editTarget) return;
    const errs: Record<string, string> = {};
    if (!editEmpName.trim()) errs.emp_name = "Full name is required";
    else if (editEmpName.trim().length < 2) errs.emp_name = "Name must be at least 2 characters";
    if (Object.keys(errs).length > 0) { setEditErrors(errs); return; }
    setEditing(true);
    try {
      const team = teams.find(t => t._id === editEmpTeamId);
      await employeeService.update(editTarget._id, {
        emp_name: editEmpName.trim(),
        designation: editEmpDesignation.trim(),
        team_id: editEmpTeamId || undefined,
        team_name: team?.team_name,
      });
      toast.success(`${editEmpName.trim()} updated`);
      setEditTarget(null);
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update employee"));
    } finally {
      setEditing(false);
    }
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    setResetting(true);
    try {
      await (await import("@/lib/auth")).authService.resetPasswordByEmail(resetTarget.official_email);
      toast.success(`Password reset for ${resetTarget.employee_name}. New password: Think@2026`);
      setResetTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to reset password"));
    } finally {
      setResetting(false);
    }
  }

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

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
          {/* Search */}
          <div className="relative min-w-[200px] max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search name, email or ID…"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346] bg-white"
            />
          </div>
          <Select value={filterTeamId} onValueChange={setFilterTeamId}>
            <SelectTrigger className="w-40 h-9">
              <span className="text-sm truncate">
                {filterTeamId === "all"
                  ? "All Teams"
                  : (teams.find(t => t._id === filterTeamId)?.team_name || "All Teams")}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map(t => (
                <SelectItem key={t._id} value={t._id}>{t.team_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-slate-400 whitespace-nowrap">
            {filtered.length} employee{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={syncing}
            className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 whitespace-nowrap"
            title="Fetch all employees and project assignments from Streamline360 Resource Master"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? "Syncing..." : "Sync from Streamline"}
          </Button>
          <Button variant="outline" onClick={() => setUploadOpen(true)} className="gap-2 whitespace-nowrap">
            <Upload className="w-4 h-4" />
            Bulk Upload
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="bg-[#217346] hover:bg-[#185c37] text-white gap-2 whitespace-nowrap">
            <Plus className="w-4 h-4" />
            Add Employee
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading employees...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center py-16 text-slate-400">
          <Users className="w-10 h-10 mb-3 opacity-30" />
          <p className="font-medium text-slate-600">No employees yet</p>
          <p className="text-sm mt-1">Click "Sync from Streamline" to import all employees from Resource Master, or add manually</p>
        </div>
      ) : (
        <>
          {/* Desktop table (md+) */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-slate-500 whitespace-nowrap">Employee</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500 whitespace-nowrap">Emp ID</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500 whitespace-nowrap">Email</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500 whitespace-nowrap">Team</th>
                    <th className="text-right px-5 py-3 font-medium text-slate-500 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(emp => (
                    <tr key={emp._id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#217346]/10 flex items-center justify-center text-xs font-semibold text-[#217346] shrink-0">
                            {getInitials(emp.employee_name)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{emp.employee_name}</p>
                            {emp.designation && <p className="text-xs text-slate-400">{emp.designation}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{emp.unique_id}</td>
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{emp.official_email}</td>
                      <td className="px-5 py-3">
                        {emp.team_name ? (
                          <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-700 whitespace-nowrap">
                            {emp.team_name}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => setViewTarget(emp)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                            title="View employee"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEdit(emp)}
                            className="p-1.5 rounded-lg hover:bg-[#217346]/10 text-slate-400 hover:text-[#217346] transition-colors"
                            title="Edit employee"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setResetTarget(emp)}
                            className="p-1.5 rounded-lg hover:bg-orange-50 text-slate-400 hover:text-orange-600 transition-colors"
                            title="Reset password"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card list (< md) */}
          <div className="md:hidden space-y-2.5">
            {filtered.map(emp => (
              <div key={emp._id} className="bg-white border border-slate-200 rounded-xl px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#217346]/10 flex items-center justify-center text-xs font-semibold text-[#217346] shrink-0 mt-0.5">
                    {getInitials(emp.employee_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{emp.employee_name}</p>
                    {emp.designation && <p className="text-xs text-slate-400">{emp.designation}</p>}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => setViewTarget(emp)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" title="View">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => openEdit(emp)} className="p-1.5 rounded-lg hover:bg-[#217346]/10 text-slate-400 hover:text-[#217346] transition-colors" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setResetTarget(emp)} className="p-1.5 rounded-lg hover:bg-orange-50 text-slate-400 hover:text-orange-600 transition-colors" title="Reset password">
                      <KeyRound className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 space-y-1 pl-12">
                  <p className="text-xs text-slate-500 font-mono">{emp.unique_id}</p>
                  <p className="text-xs text-slate-500 truncate">{emp.official_email}</p>
                  {emp.team_name && (
                    <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-700">{emp.team_name}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Bulk Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(v) => { if (!v) { setUploadFile(null); setUploadResult(null); setUploadTeamId(""); } setUploadOpen(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#217346]" />
              Bulk Upload Employees
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Team <span className="text-red-500">*</span>
              </label>
              <Select value={uploadTeamId} onValueChange={setUploadTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team..." />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(t => (
                    <SelectItem key={t._id} value={t._id}>{t.team_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                File (CSV or Excel) <span className="text-red-500">*</span>
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-[#217346] transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                {uploadFile ? (
                  <p className="text-sm font-medium text-slate-700">{uploadFile.name}</p>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Click to select CSV or Excel file</p>
                    <p className="text-xs text-slate-400 mt-1">Required columns: Emp_ID, Emp_Email, Emp_Name</p>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => employeeService.downloadTemplate()}
              className="flex items-center gap-1.5 text-sm text-[#217346] hover:underline"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV template
            </button>
            {uploadResult && (
              <div className="bg-slate-50 rounded-lg p-4 text-sm space-y-1">
                <p className="font-medium">Upload Results:</p>
                <p className="text-green-700">Created: {uploadResult.summary.created}</p>
                <p className="text-orange-600">Skipped (duplicates): {uploadResult.summary.skipped}</p>
                <p className="text-red-600">Errors: {uploadResult.summary.errors}</p>
                {uploadResult.data.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-red-600">View errors</summary>
                    <ul className="mt-1 space-y-1 text-xs">
                      {uploadResult.data.errors.map((e: any, i: number) => (
                        <li key={i} className="text-red-500">{e.emp_id || e.email || 'Row'}: {e.reason}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadTeamId} className="bg-[#217346] hover:bg-[#185c37] text-white gap-2">
              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Employee Dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { if (!creating && !v) { setNewEmpId(""); setNewEmpEmail(""); setNewEmpName(""); setNewEmpTeamId(""); setNewEmpDesignation(""); setCreateErrors({}); } setCreateOpen(v); }}>
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
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Employee ID <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={newEmpId}
                onChange={e => { setNewEmpId(e.target.value); if (createErrors.emp_id) setCreateErrors(p => ({ ...p, emp_id: "" })); }}
                placeholder="e.g. 340"
                className={`w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346] ${createErrors.emp_id ? "border-red-400 bg-red-50" : "border-slate-300"}`}
              />
              <FieldError msg={createErrors.emp_id} />
            </div>
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={newEmpName}
                onChange={e => { setNewEmpName(e.target.value); if (createErrors.emp_name) setCreateErrors(p => ({ ...p, emp_name: "" })); }}
                placeholder="e.g. Abhay Ahire"
                className={`w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346] ${createErrors.emp_name ? "border-red-400 bg-red-50" : "border-slate-300"}`}
              />
              <FieldError msg={createErrors.emp_name} />
            </div>
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={newEmpEmail}
                onChange={e => { setNewEmpEmail(e.target.value); if (createErrors.emp_email) setCreateErrors(p => ({ ...p, emp_email: "" })); }}
                placeholder="abhay@company.com"
                className={`w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346] ${createErrors.emp_email ? "border-red-400 bg-red-50" : "border-slate-300"}`}
              />
              <FieldError msg={createErrors.emp_email} />
            </div>
            {/* Team */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Team <span className="text-red-500">*</span></label>
              <Select value={newEmpTeamId} onValueChange={v => { setNewEmpTeamId(v); if (createErrors.team_id) setCreateErrors(p => ({ ...p, team_id: "" })); }}>
                <SelectTrigger className={createErrors.team_id ? "border-red-400 bg-red-50" : ""}><SelectValue placeholder="Select team..." /></SelectTrigger>
                <SelectContent>
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
            <Button onClick={handleCreate} disabled={creating} className="bg-[#217346] hover:bg-[#185c37] text-white gap-2">
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Employee Dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(v) => { if (!v) setViewTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IdCard className="w-5 h-5 text-[#217346]" />
              Employee Record
            </DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="py-2 space-y-4">
              {/* Avatar + name */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-12 h-12 rounded-full bg-[#217346]/10 flex items-center justify-center text-base font-bold text-[#217346] shrink-0">
                  {getInitials(viewTarget.employee_name)}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-base">{viewTarget.employee_name}</p>
                  {viewTarget.designation && (
                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                      <Briefcase className="w-3.5 h-3.5" />
                      {viewTarget.designation}
                    </p>
                  )}
                </div>
              </div>
              {/* Fields grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-0.5">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Employee ID</p>
                  <p className="text-slate-800 font-mono font-medium">{viewTarget.unique_id || "—"}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Team</p>
                  {viewTarget.team_name
                    ? <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-700">{viewTarget.team_name}</Badge>
                    : <p className="text-slate-400">—</p>
                  }
                </div>
                <div className="col-span-2 space-y-0.5">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Email</p>
                  <p className="text-slate-800 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {viewTarget.official_email}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>Close</Button>
            <Button
              className="bg-[#217346] hover:bg-[#185c37] text-white gap-2"
              onClick={() => { setViewTarget(null); if (viewTarget) openEdit(viewTarget); }}
            >
              <Pencil className="w-4 h-4" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(v) => { if (!editing && !v) setEditTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-[#217346]" />
              Edit Employee
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={editEmpName}
                onChange={e => { setEditEmpName(e.target.value); if (editErrors.emp_name) setEditErrors(p => ({ ...p, emp_name: "" })); }}
                className={`w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346] ${editErrors.emp_name ? "border-red-400 bg-red-50" : "border-slate-300"}`}
              />
              <FieldError msg={editErrors.emp_name} />
            </div>
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
            {teams.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Team</label>
                <Select value={editEmpTeamId} onValueChange={setEditEmpTeamId}>
                  <SelectTrigger><SelectValue placeholder="Select team..." /></SelectTrigger>
                  <SelectContent>
                    {teams.map(t => <SelectItem key={t._id} value={t._id}>{t.team_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Email</p>
                <p className="text-sm text-slate-600 truncate">{editTarget?.official_email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Employee ID</p>
                <p className="text-sm font-mono text-slate-600">{editTarget?.unique_id}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editing}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editing} className="bg-[#217346] hover:bg-[#185c37] text-white gap-2">
              {editing && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Confirm */}
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

      {/* Sync Results Dialog */}
      <Dialog open={syncResultOpen} onOpenChange={setSyncResultOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Streamline Sync Complete
            </DialogTitle>
          </DialogHeader>
          {syncResult && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-slate-500">
                Processed <strong>{syncResult.total_resources}</strong> records from Streamline360 Resource Master
                (Client → Project → Resource Intimation → Employee).
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{syncResult.employees_synced}</p>
                  <p className="text-xs text-green-600 mt-0.5">Employees synced</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{syncResult.mappings_synced}</p>
                  <p className="text-xs text-blue-600 mt-0.5">Project mappings synced</p>
                </div>
              </div>
              {syncResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <p className="text-sm font-medium text-red-700">{syncResult.errors.length} record{syncResult.errors.length !== 1 ? "s" : ""} skipped</p>
                  </div>
                  <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                    {syncResult.errors.map((e, i) => (
                      <li key={i}>• {e.reason} {e.resource_id ? `(ID: ${e.resource_id})` : ""}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-slate-400">
                Employees with no matched ThinkSheet manager will appear without a manager assigned — you can assign managers manually from the Mapping tab.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setSyncResultOpen(false)} className="bg-[#217346] hover:bg-[#185c37] text-white">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ── Activity Logs Tab ─────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  MANAGER_CREATED: "Manager Created",
  MANAGER_UPDATED: "Manager Updated",
  MANAGER_PASSWORD_RESET: "Manager Password Reset",
  EMPLOYEE_CREATED: "Employee Created",
  EMPLOYEE_BULK_UPLOADED: "Bulk Upload",
  EMPLOYEE_UPDATED: "Employee Updated",
  EMPLOYEE_DELETED: "Employee Deleted",
  EMPLOYEE_PASSWORD_RESET: "Employee Password Reset",
};

const ACTION_COLORS: Record<string, string> = {
  MANAGER_CREATED: "border-blue-200 bg-blue-50 text-blue-700",
  MANAGER_UPDATED: "border-blue-200 bg-blue-50 text-blue-700",
  MANAGER_PASSWORD_RESET: "border-orange-200 bg-orange-50 text-orange-700",
  EMPLOYEE_CREATED: "border-green-200 bg-green-50 text-green-700",
  EMPLOYEE_BULK_UPLOADED: "border-purple-200 bg-purple-50 text-purple-700",
  EMPLOYEE_UPDATED: "border-green-200 bg-green-50 text-green-700",
  EMPLOYEE_DELETED: "border-red-200 bg-red-50 text-red-700",
  EMPLOYEE_PASSWORD_RESET: "border-orange-200 bg-orange-50 text-orange-700",
};

function LogsTab() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  const loadLogs = useCallback(async (p: number) => {
    try {
      setLoading(true);
      const res = await activityLogService.getAll(p, 20);
      setLogs(res.data);
      setPagination(res.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load logs"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-slate-500">
          {pagination.total} log{pagination.total !== 1 ? "s" : ""}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading logs...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center py-16 text-slate-400">
          <ScrollText className="w-10 h-10 mb-3 opacity-30" />
          <p className="font-medium text-slate-600">No activity logs yet</p>
          <p className="text-sm mt-1">Actions like creating managers and employees will appear here</p>
        </div>
      ) : (
        <>
          {/* ── Desktop table (md+) ── */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-slate-500 whitespace-nowrap">Action</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Target</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500 whitespace-nowrap">Performed By</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Details</th>
                    <th className="text-right px-5 py-3 font-medium text-slate-500 whitespace-nowrap">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <Badge
                          variant="outline"
                          className={`text-xs font-medium whitespace-nowrap ${ACTION_COLORS[log.action] || "border-slate-200 bg-slate-50 text-slate-600"}`}
                        >
                          {ACTION_LABELS[log.action] || log.action}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900">{log.target_name}</p>
                        {log.target_email && (
                          <p className="text-xs text-slate-400 mt-0.5">{log.target_email}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-slate-700">{log.performed_by_name}</p>
                        <p className="text-xs text-slate-400 mt-0.5 capitalize">{log.performed_by_role?.toLowerCase()}</p>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 max-w-[240px]">
                        <p className="truncate text-sm" title={log.details}>{log.details}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-slate-400 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Mobile card list (< md) ── */}
          <div className="md:hidden space-y-2.5">
            {logs.map((log) => (
              <div
                key={log._id}
                className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 space-y-2"
              >
                {/* Top row: badge + date */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={`text-xs font-medium ${ACTION_COLORS[log.action] || "border-slate-200 bg-slate-50 text-slate-600"}`}
                  >
                    {ACTION_LABELS[log.action] || log.action}
                  </Badge>
                  <span className="text-xs text-slate-400">{formatDate(log.createdAt)}</span>
                </div>

                {/* Target */}
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{log.target_name}</p>
                  {log.target_email && (
                    <p className="text-xs text-slate-400">{log.target_email}</p>
                  )}
                </div>

                {/* Details */}
                {log.details && (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-1.5">{log.details}</p>
                )}

                {/* Performed by */}
                <p className="text-xs text-slate-400">
                  By <span className="font-medium text-slate-600">{log.performed_by_name}</span>
                  {" "}·{" "}
                  <span className="capitalize">{log.performed_by_role?.toLowerCase()}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <span className="text-sm text-slate-500">
                Page {page} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
                className="gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Projects Tab ──────────────────────────────────────────────────────────────

interface ClientGroup {
  client_id: string;
  client_name: string;
  projects: ResourceMasterProject[];
  total_resources: number;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function ProjectsTab() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clientGroups, setClientGroups] = useState<ClientGroup[]>([]);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    streamlineService.getMyResourceProjects()
      .then(res => {
        const clientMap: Record<string, ClientGroup> = {};
        res.data.forEach(proj => {
          const key = proj.client_id || "__no_client__";
          const name = proj.client_name || "No Client";
          if (!clientMap[key]) {
            clientMap[key] = { client_id: key, client_name: name, projects: [], total_resources: 0 };
          }
          clientMap[key].projects.push(proj);
          clientMap[key].total_resources += proj.resource_count;
        });
        const groups = Object.values(clientMap).sort((a, b) => b.total_resources - a.total_resources);
        setClientGroups(groups);
        setExpandedClients(new Set(groups.map(g => g.client_id)));
      })
      .catch(err => toast.error(getErrorMessage(err, "Failed to load projects")))
      .finally(() => setLoading(false));
  }, []);

  function toggleClient(id: string) {
    setExpandedClients(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleProject(id: string) {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectProject(id: string) {
    setSelectedProjects(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function viewTimesheets(ids: string[]) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    // Build a metadata map so the dashboard can show names immediately (before API responds)
    const allProjects = clientGroups.flatMap(cg => cg.projects);
    const meta: Record<string, { project_name: string; project_code: string; client_name: string }> = {};
    ids.forEach(id => {
      const p = allProjects.find(p => p.project_id === id);
      if (p) meta[id] = { project_name: p.project_name, project_code: p.project_code, client_name: p.client_name };
    });
    navigate(`/admin/projects?projects=${ids.join(",")}&month=${month}&year=${year}`, { state: meta });
  }

  const lowerQ = searchQuery.toLowerCase().trim();
  const filteredGroups = clientGroups
    .map(cg => ({
      ...cg,
      projects: cg.projects.filter(p =>
        !lowerQ ||
        p.project_name.toLowerCase().includes(lowerQ) ||
        p.project_code.toLowerCase().includes(lowerQ) ||
        cg.client_name.toLowerCase().includes(lowerQ)
      ),
    }))
    .filter(cg => cg.projects.length > 0);

  const totalProjects = clientGroups.reduce((s, cg) => s + cg.projects.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading projects from Streamline360…</span>
      </div>
    );
  }

  if (clientGroups.length === 0) {
    return (
      <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center py-16 text-slate-400">
        <FolderOpen className="w-10 h-10 mb-3 opacity-30" />
        <p className="font-medium text-slate-600">No projects found</p>
        <p className="text-sm mt-1">Sync from Streamline360 to populate project data</p>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search projects or clients…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346] bg-white"
          />
        </div>
        <p className="text-sm text-slate-400 flex-1">
          {clientGroups.length} client{clientGroups.length !== 1 ? "s" : ""} · {totalProjects} project{totalProjects !== 1 ? "s" : ""} · live from Streamline360
        </p>
        {selectedProjects.size > 0 && (
          <Button
            size="sm"
            className="bg-[#217346] hover:bg-[#1a5c38] text-white h-9"
            onClick={() => viewTimesheets([...selectedProjects])}
          >
            <Users className="w-4 h-4 mr-1.5" />
            Open Selected ({selectedProjects.size})
          </Button>
        )}
      </div>

      {filteredGroups.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center py-12 text-slate-400">
          <Search className="w-8 h-8 mb-2 opacity-30" />
          <p className="font-medium text-slate-600">No results for "{searchQuery}"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map(cg => {
            const isClientOpen = expandedClients.has(cg.client_id);
            return (
              <div key={cg.client_id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Client header */}
                <button
                  onClick={() => toggleClient(cg.client_id)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{cg.client_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {cg.projects.length} project{cg.projects.length !== 1 ? "s" : ""} · {cg.total_resources} resource{cg.total_resources !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isClientOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Projects list */}
                {isClientOpen && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {cg.projects.map(proj => {
                      const isProjOpen = expandedProjects.has(proj.project_id);
                      return (
                        <div key={proj.project_id}>
                          {/* Project row */}
                          <div className="flex items-center gap-2 px-3 sm:px-5 py-3 pl-6 sm:pl-14 hover:bg-slate-50 transition-colors">
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={selectedProjects.has(proj.project_id)}
                              onChange={() => toggleSelectProject(proj.project_id)}
                              className="w-4 h-4 rounded border-slate-300 accent-[#217346] cursor-pointer shrink-0"
                              onClick={e => e.stopPropagation()}
                            />
                            {/* Project expand toggle */}
                            <button
                              onClick={() => toggleProject(proj.project_id)}
                              className="flex items-center gap-3 flex-1 min-w-0 text-left"
                            >
                              <div className="w-7 h-7 rounded-md bg-[#217346]/10 flex items-center justify-center shrink-0">
                                <FolderOpen className="w-3.5 h-3.5 text-[#217346]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-slate-800 text-sm">{proj.project_name || "Unnamed Project"}</span>
                                  {proj.project_code && (
                                    <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                      {proj.project_code}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                  {(proj.start_date || proj.end_date) && (
                                    <span className="text-xs text-slate-400 flex items-center gap-1">
                                      <CalendarRange className="w-3 h-3" />
                                      {formatDate(proj.start_date)} – {formatDate(proj.end_date)}
                                    </span>
                                  )}
                                  <span className="text-xs text-[#217346] flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {proj.resource_count} resource{proj.resource_count !== 1 ? "s" : ""}
                                  </span>
                                </div>
                              </div>
                              {proj.resource_count > 0 && (
                                <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform shrink-0 ${isProjOpen ? "rotate-180" : ""}`} />
                              )}
                            </button>
                            {/* View Timesheets button */}
                            <button
                              onClick={() => viewTimesheets([proj.project_id])}
                              className="shrink-0 text-xs text-[#217346] hover:text-[#1a5c38] font-medium border border-[#217346]/30 hover:border-[#217346]/60 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                            >
                              View Timesheets
                            </button>
                          </div>

                          {/* Resources list */}
                          {isProjOpen && proj.resources.length > 0 && (
                            <div className="bg-slate-50 border-t border-slate-100 overflow-x-auto">
                              <table className="w-full text-xs min-w-[560px]">
                                <thead>
                                  <tr className="border-b border-slate-200">
                                    <th className="text-left px-6 pl-20 py-2 font-medium text-slate-400">Resource ID</th>
                                    <th className="text-left px-4 py-2 font-medium text-slate-400">Name</th>
                                    <th className="text-left px-4 py-2 font-medium text-slate-400">Email</th>
                                    <th className="text-left px-4 py-2 font-medium text-slate-400">Designation</th>
                                    <th className="text-left px-4 py-2 font-medium text-slate-400">Team</th>
                                    <th className="text-left px-4 py-2 font-medium text-slate-400">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {proj.resources.map((r, i) => (
                                    <tr key={i} className="hover:bg-white transition-colors">
                                      <td className="px-6 pl-20 py-2 font-mono text-slate-600">{r.resource_id || "—"}</td>
                                      <td className="px-4 py-2 font-medium text-slate-700">{r.name || "—"}</td>
                                      <td className="px-4 py-2 text-slate-500">{r.email || "—"}</td>
                                      <td className="px-4 py-2 text-slate-500">{r.designation || "—"}</td>
                                      <td className="px-4 py-2 text-slate-500">{r.team_name || "—"}</td>
                                      <td className="px-4 py-2">
                                        <span className={`inline-flex items-center gap-1 font-medium ${r.is_active ? "text-emerald-600" : "text-slate-400"}`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${r.is_active ? "bg-emerald-500" : "bg-slate-300"}`} />
                                          {r.is_active ? "Active" : "Inactive"}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "managers" | "employees" | "logs" | "projects";

const TAB_CONFIG: { id: Tab; label: string; displayLabel?: string; icon: ReactNode }[] = [
  { id: "managers", label: "Managers", icon: <Shield className="w-4 h-4" /> },
  { id: "employees", label: "Employees", icon: <Users className="w-4 h-4" /> },
  { id: "projects", label: "Projects", displayLabel: "Clients & Projects", icon: <FolderOpen className="w-4 h-4" /> },
  { id: "logs", label: "Activity Logs", icon: <ScrollText className="w-4 h-4" /> },
];

export default function EmployeeManagerMappingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const validTabs: Tab[] = ["managers", "employees", "logs", "projects"];
  const tabParam = searchParams.get("tab") as Tab | null;
  const activeTab: Tab = tabParam && validTabs.includes(tabParam) ? tabParam : "managers";

  function switchTab(tab: Tab) {
    navigate(`/timesheet/mapping?tab=${tab}`, { replace: true });
  }

  // Get the current tab label for header
  const currentTabConfig = TAB_CONFIG.find(tab => tab.id === activeTab);
  const currentTabLabel = currentTabConfig?.displayLabel || currentTabConfig?.label || "Administration";
  const sidebarLabel = currentTabConfig?.label || "Administration";

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header with current module name - no redundant tabs */}
        <div className="mb-8 animate-slide-up">
          <div className="flex items-center gap-3">
            {currentTabConfig?.icon}
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 animate-text-fade">
                {currentTabLabel}
              </h1>
            </div>
          </div>
          <p className="text-slate-500 text-sm mt-2 animate-text-fade" style={{ animationDelay: "0.1s" }}>
            Manage {sidebarLabel.toLowerCase()}
          </p>
        </div>

        {/* Content area - tabs handled via sidebar navigation */}
        {activeTab === "managers" && <ManagersTab />}
        {activeTab === "employees" && <EmployeesTab />}
        {activeTab === "logs" && <LogsTab />}
        {activeTab === "projects" && <ProjectsTab />}
      </div>
    </DashboardLayout>
  );
}
