import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
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
  X,
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
  RefreshCw,
  CheckCircle2,
  AlertCircle,
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
    setFullName(""); setEmail(""); setPassword(""); setDesignation("");
    setSelectedTeamIds([]);
  }

  function toggleTeam(teamId: string) {
    setSelectedTeamIds(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  }

  async function handleCreate() {
    if (!fullName || !email || !password) {
      toast.error("Name, email and password are required");
      return;
    }
    if (selectedTeamIds.length === 0) {
      toast.error("Please select at least one team");
      return;
    }
    setSaving(true);
    try {
      await authService.createManager(email.trim(), password, fullName.trim(), designation.trim(), selectedTeamIds);
      toast.success(`Manager account created for ${fullName}`);
      reset();
      onCreated();
      onClose();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || "Failed to create manager");
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
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="manager@company.com"
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password <span className="text-red-500">*</span></label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]"
            />
          </div>
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
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Assign Teams <span className="text-red-500">*</span>
              {selectedTeamIds.length > 0 && (
                <span className="ml-2 text-xs text-slate-400 font-normal">
                  ({selectedTeamIds.length} selected)
                </span>
              )}
            </label>
            {teamsLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-3">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading teams...
              </div>
            ) : (
              <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
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
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving}
            className="bg-[#217346] hover:bg-[#185c37] text-white gap-2"
          >
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
  const [resetTarget, setResetTarget] = useState<ManagerRecord | null>(null);
  const [resetting, setResetting] = useState(false);
  const [editTarget, setEditTarget] = useState<ManagerRecord | null>(null);
  const [editTeamIds, setEditTeamIds] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);

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

  function openEditTeams(mgr: ManagerRecord) {
    setEditTarget(mgr);
    setEditTeamIds(mgr.team_ids || []);
  }

  async function handleSaveTeams() {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      await authService.updateManager(editTarget._id, { team_ids: editTeamIds });
      toast.success("Teams updated");
      setEditTarget(null);
      await loadManagers();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update teams"));
    } finally {
      setEditSaving(false);
    }
  }

  const totalTeams = new Set(managers.flatMap(m => m.team_ids || [])).size;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <p className="text-sm text-slate-500">
            {managers.length} manager{managers.length !== 1 ? "s" : ""}
          </p>
          <p className="text-sm text-slate-500">
            {totalTeams} team{totalTeams !== 1 ? "s" : ""} assigned
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#217346] hover:bg-[#185c37] text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Manager
        </Button>
      </div>

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
            return (
              <div
                key={mgr._id}
                className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4"
              >
                <div className="w-11 h-11 rounded-full bg-[#217346]/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-[#217346]">{getInitials(mgr.full_name)}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900">{mgr.full_name}</p>
                  <div className="flex items-center gap-4 mt-0.5">
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

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditTeams(mgr)}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Edit teams"
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
                  <Badge
                    variant="outline"
                    className={
                      mgr.is_active !== false
                        ? "border-green-200 bg-green-50 text-green-700 text-xs"
                        : "border-slate-200 bg-slate-50 text-slate-500 text-xs"
                    }
                  >
                    {mgr.is_active !== false ? "Active" : "Inactive"}
                  </Badge>
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

      {/* Reset Password Confirm */}
      <AlertDialog open={!!resetTarget} onOpenChange={() => setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password</AlertDialogTitle>
            <AlertDialogDescription>
              Reset password for <strong>{resetTarget?.full_name}</strong> to <code>Think@2026</code>? They will be required to change it on next login.
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

      {/* Edit Teams Dialog */}
      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Teams — {editTarget?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
            {teams.map(team => (
              <label key={team._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editTeamIds.includes(team._id)}
                  onChange={() => setEditTeamIds(prev =>
                    prev.includes(team._id) ? prev.filter(id => id !== team._id) : [...prev, team._id]
                  )}
                  className="h-4 w-4 rounded border-gray-300 accent-[#217346]"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{team.team_name}</p>
                  <p className="text-xs text-slate-400">{team.unique_id}</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editSaving}>Cancel</Button>
            <Button onClick={handleSaveTeams} disabled={editSaving} className="bg-[#217346] hover:bg-[#185c37] text-white">
              {editSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Teams
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

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<EmployeeMaster | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    if (!newEmpId || !newEmpEmail || !newEmpName || !newEmpTeamId) {
      toast.error("All fields are required");
      return;
    }
    setCreating(true);
    try {
      const team = teams.find(t => t._id === newEmpTeamId);
      await employeeService.create({
        emp_id: newEmpId,
        emp_email: newEmpEmail,
        emp_name: newEmpName,
        team_id: newEmpTeamId,
        team_name: team?.team_name,
        designation: newEmpDesignation,
      });
      toast.success(`Employee ${newEmpName} created. Login: ${newEmpEmail} / Think@2026`);
      setCreateOpen(false);
      setNewEmpId(""); setNewEmpEmail(""); setNewEmpName(""); setNewEmpTeamId(""); setNewEmpDesignation("");
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create employee"));
    } finally {
      setCreating(false);
    }
  }

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

  const filtered = filterTeamId === "all"
    ? employees
    : employees.filter(e => e.team_id === filterTeamId);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <p className="text-sm text-slate-500">{filtered.length} employee{filtered.length !== 1 ? "s" : ""}</p>
          <Select value={filterTeamId} onValueChange={setFilterTeamId}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue placeholder="Filter by team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map(t => (
                <SelectItem key={t._id} value={t._id}>{t.team_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={syncing}
            className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
            title="Fetch all employees and project assignments from Streamline360 Resource Master"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? "Syncing..." : "Sync from Streamline"}
          </Button>
          <Button variant="outline" onClick={() => setUploadOpen(true)} className="gap-2">
            <Upload className="w-4 h-4" />
            Bulk Upload
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="bg-[#217346] hover:bg-[#185c37] text-white gap-2">
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
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Employee</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Emp ID</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Email</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">Team</th>
                <th className="text-right px-5 py-3 font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(emp => (
                <tr key={emp._id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#217346]/10 flex items-center justify-center text-xs font-semibold text-[#217346]">
                        {getInitials(emp.employee_name)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{emp.employee_name}</p>
                        {emp.designation && <p className="text-xs text-slate-400">{emp.designation}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{emp.unique_id}</td>
                  <td className="px-5 py-3 text-slate-600">{emp.official_email}</td>
                  <td className="px-5 py-3">
                    {emp.team_name ? (
                      <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-700">
                        {emp.team_name}
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setDeleteTarget(emp)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      title="Delete employee"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(v) => { if (!v) { setUploadFile(null); setUploadResult(null); } setUploadOpen(v); }}>
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
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#217346]" />
              Add Employee
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Employee ID <span className="text-red-500">*</span></label>
              <input type="text" value={newEmpId} onChange={e => setNewEmpId(e.target.value)} placeholder="e.g. 340"
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name <span className="text-red-500">*</span></label>
              <input type="text" value={newEmpName} onChange={e => setNewEmpName(e.target.value)} placeholder="e.g. Abhay Ahire"
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email <span className="text-red-500">*</span></label>
              <input type="email" value={newEmpEmail} onChange={e => setNewEmpEmail(e.target.value)} placeholder="abhay@company.com"
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Team <span className="text-red-500">*</span></label>
              <Select value={newEmpTeamId} onValueChange={setNewEmpTeamId}>
                <SelectTrigger><SelectValue placeholder="Select team..." /></SelectTrigger>
                <SelectContent>
                  {teams.map(t => <SelectItem key={t._id} value={t._id}>{t.team_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Designation</label>
              <input type="text" value={newEmpDesignation} onChange={e => setNewEmpDesignation(e.target.value)} placeholder="e.g. Software Engineer"
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#217346]" />
            </div>
            <p className="text-xs text-slate-400">Default password: Think@2026 (employee must change on first login)</p>
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

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deleteTarget?.employee_name}</strong>? This action cannot be undone.
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
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-500">Action</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500">Target</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500">Performed By</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500">Details</th>
                  <th className="text-right px-5 py-3 font-medium text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Badge
                        variant="outline"
                        className={`text-xs ${ACTION_COLORS[log.action] || "border-slate-200 bg-slate-50 text-slate-600"}`}
                      >
                        {ACTION_LABELS[log.action] || log.action}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{log.target_name}</p>
                        {log.target_email && (
                          <p className="text-xs text-slate-400">{log.target_email}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div>
                        <p className="text-slate-700">{log.performed_by_name}</p>
                        <p className="text-xs text-slate-400">{log.performed_by_role}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600 max-w-xs truncate">
                      {log.details}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "managers" | "employees" | "logs";

export default function EmployeeManagerMappingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const validTabs: Tab[] = ["managers", "employees", "logs"];
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam && validTabs.includes(tabParam) ? tabParam : "managers"
  );

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setSearchParams({ tab });
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Administration</h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage managers, employees, and project assignments
          </p>
        </div>

        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-6">
          <button
            onClick={() => switchTab("managers")}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "managers"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Shield className="w-4 h-4" />
            Managers
          </button>
          <button
            onClick={() => switchTab("employees")}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "employees"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Users className="w-4 h-4" />
            Employees
          </button>
          <button
            onClick={() => switchTab("logs")}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "logs"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <ScrollText className="w-4 h-4" />
            Activity Logs
          </button>
        </div>

        {activeTab === "managers" && <ManagersTab />}
        {activeTab === "employees" && <EmployeesTab />}
        {activeTab === "logs" && <LogsTab />}
      </div>
    </DashboardLayout>
  );
}
