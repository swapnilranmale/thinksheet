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
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import {
  employeeService,
  streamlineService,
  managerTimesheetService,
  EmployeeMaster,
  StreamlineTeam,
  SyncResult,
  activityLogService,
  ActivityLog,
  ResourceMasterProject,
} from "@/services/timesheet";
import { authService } from "@/lib/auth";
import { TeamMultiSelect } from "@/components/ui/team-multi-select";
import { exportAdminProjectsXLSX, AdminExportProject, AdminTimesheetEntry } from "@/lib/timesheetExport";

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
      streamlineService.getTeams()
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
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Assign Teams <span className="text-red-500">*</span>
            </label>
            {teamsLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-4 justify-center border border-slate-200 rounded-lg bg-slate-50">
                <Loader2 className="w-4 h-4 animate-spin text-[#217346]" /> Loading teams...
              </div>
            ) : (
              <TeamMultiSelect
                teams={teams}
                selectedIds={selectedTeamIds}
                onChange={(ids) => { setSelectedTeamIds(ids); if (errors.teams) setErrors(p => ({ ...p, teams: "" })); }}
                error={errors.teams}
                placeholder="Select teams..."
              />
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
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const PAGE_SIZE = 20;
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const loadManagers = useCallback(async (p = 1, search = "") => {
    try {
      setLoading(true);
      const [res, teamsData] = await Promise.all([
        authService.getManagers({ page: p, limit: PAGE_SIZE, search: search || undefined }),
        streamlineService.getTeams(),
      ]);
      setManagers(res.data.data);
      setPagination(res.data.pagination ?? { total: res.data.data?.length ?? 0, page: 1, limit: PAGE_SIZE, pages: 1 });
      setTeams(teamsData);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load managers"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadManagers(1, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  function handleSearch(q: string) {
    setSearchQuery(q);
    setPage(1);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => loadManagers(1, q), 400);
  }

  function goToPage(p: number) {
    setPage(p);
    loadManagers(p, searchQuery);
  }

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
      await loadManagers(page, searchQuery);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update manager"));
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Search */}
          <div className="relative min-w-[220px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search managers…"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#217346]/50 focus:border-[#217346] transition-all hover:border-slate-400"
            />
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-500 whitespace-nowrap">
            <Users className="w-4 h-4 text-[#217346]" />
            <span><strong className="text-slate-700">{pagination.total}</strong> manager{pagination.total !== 1 ? "s" : ""}</span>
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
          <p className="font-medium text-slate-600">{searchQuery ? "No managers match your search" : "No managers yet"}</p>
          <p className="text-sm mt-1 text-slate-400">{searchQuery ? "Try a different search term" : "Click \"Add Manager\" to create the first manager account"}</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
          <div className="overflow-y-auto flex-1 p-3 space-y-3">
          {managers.map((mgr) => {
            const teamNames = getTeamNames(mgr.team_ids);
            const isActive = mgr.is_active !== false;
            const menuOpen = openMenuId === mgr._id;
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

                {/* Three-dots action menu */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setOpenMenuId(menuOpen ? null : mgr._id)}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                      <div className="absolute right-0 top-9 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                        <button
                          onClick={() => { setOpenMenuId(null); openEditManager(mgr); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Pencil className="w-4 h-4 text-[#217346]" />
                          Edit Manager
                        </button>
                        <button
                          onClick={() => { setOpenMenuId(null); setResetTarget(mgr); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <KeyRound className="w-4 h-4 text-orange-500" />
                          Reset Password
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          </div>
          {/* Pagination — inside card, outside scroll */}
          {pagination.total > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-white shrink-0">
              <span className="text-xs text-slate-400">
                Showing <strong>{pagination.total}</strong> manager{pagination.total !== 1 ? "s" : ""} · Page <strong>{page}</strong> of <strong>{pagination.pages}</strong>
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1 || loading}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === pagination.pages || Math.abs(p - page) <= 1)
                  .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`ellipsis-${i}`} className="px-1.5 text-slate-400 text-xs">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => goToPage(p as number)}
                        disabled={loading}
                        className={`min-w-[30px] h-[30px] rounded-lg text-xs font-medium transition-colors ${
                          page === p
                            ? "bg-[#217346] text-white shadow-sm"
                            : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= pagination.pages || loading}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <CreateManagerDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => loadManagers(1, searchQuery)}
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
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Assigned Teams <span className="text-red-500">*</span>
              </label>
              <TeamMultiSelect
                teams={teams}
                selectedIds={editTeamIds}
                onChange={(ids) => { setEditTeamIds(ids); setEditErrors(p => { const n = { ...p }; delete n.editTeams; return n; }); }}
                error={editErrors.editTeams}
                placeholder="Select teams..."
              />
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const PAGE_SIZE = 20;
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const loadData = useCallback(async (p = 1, search = "", teamId = "all") => {
    try {
      setLoading(true);
      const [empRes, teamsData] = await Promise.all([
        employeeService.getAll({
          page: p,
          limit: PAGE_SIZE,
          search: search || undefined,
          teamId: teamId !== "all" ? teamId : undefined,
        }),
        streamlineService.getTeams(),
      ]);
      setEmployees(empRes.data);
      setPagination(empRes.pagination ?? { total: empRes.data?.length ?? 0, page: 1, limit: PAGE_SIZE, pages: 1 });
      setTeams(teamsData);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load employees"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      await loadData(1, "", "all");
      await handleSync(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(q: string) {
    setSearchQuery(q);
    setPage(1);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => loadData(1, q, filterTeamId), 400);
  }

  function handleTeamFilter(teamId: string) {
    setFilterTeamId(teamId);
    setPage(1);
    loadData(1, searchQuery, teamId);
  }

  function goToPage(p: number) {
    setPage(p);
    loadData(p, searchQuery, filterTeamId);
  }

  async function handleSync(auto = false) {
    setSyncing(true);
    try {
      const res = await streamlineService.syncResources();
      const result = res.data;
      const shouldShowModal = result.is_first_sync || result.new_employees_count > 0;
      if (shouldShowModal) {
        setSyncResult(result);
        setSyncResultOpen(true);
        if (!auto) {
          toast.success(`Sync complete — ${result.new_employees_count} new employee${result.new_employees_count !== 1 ? "s" : ""} synced. Login password = Employee ID.`);
        }
      } else if (!auto) {
        toast.info("No new employees found in Streamline360.");
      }
      setPage(1);
      await loadData(1, searchQuery, filterTeamId);
    } catch (err) {
      if (!auto) toast.error(getErrorMessage(err, "Sync from Streamline failed"));
    } finally {
      setSyncing(false);
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
      await loadData(page, searchQuery, filterTeamId);
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

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
          {/* Search */}
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search name, email or ID…"
              className="w-full h-9 pl-9 pr-8 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/40 focus:border-[#217346] transition-colors hover:border-slate-300"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
          <Select value={filterTeamId} onValueChange={handleTeamFilter}>
            <SelectTrigger className="w-40 h-9 border-slate-200 hover:border-slate-300 focus:ring-[#217346]/40 focus:border-[#217346]">
              <span className="text-sm truncate">
                {filterTeamId === "all" ? "All Teams" : (teams.find(t => t._id === filterTeamId)?.team_name || "All Teams")}
              </span>
            </SelectTrigger>
            <SelectContent searchable>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map(t => <SelectItem key={t._id} value={t._id}>{t.team_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <Users className="w-4 h-4 text-[#217346]" />
            <span><strong className="text-slate-700">{pagination.total}</strong> employee{pagination.total !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button
            variant="outline"
            onClick={() => handleSync(false)}
            disabled={syncing}
            className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 whitespace-nowrap"
            title="Fetch all employees and project assignments from Streamline360 Resource Master"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? "Syncing..." : "Sync"}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
      {loading || (syncing && employees.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#217346]" />
          <span className="text-sm">{syncing && !loading ? "Syncing employees from Streamline360…" : "Loading employees..."}</span>
        </div>
      ) : employees.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center py-16 text-slate-400">
          <Users className="w-10 h-10 mb-3 opacity-30" />
          <p className="font-medium text-slate-600">{searchQuery || filterTeamId !== "all" ? "No employees match your filters" : "No employees yet"}</p>
          <p className="text-sm mt-1">{searchQuery || filterTeamId !== "all" ? "Try adjusting your search or team filter" : "Click \"Sync\" to import employees from Streamline360"}</p>
        </div>
      ) : (
        <>
          {/* Desktop table (md+) */}
          <div className="hidden md:flex md:flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-full">
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Employee</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Emp ID</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Resource ID</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Actual Resource</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Profile Resource</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Email</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Team</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map(emp => (
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
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs text-slate-500">{emp.resource_id || '—'}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 text-sm whitespace-nowrap">{emp.actual_resource || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-500 text-sm whitespace-nowrap">{emp.profile_resource || '—'}</td>
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
                        <div className="relative flex justify-end">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === emp._id ? null : emp._id)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openMenuId === emp._id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                              <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                                <button
                                  onClick={() => { setOpenMenuId(null); setViewTarget(emp); }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  <Eye className="w-4 h-4 text-slate-500" />
                                  View
                                </button>
                                <button
                                  onClick={() => { setOpenMenuId(null); openEdit(emp); }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  <Pencil className="w-4 h-4 text-[#217346]" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => { setOpenMenuId(null); setResetTarget(emp); }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  <KeyRound className="w-4 h-4 text-orange-500" />
                                  Reset Password
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination — inside card, outside scroll */}
            {pagination.total > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-white shrink-0">
                <span className="text-xs text-slate-400">
                  Showing <strong>{pagination.total}</strong> employee{pagination.total !== 1 ? "s" : ""} · Page <strong>{page}</strong> of <strong>{pagination.pages}</strong>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1 || loading}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === pagination.pages || Math.abs(p - page) <= 1)
                    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "…" ? (
                        <span key={`ellipsis-${i}`} className="px-1.5 text-slate-400 text-xs">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => goToPage(p as number)}
                          disabled={loading}
                          className={`min-w-[30px] h-[30px] rounded-lg text-xs font-medium transition-colors ${
                            page === p
                              ? "bg-[#217346] text-white shadow-sm"
                              : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= pagination.pages || loading}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile card list (< md) */}
          <div className="md:hidden space-y-2.5">
            {employees.map(emp => (
              <div key={emp._id} className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 hover:border-[#217346]/30 hover:shadow-sm transition-all group">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#217346]/20 to-[#217346]/10 flex items-center justify-center text-xs font-bold text-[#217346] shrink-0 ring-2 ring-[#217346]/10 mt-0.5">
                    {getInitials(emp.employee_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{emp.employee_name}</p>
                    {emp.designation && <p className="text-xs text-slate-400">{emp.designation}</p>}
                  </div>
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === emp._id ? null : emp._id)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {openMenuId === emp._id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                          <button onClick={() => { setOpenMenuId(null); setViewTarget(emp); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                            <Eye className="w-4 h-4 text-slate-500" />View
                          </button>
                          <button onClick={() => { setOpenMenuId(null); openEdit(emp); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                            <Pencil className="w-4 h-4 text-[#217346]" />Edit
                          </button>
                          <button onClick={() => { setOpenMenuId(null); setResetTarget(emp); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                            <KeyRound className="w-4 h-4 text-orange-500" />Reset Password
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-2 space-y-1 pl-12">
                  <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{emp.unique_id}</span>
                  <p className="text-xs text-slate-500 truncate mt-1">{emp.official_email}</p>
                  {emp.profile_resource && (
                    <p className="text-xs text-slate-400 truncate">Profile: <span className="text-slate-600">{emp.profile_resource}</span></p>
                  )}
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
      </div>

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
                {(viewTarget.actual_resource || viewTarget.profile_resource) && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-50/50">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
                      {viewTarget.actual_resource && (
                        <div>
                          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Actual Resource</p>
                          <p className="text-sm text-slate-800 mt-0.5 truncate">{viewTarget.actual_resource}</p>
                        </div>
                      )}
                      {viewTarget.profile_resource && (
                        <div>
                          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Profile Resource</p>
                          <p className="text-sm text-slate-800 mt-0.5 truncate">{viewTarget.profile_resource}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
                  <SelectTrigger><SelectValue placeholder="Select team..." /></SelectTrigger>
                  <SelectContent searchable>
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
                  {syncResult?.is_first_sync
                    ? <>Imported <strong className="text-slate-700">{syncResult.employees_synced}</strong> employees from Streamline360.</>
                    : <><strong className="text-slate-700">{syncResult?.new_employees_count ?? 0}</strong> new employee{(syncResult?.new_employees_count ?? 0) !== 1 ? "s" : ""} added from Streamline360.</>
                  }
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {syncResult && (
            <div className="space-y-4 py-1">
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">
                    {syncResult.is_first_sync ? syncResult.employees_synced : syncResult.new_employees_count}
                  </p>
                  <p className="text-xs font-medium text-green-700 mt-1">
                    {syncResult.is_first_sync ? "Total employees synced" : "New employees added"}
                  </p>
                </div>
                <div className="bg-[#217346]/5 border border-[#217346]/15 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-[#217346]">{syncResult.mappings_synced}</p>
                  <p className="text-xs font-medium text-[#217346] mt-1">Project mappings</p>
                </div>
              </div>
              {/* Synced employees list */}
              {syncResult.synced_employees && syncResult.synced_employees.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 border-b border-slate-200">
                    Synced Employees
                  </div>
                  <ul className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                    {syncResult.synced_employees.map((emp, i) => (
                      <li key={i} className="px-3 py-2 flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-[#217346]/10 flex items-center justify-center text-[10px] font-bold text-[#217346] shrink-0">
                          {emp.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">{emp.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{emp.email}</p>
                        </div>
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded shrink-0">
                          {emp.unique_id}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 shrink-0">
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
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
          {/* ── Desktop table (md+) ── */}
          <div className="hidden md:flex md:flex-col flex-1 overflow-hidden">
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
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
            {/* Pagination — pinned at bottom */}
            {pagination.total > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-white shrink-0">
                <span className="text-xs text-slate-400">
                  Showing <strong>{pagination.total}</strong> log{pagination.total !== 1 ? "s" : ""} · Page <strong>{page}</strong> of <strong>{pagination.pages}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="gap-1 h-8">
                    <ChevronLeft className="w-4 h-4" />Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="gap-1 h-8">
                    Next<ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ── Mobile card list (< md) ── */}
          <div className="md:hidden overflow-y-auto flex-1 p-3 space-y-2.5">
            {logs.map((log) => (
              <div
                key={log._id}
                className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 space-y-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-xs font-medium ${ACTION_COLORS[log.action] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                    {ACTION_LABELS[log.action] || log.action}
                  </Badge>
                  <span className="text-xs text-slate-400">{formatDate(log.createdAt)}</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{log.target_name}</p>
                  {log.target_email && <p className="text-xs text-slate-400">{log.target_email}</p>}
                </div>
                {log.details && <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-1.5">{log.details}</p>}
                <p className="text-xs text-slate-400">
                  By <span className="font-medium text-slate-600">{log.performed_by_name}</span>{" "}·{" "}
                  <span className="capitalize">{log.performed_by_role?.toLowerCase()}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
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

  // Drill-down state
  type ProjectView = "clients" | "projects" | "resources";
  const [projectView, setProjectView] = useState<ProjectView>("clients");
  const [selectedClient, setSelectedClient] = useState<ClientGroup | null>(null);
  const [selectedProject, setSelectedProject] = useState<ResourceMasterProject | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");

  // Export state
  const [exportOpen, setExportOpen] = useState(false);
  const [exportProjects, setExportProjects] = useState<AdminExportProject[]>([]);
  const [exportLabel, setExportLabel] = useState("");
  const [exporting, setExporting] = useState(false);
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [exportFrom, setExportFrom] = useState(firstOfMonth.toISOString().split("T")[0]);
  const [exportTo, setExportTo] = useState(today.toISOString().split("T")[0]);

  function openExport(projects: AdminExportProject[], label: string) {
    setExportProjects(projects);
    setExportLabel(label);
    setExportOpen(true);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const from = new Date(exportFrom);
      const to = new Date(exportTo);

      // Collect all unique resources across export projects
      const seenEmails = new Set<string>();
      const allResources: { resource: typeof exportProjects[0]["resources"][0]; project_name: string; client_name: string }[] = [];
      for (const proj of exportProjects) {
        for (const r of proj.resources) {
          if (!seenEmails.has(r.email)) {
            seenEmails.add(r.email);
            allResources.push({ resource: r, project_name: proj.project_name, client_name: proj.client_name });
          }
        }
      }

      // Collect all months in the date range
      const months: { month: number; year: number }[] = [];
      const cur = new Date(from.getFullYear(), from.getMonth(), 1);
      const endMonth = new Date(to.getFullYear(), to.getMonth(), 1);
      while (cur <= endMonth) {
        months.push({ month: cur.getMonth() + 1, year: cur.getFullYear() });
        cur.setMonth(cur.getMonth() + 1);
      }

      // Fetch timesheets for each resource per month and merge entries
      const enrichedProjects = exportProjects.map(proj => ({
        ...proj,
        resources: proj.resources.map(r => ({ ...r, project_name: proj.project_name, client_name: proj.client_name, entries: [] as AdminTimesheetEntry[] })),
      }));

      // Build email → entries map by fetching each resource's timesheet
      const entryMap: Record<string, AdminTimesheetEntry[]> = {};
      // Get unique employee_ids — try to find by matching employees list
      // We use email as lookup key via getEmployeeTimesheet which needs employee_id
      // First get all employees to map email → employee_id
      let emailToEmpId: Record<string, string> = {};
      try {
        const empRes = await employeeService.getAll({ limit: 1000 });
        for (const e of empRes.data ?? []) {
          if (e.official_email) emailToEmpId[e.official_email] = e._id;
        }
      } catch { /* skip — will export without entries */ }

      for (const { resource } of allResources) {
        const empId = emailToEmpId[resource.email];
        if (!empId) continue;
        const allEntries: AdminTimesheetEntry[] = [];
        for (const { month, year } of months) {
          try {
            const res = await managerTimesheetService.getEmployeeTimesheet(empId, month, year);
            if (res.data?.entries) {
              for (const e of res.data.entries) {
                allEntries.push({
                  date: e.date,
                  status: e.status,
                  tasks: Array.isArray(e.tasks) ? e.tasks.join("; ") : (e.tasks || ""),
                  billable_hours: e.billable_hours,
                });
              }
            }
          } catch { /* skip month */ }
        }
        entryMap[resource.email] = allEntries;
      }

      // Attach entries to enriched projects
      for (const proj of enrichedProjects) {
        for (const r of proj.resources) {
          r.entries = entryMap[r.email] ?? [];
        }
      }

      exportAdminProjectsXLSX(
        enrichedProjects,
        from,
        to,
        exportLabel.replace(/[^a-zA-Z0-9_-]/g, "_")
      );
      setExportOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Export failed"));
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    streamlineService.getMyResourceProjects()
      .then(res => {
        const clientMap: Record<string, ClientGroup> = {};
        res.data.forEach(proj => {
          const key = proj.client_id || "__no_client__";
          const name = proj.client_name || "No Client";
          if (!clientMap[key]) clientMap[key] = { client_id: key, client_name: name, projects: [], total_resources: 0 };
          clientMap[key].projects.push(proj);
          clientMap[key].total_resources += proj.resource_count;
        });
        setClientGroups(Object.values(clientMap).sort((a, b) => b.total_resources - a.total_resources));
      })
      .catch(err => toast.error(getErrorMessage(err, "Failed to load projects")))
      .finally(() => setLoading(false));
  }, []);

  function viewTimesheets(projectId: string) {
    const now = new Date();
    const p = clientGroups.flatMap(cg => cg.projects).find(p => p.project_id === projectId);
    const meta = p ? { [projectId]: { project_name: p.project_name, project_code: p.project_code, client_name: p.client_name } } : {};
    navigate(`/admin/projects?projects=${projectId}&month=${now.getMonth() + 1}&year=${now.getFullYear()}`, { state: meta });
  }

  // ── Breadcrumb ──────────────────────────────────────────────────────────

  const Breadcrumb = () => (
    <div className="flex items-center gap-1.5 text-sm mb-4">
      <button onClick={() => { setProjectView("clients"); setSelectedClient(null); setSelectedProject(null); }}
        className={projectView === "clients" ? "font-semibold text-slate-800" : "text-slate-400 hover:text-slate-700 transition-colors"}>
        Clients & Projects
      </button>
      {(projectView === "projects" || projectView === "resources") && selectedClient && (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <button onClick={() => { setProjectView("projects"); setSelectedProject(null); }}
            className={projectView === "projects" ? "font-semibold text-slate-800" : "text-slate-400 hover:text-slate-700 transition-colors truncate max-w-[160px]"}>
            {selectedClient.client_name}
          </button>
        </>
      )}
      {projectView === "resources" && selectedProject && (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <span className="font-semibold text-slate-800 truncate max-w-[160px]">{selectedProject.project_name}</span>
        </>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /><span>Loading projects…</span>
      </div>
    );
  }

  // ── Shared export dialog ────────────────────────────────────────────────
  const ExportDialog = (
    <AlertDialog open={exportOpen} onOpenChange={setExportOpen}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Download className="w-4 h-4 text-[#217346]" />
            Export Timesheet
          </AlertDialogTitle>
          <AlertDialogDescription>
            Exporting <strong>{exportLabel}</strong>
            <br />
            <span className="text-xs">
              {exportProjects.length} project{exportProjects.length !== 1 ? "s" : ""} ·{" "}
              {exportProjects.reduce((s, p) => s + p.resources.length, 0)} resources
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">From date</label>
              <input
                type="date"
                value={exportFrom}
                onChange={e => setExportFrom(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/30 focus:border-[#217346]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">To date</label>
              <input
                type="date"
                value={exportTo}
                onChange={e => setExportTo(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/30 focus:border-[#217346]"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Downloads an XLSX with a Summary sheet + one sheet per project.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleExport}
            disabled={exporting || !exportFrom || !exportTo}
            className="bg-[#217346] hover:bg-[#1a5c38] text-white gap-2"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {exporting ? "Fetching data…" : "Download XLSX"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // ── VIEW: Clients ───────────────────────────────────────────────────────

  if (projectView === "clients") {
    if (clientGroups.length === 0) {
      return (
        <>
          {ExportDialog}
          <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center py-16 text-slate-400">
            <FolderOpen className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium text-slate-600">No projects found</p>
            <p className="text-sm mt-1">Sync to populate project data</p>
          </div>
        </>
      );
    }
    const filteredClients = clientSearch.trim()
      ? clientGroups.filter(cg => cg.client_name.toLowerCase().includes(clientSearch.toLowerCase()))
      : clientGroups;
    // Group projects by project_id across all clients to merge duplicate entries
    const projectMap: Record<string, AdminExportProject> = {};
    for (const cg of clientGroups) {
      for (const p of cg.projects) {
        const key = p.project_id || `${cg.client_name}|||${p.project_name}`;
        if (!projectMap[key]) {
          projectMap[key] = {
            project_name: p.project_name,
            project_code: p.project_code,
            client_name: cg.client_name,
            resources: [],
          };
        }
        const seen = new Set(projectMap[key].resources.map(r => r.email));
        for (const r of p.resources) {
          if (!seen.has(r.email)) {
            projectMap[key].resources.push({ name: r.name, email: r.email, designation: r.designation, team_name: r.team_name, resource_id: r.resource_id });
            seen.add(r.email);
          }
        }
      }
    }
    const allProjects: AdminExportProject[] = Object.values(projectMap);
    return (
      <>
        {ExportDialog}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0 gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative min-w-[220px] max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/40 focus:border-[#217346] transition-colors"
                />
              </div>
              <span className="text-sm text-slate-500 whitespace-nowrap">
                <strong className="text-slate-700">{clientGroups.length}</strong> client{clientGroups.length !== 1 ? "s" : ""} · <strong className="text-slate-700">{clientGroups.reduce((s, c) => s + c.projects.length, 0)}</strong> projects
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-[#217346] text-[#217346] hover:bg-[#217346]/5 shrink-0"
              onClick={() => openExport(allProjects, "All Clients – All Projects")}
            >
              <Download className="w-3.5 h-3.5" />
              Export All
            </Button>
          </div>
          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredClients.map(cg => (
              <button
                key={cg.client_id}
                onClick={() => { setSelectedClient(cg); setProjectView("projects"); setProjectSearch(""); }}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50/80 transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <Building2 className="w-4.5 h-4.5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 group-hover:text-[#217346] transition-colors">{cg.client_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {cg.projects.length} project{cg.projects.length !== 1 ? "s" : ""} · {cg.total_resources} resource{cg.total_resources !== 1 ? "s" : ""}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#217346] transition-colors shrink-0" />
              </button>
            ))}
            {filteredClients.length === 0 && (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <p className="text-sm">No clients match "{clientSearch}"</p>
              </div>
            )}
          </div>
          {/* Footer */}
          {clientGroups.length > 0 && (
            <div className="shrink-0 border-t border-slate-100 px-5 py-3 flex items-center justify-between bg-white">
              <span className="text-xs text-slate-400">
                Showing <strong>{filteredClients.length}</strong> client{filteredClients.length !== 1 ? "s" : ""} · Page <strong>1</strong> of <strong>1</strong>
              </span>
            </div>
          )}
        </div>
      </>
    );
  }

  // ── VIEW: Projects of a client ──────────────────────────────────────────

  if (projectView === "projects" && selectedClient) {
    const filteredProjects = projectSearch.trim()
      ? selectedClient.projects.filter(p =>
          (p.project_name || "").toLowerCase().includes(projectSearch.toLowerCase()) ||
          (p.project_code || "").toLowerCase().includes(projectSearch.toLowerCase())
        )
      : selectedClient.projects;
    // Merge duplicate project entries for this client
    const clientProjMap: Record<string, AdminExportProject> = {};
    for (const p of selectedClient.projects) {
      const key = p.project_id || p.project_name;
      if (!clientProjMap[key]) {
        clientProjMap[key] = { project_name: p.project_name, project_code: p.project_code, client_name: selectedClient.client_name, resources: [] };
      }
      const seen = new Set(clientProjMap[key].resources.map(r => r.email));
      for (const r of p.resources) {
        if (!seen.has(r.email)) {
          clientProjMap[key].resources.push({ name: r.name, email: r.email, designation: r.designation, team_name: r.team_name, resource_id: r.resource_id });
          seen.add(r.email);
        }
      }
    }
    const clientExportProjects: AdminExportProject[] = Object.values(clientProjMap);
    return (
      <>
        {ExportDialog}
        <div>
          <Breadcrumb />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0 gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative min-w-[220px] max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={projectSearch}
                  onChange={e => setProjectSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/40 focus:border-[#217346] transition-colors"
                />
              </div>
              <span className="text-sm text-slate-500 whitespace-nowrap">
                <strong className="text-slate-700">{selectedClient.client_name}</strong> · <strong className="text-slate-700">{selectedClient.projects.length}</strong> project{selectedClient.projects.length !== 1 ? "s" : ""}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-[#217346] text-[#217346] hover:bg-[#217346]/5 shrink-0"
              onClick={() => openExport(clientExportProjects, `${selectedClient.client_name} – All Projects`)}
            >
              <Download className="w-3.5 h-3.5" />
              Export All
            </Button>
          </div>
          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredProjects.map(proj => {
              const projExport: AdminExportProject = {
                project_name: proj.project_name,
                project_code: proj.project_code,
                client_name: selectedClient.client_name,
                resources: proj.resources.map(r => ({
                  name: r.name, email: r.email, designation: r.designation, team_name: r.team_name, resource_id: r.resource_id,
                })),
              };
              return (
                <div key={proj.project_id} className="flex items-center hover:bg-slate-50/80 transition-colors group">
                  <button
                    className="flex items-center gap-4 flex-1 px-5 py-4 text-left min-w-0"
                    onClick={() => { setSelectedProject(proj); setProjectView("resources"); }}
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#217346]/10 flex items-center justify-center shrink-0">
                      <FolderOpen className="w-4 h-4 text-[#217346]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 group-hover:text-[#217346] transition-colors">{proj.project_name || "Unnamed Project"}</p>
                        {proj.project_code && (
                          <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{proj.project_code}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{proj.resource_count} resource{proj.resource_count !== 1 ? "s" : ""}</span>
                        {(proj.start_date || proj.end_date) && (
                          <span className="flex items-center gap-1">
                            <CalendarRange className="w-3 h-3" />{formatDate(proj.start_date)} – {formatDate(proj.end_date)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#217346] transition-colors shrink-0" />
                  </button>
                  <button
                    className="shrink-0 mr-4 p-2 rounded-lg text-slate-400 hover:text-[#217346] hover:bg-[#217346]/5 transition-colors"
                    title={`Export ${proj.project_name}`}
                    onClick={e => { e.stopPropagation(); openExport([projExport], proj.project_name); }}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
            {filteredProjects.length === 0 && (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <p className="text-sm">No projects match "{projectSearch}"</p>
              </div>
            )}
          </div>
          {/* Footer */}
          {selectedClient.projects.length > 0 && (
            <div className="shrink-0 border-t border-slate-100 px-5 py-3 flex items-center justify-between bg-white">
              <span className="text-xs text-slate-400">
                Showing <strong>{filteredProjects.length}</strong> project{filteredProjects.length !== 1 ? "s" : ""} · Page <strong>1</strong> of <strong>1</strong>
              </span>
            </div>
          )}
        </div>
      </>
    );
  }

  // ── VIEW: Resources of a project ────────────────────────────────────────

  if (projectView === "resources" && selectedProject) {
    const projExport: AdminExportProject = {
      project_name: selectedProject.project_name,
      project_code: selectedProject.project_code,
      client_name: selectedProject.client_name,
      resources: selectedProject.resources.map(r => ({
        name: r.name, email: r.email, designation: r.designation, team_name: r.team_name, resource_id: r.resource_id,
      })),
    };
    return (
      <>
        {ExportDialog}
        <div>
          <Breadcrumb />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0 gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{selectedProject.project_name}</p>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <Building2 className="w-3 h-3" />{selectedProject.client_name}
                {selectedProject.project_code && <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded ml-1">{selectedProject.project_code}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-[#217346] text-[#217346] hover:bg-[#217346]/5"
                onClick={() => openExport([projExport], selectedProject.project_name)}
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </Button>
              <Button
                size="sm"
                className="bg-[#217346] hover:bg-[#1a5c38] text-white gap-1.5"
                onClick={() => viewTimesheets(selectedProject.project_id)}
              >
                <Eye className="w-3.5 h-3.5" />
                View Timesheets
              </Button>
            </div>
          </div>
          {selectedProject.resources.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Users className="w-8 h-8 mb-2 opacity-30" />
              <p className="font-medium text-slate-600">No resources</p>
            </div>
          ) : (
            <>
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#217346] text-white text-xs">
                      <th className="px-4 py-3 text-left font-semibold w-8">#</th>
                      <th className="px-4 py-3 text-left font-semibold">Name</th>
                      <th className="px-4 py-3 text-left font-semibold">Resource ID</th>
                      <th className="px-4 py-3 text-left font-semibold">Email</th>
                      <th className="px-4 py-3 text-left font-semibold">Designation</th>
                      <th className="px-4 py-3 text-left font-semibold">Team</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedProject.resources.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-400 text-xs font-mono">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{r.name || "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.resource_id || "—"}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{r.email || "—"}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{r.designation || "—"}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{r.team_name || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${r.is_active ? "text-emerald-600" : "text-slate-400"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${r.is_active ? "bg-emerald-500" : "bg-slate-300"}`} />
                            {r.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Footer */}
              <div className="shrink-0 border-t border-slate-100 px-5 py-3 flex items-center justify-between bg-white">
                <span className="text-xs text-slate-400">
                  Showing <strong>{selectedProject.resources.length}</strong> resource{selectedProject.resources.length !== 1 ? "s" : ""} · Page <strong>1</strong> of <strong>1</strong>
                </span>
              </div>
            </>
          )}
        </div>
      </>
    );
  }

  return null;
}

// ── Admins Tab ────────────────────────────────────────────────────────────────

interface AdminRecord {
  _id: string;
  full_name: string;
  email: string;
  designation?: string;
  is_active?: boolean;
}

function CreateAdminDialog({
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
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset() {
    setFullName(""); setEmail(""); setPassword(""); setShowPassword(false);
    setDesignation(""); setErrors({});
  }

  function clearError(field: string) {
    setErrors(prev => { const next = { ...prev }; delete next[field]; return next; });
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = "Full name is required";
    else if (fullName.trim().length < 2) errs.fullName = "Name must be at least 2 characters";
    if (!email.trim()) errs.email = "Email is required";
    else if (!MGR_EMAIL_RE.test(email.trim())) errs.email = "Enter a valid email address";
    if (!password) errs.password = "Password is required";
    else if (password.length < 6) errs.password = "Password must be at least 6 characters";
    return errs;
  }

  async function handleCreate() {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      await authService.createAdmin(email.trim(), password, fullName.trim(), designation.trim());
      toast.success(`Administrator account created for ${fullName.trim()}`);
      reset();
      onCreated();
      onClose();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (msg?.toLowerCase().includes("email") || msg?.toLowerCase().includes("exists")) {
        setErrors({ email: "An account with this email already exists" });
      } else {
        toast.error(msg || "Failed to create administrator");
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
              <Shield className="w-5 h-5 text-[#217346]" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-800">Create Administrator</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-0.5">
                Create a new administrator account with full system access.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1">
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
                  placeholder="John Smith"
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
                  placeholder="System Admin"
                  className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 hover:border-slate-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/40 focus:border-[#217346] transition-colors"
                />
              </div>
            </div>
          </div>

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
                placeholder="admin@company.com"
                className={`w-full h-10 rounded-lg border pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]/40 focus:border-[#217346] transition-colors ${errors.email ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"}`}
              />
            </div>
            <FieldError msg={errors.email} />
          </div>

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
        </div>

        <DialogFooter className="pt-2 gap-2">
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={saving} className="flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving} className="flex-1 sm:flex-none bg-[#217346] hover:bg-[#185c37] text-white gap-2 shadow-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {saving ? "Creating..." : "Create Admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminsTab() {
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const PAGE_SIZE = 20;
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAdmins = useCallback(async (p = 1, search = "") => {
    try {
      setLoading(true);
      const res = await authService.getAdmins({ page: p, limit: PAGE_SIZE, search: search || undefined });
      setAdmins(res.data.data);
      setPagination(res.data.pagination ?? { total: res.data.data?.length ?? 0, page: 1, limit: PAGE_SIZE, pages: 1 });
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load administrators"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdmins(1, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(q: string) {
    setSearchQuery(q);
    setPage(1);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => loadAdmins(1, q), 400);
  }

  function goToPage(p: number) {
    setPage(p);
    loadAdmins(p, searchQuery);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative min-w-[220px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search admins…"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#217346]/50 focus:border-[#217346] transition-all hover:border-slate-400"
            />
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-500 whitespace-nowrap">
            <Shield className="w-4 h-4 text-[#217346]" />
            <span><strong className="text-slate-700">{pagination.total}</strong> admin{pagination.total !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#217346] hover:bg-[#185c37] text-white gap-2 shrink-0 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Admin
        </Button>
      </div>

      {/* Admin list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#217346]" />
          <span>Loading administrators...</span>
        </div>
      ) : admins.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center py-16 text-slate-400">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
            <Shield className="w-7 h-7 opacity-40" />
          </div>
          <p className="font-medium text-slate-600">{searchQuery ? "No admins match your search" : "No administrators found"}</p>
          <p className="text-sm mt-1 text-slate-400">{searchQuery ? "Try a different search term" : "Click \"Add Admin\" to create an administrator account"}</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 p-3 space-y-3">
            {admins.map((admin) => {
              const isActive = admin.is_active !== false;
              return (
                <div
                  key={admin._id}
                  className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#217346]/10 flex items-center justify-center shrink-0 text-[#217346] font-bold text-sm">
                    {getInitials(admin.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800 truncate">{admin.full_name}</p>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#217346]/10 text-[#217346] border border-[#217346]/20 shrink-0">
                        <Shield className="w-3 h-3" /> Admin
                      </span>
                      {!isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200 shrink-0">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 truncate mt-0.5">{admin.email}</p>
                    {admin.designation && (
                      <p className="text-xs text-slate-400 mt-0.5">{admin.designation}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-white shrink-0">
              <span className="text-xs text-slate-400">
                <strong>{pagination.total}</strong> admin{pagination.total !== 1 ? "s" : ""} · Page <strong>{page}</strong> of <strong>{pagination.pages}</strong>
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)} className="gap-1 h-8">
                  <ChevronLeft className="w-4 h-4" />Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => goToPage(page + 1)} className="gap-1 h-8">
                  Next<ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <CreateAdminDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => loadAdmins(page, searchQuery)} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "admins" | "managers" | "employees" | "logs" | "projects";

const TAB_CONFIG: { id: Tab; label: string; displayLabel?: string; icon: ReactNode }[] = [
  { id: "admins", label: "Admins", displayLabel: "Administrators", icon: <Shield className="w-4 h-4" /> },
  { id: "managers", label: "Managers", icon: <Users className="w-4 h-4" /> },
  { id: "employees", label: "Employees", icon: <Users className="w-4 h-4" /> },
  { id: "projects", label: "Projects", displayLabel: "Clients & Projects", icon: <FolderOpen className="w-4 h-4" /> },
  { id: "logs", label: "Activity Logs", icon: <ScrollText className="w-4 h-4" /> },
];

export default function EmployeeManagerMappingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const validTabs: Tab[] = ["admins", "managers", "employees", "logs", "projects"];
  const tabParam = searchParams.get("tab") as Tab | null;
  const activeTab: Tab = tabParam && validTabs.includes(tabParam) ? tabParam : "admins";

  function switchTab(tab: Tab) {
    navigate(`/timesheet/mapping?tab=${tab}`, { replace: true });
  }

  // Get the current tab label for header
  const currentTabConfig = TAB_CONFIG.find(tab => tab.id === activeTab);
  const currentTabLabel = currentTabConfig?.displayLabel || currentTabConfig?.label || "Administration";

  return (
    <DashboardLayout>
      <div className="w-full flex flex-col h-full">
        {/* Header */}
        <div className="mb-6 shrink-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{currentTabLabel}</h1>
        </div>

        {/* Content area - fills remaining height */}
        <div className="flex-1 min-h-0">
          {activeTab === "admins" && <AdminsTab />}
          {activeTab === "managers" && <ManagersTab />}
          {activeTab === "employees" && <EmployeesTab />}
          {activeTab === "logs" && <LogsTab />}
          {activeTab === "projects" && <ProjectsTab />}
        </div>
      </div>
    </DashboardLayout>
  );
}
