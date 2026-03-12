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
  DialogDescription,
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
  EyeOff,
  IdCard,
  User,
  Lock,
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
  const [showPassword, setShowPassword] = useState(false);
  const [designation, setDesignation] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [teams, setTeams] = useState<StreamlineTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setTeamsLoading(true);
      streamlineService.getEngineeringTeams()
        .then(setTeams)
        .catch(() => toast.error("Failed to load teams"))
        .finally(() => setTeamsLoading(false));
    }
  }, [open]);

  function reset() {
    setFullName(""); setEmail(""); setPassword(""); setShowPassword(false);
    setDesignation(""); setSelectedTeamIds([]); setErrors({});
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
      <DialogContent className="max-w-lg">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-[#217346]/10 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5 text-[#217346]" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-800">Create Manager</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-0.5">
                Set up a new manager account and assign teams.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Full Name + Email row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); clearError("fullName"); }}
                  placeholder="Rahul Sharma"
                  className={`w-full h-10 rounded-lg border pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/40 focus:border-[#217346] transition-colors ${errors.fullName ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"}`}
                />
              </div>
              <FieldError msg={errors.fullName} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Designation
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="Eng. Manager"
                  className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 hover:border-slate-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/40 focus:border-[#217346] transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
                placeholder="manager@company.com"
                className={`w-full h-10 rounded-lg border pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/40 focus:border-[#217346] transition-colors ${errors.email ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"}`}
              />
            </div>
            <FieldError msg={errors.email} />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
                placeholder="Min. 6 characters"
                className={`w-full h-10 rounded-lg border pl-9 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/40 focus:border-[#217346] transition-colors ${errors.password ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <FieldError msg={errors.password} />
          </div>

          {/* Teams */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Assign Teams <span className="text-red-500">*</span>
              </label>
              {selectedTeamIds.length > 0 && (
                <span className="text-xs font-medium text-[#217346] bg-[#217346]/10 px-2 py-0.5 rounded-full">
                  {selectedTeamIds.length} selected
                </span>
              )}
            </div>
            {teamsLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-4 justify-center border border-slate-200 rounded-lg bg-slate-50">
                <Loader2 className="w-4 h-4 animate-spin text-[#217346]" /> Loading teams...
              </div>
            ) : (
              <div className={`border rounded-lg divide-y max-h-44 overflow-y-auto ${errors.teams ? "border-red-400" : "border-slate-200"}`}>
                {teams.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400">No engineering teams found</div>
                ) : (
                  teams.map(team => {
                    const isChecked = selectedTeamIds.includes(team._id);
                    return (
                      <label
                        key={team._id}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isChecked ? "bg-[#217346]/5 hover:bg-[#217346]/10" : "hover:bg-slate-50"}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleTeam(team._id)}
                          className="h-4 w-4 rounded border-gray-300 accent-[#217346]"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isChecked ? "text-[#217346]" : "text-slate-700"}`}>{team.team_name}</p>
                          <p className="text-xs text-slate-400">{team.unique_id} · {team.department_id?.department_name}</p>
                        </div>
                        {isChecked && <CheckCircle2 className="w-4 h-4 text-[#217346] shrink-0" />}
                      </label>
                    );
                  })
                )}
              </div>
            )}
            <FieldError msg={errors.teams} />
          </div>
        </div>

        <DialogFooter className="pt-2 gap-2">
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={saving} className="flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving} className="flex-1 sm:flex-none bg-[#217346] hover:bg-[#185c37] text-white gap-2 shadow-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {saving ? "Creating..." : "Create Manager"}
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
        streamlineService.getEngineeringTeams(),
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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <Users className="w-4 h-4 text-[#217346]" />
            <span><strong className="text-slate-700">{managers.length}</strong> manager{managers.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <Building2 className="w-4 h-4 text-[#217346]" />
            <span><strong className="text-slate-700">{totalTeams}</strong> team{totalTeams !== 1 ? "s" : ""} assigned</span>
          </div>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#217346] hover:bg-[#185c37] text-white gap-2 shrink-0 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Manager
        </Button>
      </div>

      {/* Manager list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#217346]" />
          <span>Loading managers...</span>
        </div>
      ) : managers.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center py-16 text-slate-400">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
            <Shield className="w-7 h-7 opacity-40" />
          </div>
          <p className="font-medium text-slate-600">No managers yet</p>
          <p className="text-sm mt-1 text-slate-400">Click "Add Manager" to create the first manager account</p>
        </div>
      ) : (
        <div className="space-y-3">
          {managers.map((mgr) => {
            const teamNames = getTeamNames(mgr.team_ids);
            const isActive = mgr.is_active !== false;
            return (
              <div
                key={mgr._id}
                className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-[#217346]/30 hover:shadow-sm transition-all group"
              >
                {/* Avatar */}
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#217346]/20 to-[#217346]/10 flex items-center justify-center shrink-0 ring-2 ring-[#217346]/10">
                  <span className="text-sm font-bold text-[#217346]">{getInitials(mgr.full_name)}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900">{mgr.full_name}</p>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      isActive
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-slate-100 text-slate-500 border border-slate-200"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-green-500" : "bg-slate-400"}`} />
                      {isActive ? "Active" : "Inactive"}
                    </span>
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
                        <span key={name} className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-[#217346]/8 text-[#217346] border border-[#217346]/20">
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditManager(mgr)}
                    className="p-2 rounded-lg hover:bg-[#217346]/10 text-slate-400 hover:text-[#217346] transition-colors"
                    title="Edit manager"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setResetTarget(mgr)}
                    className="p-2 rounded-lg hover:bg-orange-50 text-slate-400 hover:text-orange-600 transition-colors"
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
        <AlertDialogContent className="max-w-sm">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-orange-500" />
            </div>
          </div>

          <AlertDialogHeader className="mb-0 text-center">
            <AlertDialogTitle className="text-center text-slate-900">Reset Password</AlertDialogTitle>
            <AlertDialogDescription className="text-center mt-2 leading-relaxed">
              Reset password for{" "}
              <span className="font-semibold text-slate-700">{resetTarget?.full_name}</span>{" "}
              to{" "}
              <code className="bg-orange-50 border border-orange-200 text-orange-600 px-1.5 py-0.5 rounded font-mono text-xs">Think@2026</code>
              ?
              <span className="block mt-1.5 text-slate-400 text-xs">They will be prompted to change it on next login.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="mt-5 flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              onClick={() => setResetTarget(null)}
              disabled={resetting}
              className="flex-1"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 bg-orange-500 hover:bg-orange-600 gap-2 shadow-sm"
              onClick={handleResetPassword}
              disabled={resetting}
            >
              {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {resetting ? "Resetting..." : "Reset Password"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Edit Manager Dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!editSaving && !open) closeEditManager(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-[#217346]/10 flex items-center justify-center shrink-0">
                <Pencil className="w-5 h-5 text-[#217346]" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-slate-800">Edit Manager</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-0.5">
                  Update manager details and team assignments.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Full Name + Designation row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => { setEditName(e.target.value); setEditErrors(p => { const n = { ...p }; delete n.editName; return n; }); }}
                    placeholder="Rahul Sharma"
                    className={`w-full h-10 rounded-lg border pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/40 focus:border-[#217346] transition-colors ${editErrors.editName ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"}`}
                  />
                </div>
                <FieldError msg={editErrors.editName} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Designation
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={editDesignation}
                    onChange={(e) => setEditDesignation(e.target.value)}
                    placeholder="Eng. Manager"
                    className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 hover:border-slate-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/40 focus:border-[#217346] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Read-only email */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <p className="w-full h-10 rounded-lg border border-slate-200 bg-slate-100 pl-9 pr-3 text-sm text-slate-500 flex items-center cursor-not-allowed select-none">
                  {editTarget?.email}
                </p>
              </div>
              <p className="text-xs text-slate-400 mt-1">Email cannot be changed.</p>
            </div>

            {/* Teams */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Assigned Teams <span className="text-red-500">*</span>
                </label>
                {editTeamIds.length > 0 && (
                  <span className="text-xs font-medium text-[#217346] bg-[#217346]/10 px-2 py-0.5 rounded-full">
                    {editTeamIds.length} selected
                  </span>
                )}
              </div>
              <div className={`border rounded-lg divide-y max-h-44 overflow-y-auto ${editErrors.editTeams ? "border-red-400" : "border-slate-200"}`}>
                {teams.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400">No engineering teams found</div>
                ) : (
                  teams.map(team => {
                    const isChecked = editTeamIds.includes(team._id);
                    return (
                      <label
                        key={team._id}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isChecked ? "bg-[#217346]/5 hover:bg-[#217346]/10" : "hover:bg-slate-50"}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setEditTeamIds(prev =>
                              prev.includes(team._id) ? prev.filter(id => id !== team._id) : [...prev, team._id]
                            );
                            setEditErrors(p => { const n = { ...p }; delete n.editTeams; return n; });
                          }}
                          className="h-4 w-4 rounded border-gray-300 accent-[#217346]"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isChecked ? "text-[#217346]" : "text-slate-700"}`}>{team.team_name}</p>
                          <p className="text-xs text-slate-400">{team.unique_id} · {team.department_id?.department_name}</p>
                        </div>
                        {isChecked && <CheckCircle2 className="w-4 h-4 text-[#217346] shrink-0" />}
                      </label>
                    );
                  })
                )}
              </div>
              <FieldError msg={editErrors.editTeams} />
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button variant="outline" onClick={closeEditManager} disabled={editSaving} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={editSaving} className="flex-1 sm:flex-none bg-[#217346] hover:bg-[#185c37] text-white gap-2 shadow-sm">
              {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
              {editSaving ? "Saving..." : "Save Changes"}
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
        streamlineService.getEngineeringTeams(),
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
      toast.success(`Sync complete — ${res.data.employees_synced} employees synced. Login password = Employee ID.`);
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
      toast.success(`Employee ${newEmpName.trim()} created. Login: ${newEmpEmail.trim()} / ${newEmpId.trim()}`);
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
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
          {/* Search */}
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search name, email or ID…"
              className="w-full h-9 pl-9 pr-8 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/40 focus:border-[#217346] transition-colors hover:border-slate-300"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
          <Select value={filterTeamId} onValueChange={setFilterTeamId}>
            <SelectTrigger className="w-40 h-9 border-slate-200 hover:border-slate-300 focus:ring-[#217346]/40 focus:border-[#217346]">
              <span className="text-sm truncate">
                {filterTeamId === "all" ? "All Teams" : (teams.find(t => t._id === filterTeamId)?.team_name || "All Teams")}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map(t => <SelectItem key={t._id} value={t._id}>{t.team_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <Users className="w-4 h-4 text-[#217346]" />
            <span><strong className="text-slate-700">{filtered.length}</strong> of <strong className="text-slate-700">{employees.length}</strong></span>
          </div>
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
          <Button onClick={() => setCreateOpen(true)} className="bg-[#217346] hover:bg-[#185c37] text-white gap-2 whitespace-nowrap shadow-sm">
            <Plus className="w-4 h-4" />
            Add Employee
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#217346]" />
          <span className="text-sm">Loading employees...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
            <Users className="w-7 h-7 text-slate-400 opacity-60" />
          </div>
          <p className="font-medium text-slate-600">
            {searchQuery || filterTeamId !== "all" ? "No employees match your filters" : "No employees yet"}
          </p>
          <p className="text-sm mt-1 text-slate-400 text-center max-w-xs">
            {searchQuery || filterTeamId !== "all"
              ? "Try adjusting your search or team filter"
              : `Click "Sync from Streamline" to import employees, or add manually`}
          </p>
          {(searchQuery || filterTeamId !== "all") && (
            <button
              onClick={() => { setSearchQuery(""); setFilterTeamId("all"); }}
              className="mt-3 text-sm text-[#217346] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table (md+) */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Employee</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Emp ID</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Email</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Team</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(emp => (
                    <tr key={emp._id} className="hover:bg-slate-50/80 transition-colors group cursor-default">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#217346]/20 to-[#217346]/10 flex items-center justify-center text-xs font-bold text-[#217346] shrink-0 ring-2 ring-[#217346]/10">
                            {getInitials(emp.employee_name)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{emp.employee_name}</p>
                            {emp.designation && <p className="text-xs text-slate-400 mt-0.5">{emp.designation}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{emp.unique_id}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-sm whitespace-nowrap">{emp.official_email}</td>
                      <td className="px-5 py-3.5">
                        {emp.team_name ? (
                          <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-[#217346]/8 text-[#217346] border border-[#217346]/20 whitespace-nowrap">
                            {emp.team_name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
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
              <div key={emp._id} className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 hover:border-[#217346]/30 hover:shadow-sm transition-all group">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#217346]/20 to-[#217346]/10 flex items-center justify-center text-xs font-bold text-[#217346] shrink-0 ring-2 ring-[#217346]/10 mt-0.5">
                    {getInitials(emp.employee_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{emp.employee_name}</p>
                    {emp.designation && <p className="text-xs text-slate-400">{emp.designation}</p>}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
                  <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{emp.unique_id}</span>
                  <p className="text-xs text-slate-500 truncate mt-1">{emp.official_email}</p>
                  {emp.team_name && (
                    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-[#217346]/8 text-[#217346] border border-[#217346]/20 mt-1">
                      {emp.team_name}
                    </span>
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
          <DialogHeader className="pb-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-[#217346]/10 flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5 text-[#217346]" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-slate-800">Bulk Upload Employees</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-0.5">Upload a CSV or Excel file to add multiple employees at once.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Team <span className="text-red-500">*</span>
              </label>
              <Select value={uploadTeamId} onValueChange={setUploadTeamId}>
                <SelectTrigger className="border-slate-200 bg-slate-50 hover:border-slate-300 focus:ring-[#217346]/40 focus:border-[#217346]">
                  <SelectValue placeholder="Select team..." />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(t => <SelectItem key={t._id} value={t._id}>{t.team_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                File (CSV or Excel) <span className="text-red-500">*</span>
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${uploadFile ? "border-[#217346]/40 bg-[#217346]/5" : "border-slate-200 hover:border-[#217346]/50 hover:bg-[#217346]/5"}`}
              >
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
                {uploadFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-[#217346]/10 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-[#217346]" />
                    </div>
                    <p className="text-sm font-medium text-[#217346]">{uploadFile.name}</p>
                    <p className="text-xs text-slate-400">Click to change file</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-600 font-medium">Click to select file</p>
                    <p className="text-xs text-slate-400">CSV or Excel · Required columns: Emp_ID, Emp_Email, Emp_Name</p>
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => employeeService.downloadTemplate()} className="flex items-center gap-1.5 text-sm text-[#217346] hover:underline">
              <Download className="w-3.5 h-3.5" />
              Download CSV template
            </button>
            {uploadResult && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Upload Results</p>
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-100">
                  <div className="p-3 text-center">
                    <p className="text-xl font-bold text-green-600">{uploadResult.summary.created}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Created</p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-xl font-bold text-orange-500">{uploadResult.summary.skipped}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Skipped</p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-xl font-bold text-red-500">{uploadResult.summary.errors}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Errors</p>
                  </div>
                </div>
                {uploadResult.data.errors.length > 0 && (
                  <details className="border-t border-slate-100">
                    <summary className="cursor-pointer text-xs text-red-600 font-medium px-4 py-2 hover:bg-red-50 transition-colors">View {uploadResult.data.errors.length} error{uploadResult.data.errors.length !== 1 ? "s" : ""}</summary>
                    <ul className="px-4 pb-3 space-y-1">
                      {uploadResult.data.errors.map((e: any, i: number) => (
                        <li key={i} className="text-xs text-red-500">• {e.emp_id || e.email || 'Row'}: {e.reason}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="pt-2 gap-2">
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading} className="flex-1 sm:flex-none">Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadTeamId} className="flex-1 sm:flex-none bg-[#217346] hover:bg-[#185c37] text-white gap-2 shadow-sm">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Employee Dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { if (!creating && !v) { setNewEmpId(""); setNewEmpEmail(""); setNewEmpName(""); setNewEmpTeamId(""); setNewEmpDesignation(""); setCreateErrors({}); } setCreateOpen(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-[#217346]/10 flex items-center justify-center shrink-0">
                <UserPlus className="w-5 h-5 text-[#217346]" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-slate-800">Add Employee</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-0.5">Create a new employee account and assign to a team.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {/* Emp ID + Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Employee ID <span className="text-red-500">*</span></label>
                <div className="relative">
                  <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={newEmpId}
                    onChange={e => { setNewEmpId(e.target.value); if (createErrors.emp_id) setCreateErrors(p => ({ ...p, emp_id: "" })); }}
                    placeholder="e.g. 340"
                    className={`w-full h-10 rounded-lg border pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/40 focus:border-[#217346] transition-colors ${createErrors.emp_id ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"}`}
                  />
                </div>
                <FieldError msg={createErrors.emp_id} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Designation</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={newEmpDesignation}
                    onChange={e => setNewEmpDesignation(e.target.value)}
                    placeholder="Software Engineer"
                    className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 hover:border-slate-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/40 focus:border-[#217346] transition-colors"
                  />
                </div>
              </div>
            </div>
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Full Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={newEmpName}
                  onChange={e => { setNewEmpName(e.target.value); if (createErrors.emp_name) setCreateErrors(p => ({ ...p, emp_name: "" })); }}
                  placeholder="Abhay Ahire"
                  className={`w-full h-10 rounded-lg border pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/40 focus:border-[#217346] transition-colors ${createErrors.emp_name ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"}`}
                />
              </div>
              <FieldError msg={createErrors.emp_name} />
            </div>
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Email <span className="text-red-500">*</span></label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  value={newEmpEmail}
                  onChange={e => { setNewEmpEmail(e.target.value); if (createErrors.emp_email) setCreateErrors(p => ({ ...p, emp_email: "" })); }}
                  placeholder="abhay@company.com"
                  className={`w-full h-10 rounded-lg border pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/40 focus:border-[#217346] transition-colors ${createErrors.emp_email ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"}`}
                />
              </div>
              <FieldError msg={createErrors.emp_email} />
            </div>
            {/* Team */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Team <span className="text-red-500">*</span></label>
              <Select value={newEmpTeamId} onValueChange={v => { setNewEmpTeamId(v); if (createErrors.team_id) setCreateErrors(p => ({ ...p, team_id: "" })); }}>
                <SelectTrigger className={`${createErrors.team_id ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"} focus:ring-[#217346]/40 focus:border-[#217346]`}>
                  <SelectValue placeholder="Select team..." />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(t => <SelectItem key={t._id} value={t._id}>{t.team_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError msg={createErrors.team_id} />
            </div>
            {/* Default password hint */}
            <div className="flex items-start gap-2.5 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
              <Lock className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-500">
                Default password: <span className="font-mono font-semibold text-slate-700">Employee ID</span> — employee logs in with their own ID as the password.
              </p>
            </div>
          </div>
          <DialogFooter className="pt-2 gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating} className="flex-1 sm:flex-none">Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="flex-1 sm:flex-none bg-[#217346] hover:bg-[#185c37] text-white gap-2 shadow-sm">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {creating ? "Creating..." : "Create Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Employee Dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(v) => { if (!v) setViewTarget(null); }}>
        <DialogContent className="max-w-sm">
          {viewTarget && (
            <>
              {/* Profile header */}
              <div className="flex flex-col items-center pt-2 pb-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#217346]/20 to-[#217346]/10 flex items-center justify-center text-xl font-bold text-[#217346] ring-4 ring-[#217346]/10 mb-3">
                  {getInitials(viewTarget.employee_name)}
                </div>
                <p className="font-bold text-slate-900 text-lg leading-tight">{viewTarget.employee_name}</p>
                {viewTarget.designation && (
                  <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                    <Briefcase className="w-3.5 h-3.5" />
                    {viewTarget.designation}
                  </p>
                )}
                {viewTarget.team_name && (
                  <span className="inline-flex items-center mt-2 text-xs font-medium px-2.5 py-1 rounded-full bg-[#217346]/10 text-[#217346] border border-[#217346]/20">
                    {viewTarget.team_name}
                  </span>
                )}
              </div>

              {/* Info rows */}
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden mb-4">
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50/50">
                  <IdCard className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Employee ID</p>
                    <p className="text-sm font-mono font-semibold text-slate-800 mt-0.5">{viewTarget.unique_id || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50/50">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Email</p>
                    <p className="text-sm text-slate-800 mt-0.5 truncate">{viewTarget.official_email}</p>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setViewTarget(null)} className="flex-1">Close</Button>
                <Button
                  className="flex-1 bg-[#217346] hover:bg-[#185c37] text-white gap-2"
                  onClick={() => { setViewTarget(null); openEdit(viewTarget); }}
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(v) => { if (!editing && !v) setEditTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-[#217346]/10 flex items-center justify-center shrink-0">
                <Pencil className="w-5 h-5 text-[#217346]" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-slate-800">Edit Employee</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-0.5">Update employee details and team assignment.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {/* Full Name + Designation */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Full Name <span className="text-red-500">*</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={editEmpName}
                    onChange={e => { setEditEmpName(e.target.value); if (editErrors.emp_name) setEditErrors(p => ({ ...p, emp_name: "" })); }}
                    placeholder="Full name"
                    className={`w-full h-10 rounded-lg border pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/40 focus:border-[#217346] transition-colors ${editErrors.emp_name ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"}`}
                  />
                </div>
                <FieldError msg={editErrors.emp_name} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Designation</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={editEmpDesignation}
                    onChange={e => setEditEmpDesignation(e.target.value)}
                    placeholder="Software Engineer"
                    className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 hover:border-slate-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/40 focus:border-[#217346] transition-colors"
                  />
                </div>
              </div>
            </div>
            {/* Team */}
            {teams.length > 1 && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Team</label>
                <Select value={editEmpTeamId} onValueChange={setEditEmpTeamId}>
                  <SelectTrigger className="border-slate-200 bg-slate-50 hover:border-slate-300 focus:ring-[#217346]/40 focus:border-[#217346]">
                    <SelectValue placeholder="Select team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map(t => <SelectItem key={t._id} value={t._id}>{t.team_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Read-only fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <p className="w-full h-10 rounded-lg border border-slate-200 bg-slate-100 pl-9 pr-3 text-sm text-slate-500 flex items-center cursor-not-allowed truncate">{editTarget?.official_email}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Employee ID</label>
                <div className="relative">
                  <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <p className="w-full h-10 rounded-lg border border-slate-200 bg-slate-100 pl-9 pr-3 text-sm text-slate-500 flex items-center font-mono cursor-not-allowed">{editTarget?.unique_id}</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-2 gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editing} className="flex-1 sm:flex-none">Cancel</Button>
            <Button onClick={handleEdit} disabled={editing} className="flex-1 sm:flex-none bg-[#217346] hover:bg-[#185c37] text-white gap-2 shadow-sm">
              {editing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
              {editing ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Confirm */}
      <AlertDialog open={!!resetTarget} onOpenChange={() => { if (!resetting) setResetTarget(null); }}>
        <AlertDialogContent className="max-w-sm">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-orange-500" />
            </div>
          </div>
          <AlertDialogHeader className="mb-0">
            <AlertDialogTitle className="text-center text-slate-900">Reset Password</AlertDialogTitle>
            <AlertDialogDescription className="text-center mt-2 leading-relaxed">
              Reset password for{" "}
              <span className="font-semibold text-slate-700">{resetTarget?.employee_name}</span>{" "}
              to{" "}
              <code className="bg-orange-50 border border-orange-200 text-orange-600 px-1.5 py-0.5 rounded font-mono text-xs">Think@2026</code>?
              <span className="block mt-1.5 text-slate-400 text-xs">They will be prompted to change it on next login.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5 flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setResetTarget(null)} disabled={resetting} className="flex-1">Cancel</AlertDialogCancel>
            <AlertDialogAction className="flex-1 bg-orange-500 hover:bg-orange-600 gap-2 shadow-sm" onClick={handleResetPassword} disabled={resetting}>
              {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {resetting ? "Resetting..." : "Reset Password"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sync Results Dialog */}
      <Dialog open={syncResultOpen} onOpenChange={setSyncResultOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pb-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-slate-800">Sync Complete</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-0.5">
                  Processed <strong className="text-slate-700">{syncResult?.total_resources ?? 0}</strong> records from Streamline360.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {syncResult && (
            <div className="space-y-4 py-1">
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">{syncResult.employees_synced}</p>
                  <p className="text-xs font-medium text-green-700 mt-1">Employees synced</p>
                </div>
                <div className="bg-[#217346]/5 border border-[#217346]/15 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-[#217346]">{syncResult.mappings_synced}</p>
                  <p className="text-xs font-medium text-[#217346] mt-1">Project mappings</p>
                </div>
              </div>
              {/* Errors */}
              {syncResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-sm font-semibold text-red-700">{syncResult.errors.length} record{syncResult.errors.length !== 1 ? "s" : ""} skipped</p>
                  </div>
                  <ul className="text-xs text-red-600 space-y-1 max-h-28 overflow-y-auto">
                    {syncResult.errors.map((e, i) => (
                      <li key={i}>• {e.reason} {e.resource_id ? `(ID: ${e.resource_id})` : ""}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 leading-relaxed">
                Login credentials created for each employee. Default password = Employee ID. Employees without a matched manager can be assigned from the Mapping tab.
              </p>
            </div>
          )}
          <DialogFooter className="pt-2">
            <Button onClick={() => setSyncResultOpen(false)} className="bg-[#217346] hover:bg-[#185c37] text-white gap-2 shadow-sm w-full sm:w-auto">
              <CheckCircle2 className="w-4 h-4" />
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
