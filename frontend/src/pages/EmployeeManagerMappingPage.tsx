import { useState, useEffect, useCallback } from "react";
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
import { Users, UserCheck, Plus, Pencil, Link2, Loader2, FolderOpen, X } from "lucide-react";
import { toast } from "sonner";
import {
  employeeMappingService,
  MappingRecord,
  ManagerUser,
  EmployeeMaster,
  ProjectMaster,
} from "@/services/timesheet";

// ── Group records by Project ───────────────────────────────────────────────────

interface ProjectGroup {
  project: { _id: string; project_name: string; unique_id?: string };
  manager: { _id: string; full_name: string; email: string };
  records: MappingRecord[];
}

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function EmployeeManagerMappingPage() {
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

  // ── Load data ─────────────────────────────────────────────────────────────

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
    } catch (err: any) {
      toast.error(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Employees already mapped to this project (for available list)
  const mappedInProject = new Set(
    editingGroup
      ? editingGroup.records.map((r) => r.employee_id._id)
      : []
  );

  const availableEmployees = employees.filter((e) => {
    if (editingGroup) {
      // include own employees so they can be deselected
      return mappedInProject.has(e._id) || true;
    }
    return true; // same employee can be on multiple projects
  });

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

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!selectedProjectId) { toast.error("Please select a project"); return; }
    if (!selectedManagerId) { toast.error("Please select a manager"); return; }
    if (selectedEmployeeIds.length === 0) { toast.error("Please select at least one employee"); return; }

    setSaving(true);
    try {
      if (editingGroup) {
        // Remove deselected employees
        const toRemove = editingGroup.records.filter(
          (r) => !selectedEmployeeIds.includes(r.employee_id._id)
        );
        for (const rec of toRemove) {
          await employeeMappingService.remove(rec._id);
        }
        // Add newly selected
        const prevIds = new Set(editingGroup.records.map((r) => r.employee_id._id));
        const toAdd = selectedEmployeeIds.filter((id) => !prevIds.has(id));
        if (toAdd.length > 0) {
          await employeeMappingService.create(selectedManagerId, selectedProjectId, toAdd);
        }
        // Reassign manager if changed
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
        await employeeMappingService.create(selectedManagerId, selectedProjectId, selectedEmployeeIds);
        toast.success("Employees mapped successfully");
      }
      setIsDialogOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save mapping");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete single record ──────────────────────────────────────────────────

  async function handleDeleteRecord() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await employeeMappingService.remove(deleteTarget._id);
      toast.success("Employee removed from project");
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove mapping");
    } finally {
      setDeleting(false);
    }
  }

  const totalMapped = groups.reduce((s, g) => s + g.records.length, 0);

  return (
    <DashboardLayout>
      <div className="flex-1 flex flex-col min-h-0 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Employee Mapping</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Assign resources to projects and managers for timesheet tracking
            </p>
          </div>
          <Button onClick={openAddDialog} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Map Employees
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{groups.length}</p>
              <p className="text-xs text-muted-foreground">Active Projects</p>
            </div>
          </div>
          <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalMapped}</p>
              <p className="text-xs text-muted-foreground">Total Assignments</p>
            </div>
          </div>
          <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {new Set(groups.map((g) => g.manager._id)).size}
              </p>
              <p className="text-xs text-muted-foreground">Managers Assigned</p>
            </div>
          </div>
        </div>

        {/* Project Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading mappings...</span>
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-card border rounded-lg flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Link2 className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium">No mappings yet</p>
            <p className="text-sm">Click "Map Employees" to assign resources to a project</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.project._id} className="bg-card border rounded-xl overflow-hidden">
                {/* Project header bar */}
                <div className="flex items-center justify-between px-5 py-3 bg-muted/40 border-b">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <FolderOpen className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{group.project.project_name}</p>
                      {group.project.unique_id && (
                        <p className="text-xs text-muted-foreground">{group.project.unique_id}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Manager</p>
                      <p className="text-sm font-medium">{group.manager.full_name}</p>
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

                {/* Resources row */}
                <div className="px-5 py-4">
                  <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">
                    Resources ({group.records.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.records.map((rec) => (
                      <div
                        key={rec._id}
                        className="flex items-center gap-2 bg-muted/60 border rounded-full px-3 py-1.5"
                      >
                        {/* Avatar initials */}
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                          {rec.employee_id.employee_name
                            .split(" ")
                            .slice(0, 2)
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div className="leading-tight">
                          <p className="text-sm font-medium leading-none">
                            {rec.employee_id.employee_name.split(" ")[0]}
                          </p>
                          <p className="text-xs text-muted-foreground">{rec.employee_id.unique_id}</p>
                        </div>
                        <button
                          className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
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
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? "Edit Project Mapping" : "Map Employees to Project"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Project */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Project <span className="text-destructive">*</span>
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
                        <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{p.project_name}</span>
                        {p.unique_id && (
                          <span className="text-xs text-muted-foreground">({p.unique_id})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Manager */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Manager <span className="text-destructive">*</span>
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
                        <span className="text-xs text-muted-foreground">{m.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employees */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Resources
                {selectedEmployeeIds.length > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    ({selectedEmployeeIds.length} selected)
                  </span>
                )}
              </label>
              <div className="border rounded-lg divide-y max-h-56 overflow-y-auto">
                {availableEmployees.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No employees available
                  </div>
                ) : (
                  availableEmployees.map((emp) => {
                    const checked = selectedEmployeeIds.includes(emp._id);
                    return (
                      <label
                        key={emp._id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEmployee(emp._id)}
                          className="h-4 w-4 rounded border-gray-300 accent-primary"
                        />
                        {/* Avatar */}
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                          {emp.employee_name
                            .split(" ")
                            .slice(0, 2)
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{emp.employee_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {emp.unique_id} · {emp.designation}
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
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingGroup ? "Update Mapping" : "Map Employees"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove employee from project confirm */}
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
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDeleteRecord}
              disabled={deleting}
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
