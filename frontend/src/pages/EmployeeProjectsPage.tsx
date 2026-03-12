import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Loader2, FolderOpen, ChevronRight, User, Calendar } from "lucide-react";
import { toast } from "sonner";
import { employeeProjectService, EmployeeProject } from "@/services/timesheet";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/api";

const NOW = new Date();
const CURRENT_MONTH_LABEL = NOW.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

export default function EmployeeProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<EmployeeProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await employeeProjectService.getMyProjects();
        if (!cancelled) setProjects(res.data);
      } catch (err) {
        if (!cancelled) toast.error(getErrorMessage(err, "Failed to load projects"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function openTimesheet(project: EmployeeProject) {
    navigate(`/timesheet/employee?projectId=${project.project_id}&projectName=${encodeURIComponent(project.project_name)}`);
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest mb-1">My Workspace</p>
          <h1 className="text-3xl font-bold text-slate-900">My Projects</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-1.5 text-sm">
            <Calendar className="w-4 h-4" />
            {CURRENT_MONTH_LABEL} · Select a project to fill your timesheet
          </p>
        </div>

        {/* ── Project list ── */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading your projects...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center py-20 text-slate-400">
            <FolderOpen className="w-12 h-12 mb-4 opacity-40" />
            <p className="font-semibold text-slate-600">No projects assigned</p>
            <p className="text-sm mt-1">Ask your administrator to map you to a project</p>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
              Your Projects ({projects.length})
            </p>
            <div className="space-y-2">
              {projects.map((project) => (
                <button
                  key={project.mapping_id}
                  onClick={() => openTimesheet(project)}
                  className="w-full group bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-[#217346] hover:shadow-md transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#217346]/10 flex items-center justify-center shrink-0 group-hover:bg-[#217346]/20 transition-colors">
                    <FolderOpen className="w-5 h-5 text-[#217346]" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm leading-tight truncate">
                      {project.project_name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {project.project_code && (
                        <span className="text-xs font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                          {project.project_code}
                        </span>
                      )}
                      {project.manager && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {project.manager.full_name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-medium text-[#217346] opacity-0 group-hover:opacity-100 transition-opacity">
                      Open Timesheet
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#217346] transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
