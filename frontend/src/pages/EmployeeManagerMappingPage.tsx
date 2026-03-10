import { useState, useEffect, useCallback } from "react";
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
  UserCheck,
  Plus,
  Pencil,
  Link2,
  Loader2,
  FolderOpen,
  X,
  UserPlus,
  Shield,
  Mail,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import {
  employeeMappingService,
  MappingRecord,
  ManagerUser,
  EmployeeMaster,
  ProjectMaster,
} from "@/services/timesheet";
import { authService } from "@/lib/auth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProjectGroup {
  project: { _id: string; project_name: string; unique_id?: string };
  manager: { _id: string; full_name: string; email: string };
  records: MappingRecord[];
}

interface ManagerRecord {
  _id: string;
  full_name: string;
  email: string;
  designation?: string;
  is_active?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByProject(records: MappingRecord[]): ProjectGroup[] {
  const map = new Map<string, ProjectGroup>();
  records.forEach((r) => {
    const proj = r.project_id;
    const key = proj._id;
    if (!map.has(key)) {
      map.set(key, { project: proj, manager: r.manager_id, records: [] });
    }
    map.get(key)!.records.push(r);
  });
  return Array.from(map.values());
}

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
  const [saving, setSaving] = useState(false);

  function reset() {
    setFullName(""); setEmail(""); setPassword(""); setDesignation("");
  }

  async function handleCreate() {
    if (!fullName || !email || !password) {
      toast.error("Name, email and password are required");
      return;
    }
    setSaving(true);
    try {
      await authService.createManager(email.trim(), password, fullName.trim(), designation.trim());
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

  const loadManagers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authService.getManagers();
      setManagers(res.data.data);
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

  return (
    <div>
      {/* Sub-header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm text-slate-500">
            {managers.length} manager{managers.length !== 1 ? "s" : ""} in your organisation
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

      {/* List */}
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
          {managers.map((mgr) => (
            <div
              key={mgr._id}
              className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4"
            >
              {/* Avatar */}
              <div className="w-11 h-11 rounded-full bg-[#217346]/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-[#217346]">{getInitials(mgr.full_name)}</span>
              </div>

              {/* Info */}
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
              </div>

              {/* Status */}
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
          ))}
        </div>
      )}

      <CreateManagerDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={loadManagers}
      />
    </div>
  );
}

// ── Employee Mapping Tab ──────────────────────────────────────────────────────

function MappingTab() {
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [managers, setManagers] = useState<ManagerUser[]>([]);
  const [employees, setEmployees] = useState<EmployeeMaster[]>([]);
  const [projects, setProjects] = useState<ProjectMaster[]>([]);
  const [loading, setLoading] = useState(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ProjectGroup | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<MappingRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [mappingsRes, managersRes, employeesRes, projectsRes] = await Promise.all([
        employeeMappingService.getAll(),
        employeeMappingService.getManagers(),
        employeeMappingService.getEmployees(),
        employeeMappingService.getProjects(),
      ]);
      setGroups(groupByProject(mappingsRes.data));
      setManagers(managersRes.data);
      setEmployees(employeesRes.data);
      setProjects(projectsRes.data);
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

  function toggleEmployee(id: string) {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function openAddDialog() {
    setEditingGroup(null);
    setSelectedManagerId("");
    setSelectedProjectId("");
    setSelectedEmployeeIds([]);
    setIsDialogOpen(true);
  }

  function openEditDialog(group: ProjectGroup) {
    setEditingGroup(group);
    setSelectedManagerId(group.manager._id);
    setSelectedProjectId(group.project._id);
    setSelectedEmployeeIds(group.records.map((r) => r.employee_id._id));
    setIsDialogOpen(true);
  }

  async function handleSave() {
    if (!selectedProjectId) { toast.error("Please select a project"); return; }
    if (!selectedManagerId) { toast.error("Please select a manager"); return; }
    if (selectedEmployeeIds.length === 0) { toast.error("Please select at least one employee"); return; }

    setSaving(true);
    try {
      const proj = projects.find((p) => p._id === selectedProjectId);
      const projName = proj?.project_name ?? "";
      const projCode = proj?.project_code ?? proj?.unique_id ?? "";

      if (editingGroup) {
        const toRemove = editingGroup.records.filter(
          (r) => !selectedEmployeeIds.includes(r.employee_id._id)
        );
        for (const rec of toRemove) {
          await employeeMappingService.remove(rec._id);
        }
        const prevIds = new Set(editingGroup.records.map((r) => r.employee_id._id));
        const toAdd = selectedEmployeeIds.filter((id) => !prevIds.has(id));
        if (toAdd.length > 0) {
          await employeeMappingService.create(selectedManagerId, selectedProjectId, toAdd, projName, projCode);
        }
        if (selectedManagerId !== editingGroup.manager._id) {
          const toReassign = editingGroup.records.filter((r) =>
            selectedEmployeeIds.includes(r.employee_id._id)
          );
          for (const rec of toReassign) {
            await employeeMappingService.update(rec._id, selectedManagerId);
          }
        }
        toast.success("Mapping updated");
      } else {
        await employeeMappingService.create(selectedManagerId, selectedProjectId, selectedEmployeeIds, projName, projCode);
        toast.success("Employees mapped successfully");
      }
      setIsDialogOpen(false);
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save mapping"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRecord() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await employeeMappingService.remove(deleteTarget._id);
      toast.success("Employee removed from project");
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to remove mapping"));
    } finally {
      setDeleting(false);
    }
  }

  const totalMapped = groups.reduce((s, g) => s + g.records.length, 0);

  return (
    <div>
      {/* Sub-header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <FolderOpen className="w-4 h-4" />
            <span>{groups.length} projects</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Users className="w-4 h-4" />
            <span>{totalMapped} assignments</span>
          </div>
        </div>
        <Button
          onClick={openAddDialog}
          className="bg-[#217346] hover:bg-[#185c37] text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Map Employees
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading mappings...</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center py-16 text-slate-400">
          <Link2 className="w-10 h-10 mb-3 opacity-30" />
          <p className="font-medium text-slate-600">No mappings yet</p>
          <p className="text-sm mt-1">Click "Map Employees" to assign resources to a project</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.project._id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* Project header */}
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <FolderOpen className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{group.project.project_name}</p>
                    {(group.project.unique_id || (group.project as any).project_code) && (
                      <p className="text-xs text-slate-400">
                        {group.project.unique_id || (group.project as any).project_code}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Manager</p>
                    <p className="text-sm font-medium text-slate-700">{group.manager.full_name}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8"
                    onClick={() => openEditDialog(group)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                </div>
              </div>

              {/* Resources */}
              <div className="px-5 py-4">
                <p className="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">
                  Resources ({group.records.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.records.map((rec) => (
                    <div
                      key={rec._id}
                      className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#217346]/10 flex items-center justify-center text-xs font-semibold text-[#217346] shrink-0">
                        {getInitials(rec.employee_id.employee_name)}
                      </div>
                      <div className="leading-tight">
                        <p className="text-sm font-medium leading-none">
                          {rec.employee_id.employee_name.split(" ")[0]}
                        </p>
                        <p className="text-xs text-slate-400">{rec.employee_id.unique_id}</p>
                      </div>
                      <button
                        className="ml-1 text-slate-400 hover:text-red-500 transition-colors"
                        onClick={() => setDeleteTarget(rec)}
                        title="Remove from project"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? "Edit Project Mapping" : "Map Employees to Project"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Project <span className="text-red-500">*</span>
              </label>
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
                disabled={!!editingGroup}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
                        <span>{p.project_name}</span>
                        {(p.unique_id || p.project_code) && (
                          <span className="text-xs text-slate-400">
                            ({p.unique_id || p.project_code})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Manager <span className="text-red-500">*</span>
              </label>
              <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Assign a manager..." />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((m) => (
                    <SelectItem key={m._id} value={m._id}>
                      <div className="flex flex-col">
                        <span>{m.full_name}</span>
                        <span className="text-xs text-slate-400">{m.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Resources
                {selectedEmployeeIds.length > 0 && (
                  <span className="ml-2 text-xs text-slate-400 font-normal">
                    ({selectedEmployeeIds.length} selected)
                  </span>
                )}
              </label>
              <div className="border rounded-lg divide-y max-h-56 overflow-y-auto">
                {employees.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400">
                    No employees available
                  </div>
                ) : (
                  employees.map((emp) => {
                    const checked = selectedEmployeeIds.includes(emp._id);
                    return (
                      <label
                        key={emp._id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEmployee(emp._id)}
                          className="h-4 w-4 rounded border-gray-300 accent-[#217346]"
                        />
                        <div className="w-7 h-7 rounded-full bg-[#217346]/10 flex items-center justify-center text-xs font-semibold text-[#217346] shrink-0">
                          {getInitials(emp.employee_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{emp.employee_name}</p>
                          <p className="text-xs text-slate-400">
                            {emp.unique_id}{emp.designation ? ` · ${emp.designation}` : ""}
                          </p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#217346] hover:bg-[#185c37] text-white"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingGroup ? "Update Mapping" : "Map Employees"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Project</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleteTarget?.employee_id.employee_name}</strong> from{" "}
              <strong>{deleteTarget?.project_id.project_name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteRecord}
              disabled={deleting}
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "managers" | "mapping";

export default function EmployeeManagerMappingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(tabParam === "mapping" ? "mapping" : "managers");

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setSearchParams({ tab });
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Administration</h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage manager accounts and project assignments
          </p>
        </div>

        {/* Tabs */}
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
            onClick={() => switchTab("mapping")}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "mapping"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Link2 className="w-4 h-4" />
            Employee Mapping
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "managers" ? <ManagersTab /> : <MappingTab />}
      </div>
    </DashboardLayout>
  );
}
