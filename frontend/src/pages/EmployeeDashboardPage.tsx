import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Loader2, Calendar, CheckCircle2, Briefcase, TrendingUp, FileText,
  ArrowUpRight, FolderOpen, User, ChevronRight, AlertCircle, Layers, Star,
} from "lucide-react";
import { toast } from "sonner";
import { employeeProjectService, EmployeeStats, EmployeeProject } from "@/services/timesheet";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/api";
import ReactApexChart from "react-apexcharts";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

function StatCard({ icon, label, value, sub, accent, badge }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; accent: string; badge?: { label: string; color: string } | null;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>{icon}</div>
      </div>
      <div>
        <p className="text-3xl font-bold text-slate-900 leading-none">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
      {badge && (
        <span className={`self-start text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
      )}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-100 rounded-xl ${className}`} />;
}

export default function EmployeeDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [projects, setProjects] = useState<EmployeeProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statsRes, projRes] = await Promise.all([
          employeeProjectService.getMyStats(),
          employeeProjectService.getMyProjects(),
        ]);
        if (!cancelled) {
          setStats(statsRes.data);
          setProjects(projRes.data ?? []);
        }
      } catch (err) {
        if (!cancelled) toast.error(getErrorMessage(err, "Failed to load dashboard"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const now = new Date();
  const monthLabel = stats
    ? MONTHS[stats.currentMonth - 1] + " " + stats.currentYear
    : MONTHS[now.getMonth()] + " " + now.getFullYear();

  const EXPECTED_WORKING = 22;
  const workingPct = stats ? Math.min(100, Math.round((stats.currentWorking / EXPECTED_WORKING) * 100)) : 0;
  const totalSheets = stats ? stats.submitted + stats.drafts : 0;
  const submissionRate = totalSheets > 0 && stats ? Math.round((stats.submitted / totalSheets) * 100) : 0;

  // ── Radial chart: working-days progress ──
  const radialOptions: ApexCharts.ApexOptions = {
    chart: { type: "radialBar", sparkline: { enabled: true } },
    plotOptions: {
      radialBar: {
        startAngle: -135, endAngle: 135,
        hollow: { size: "62%" },
        track: { background: "#f1f5f9", strokeWidth: "100%" },
        dataLabels: {
          name: { show: false },
          value: {
            fontSize: "22px", fontWeight: 700, color: "#0f172a",
            formatter: () => `${stats?.currentWorking ?? 0}d`,
            offsetY: 8,
          },
        },
      },
    },
    fill: { type: "gradient", gradient: { shade: "dark", type: "horizontal", gradientToColors: ["#10b981"], stops: [0, 100] } },
    colors: ["#217346"],
    stroke: { lineCap: "round" },
  };

  // ── Donut chart: submitted vs drafts ──
  const donutOptions: ApexCharts.ApexOptions = {
    chart: { type: "donut", sparkline: { enabled: false } },
    labels: ["Submitted", "In Draft"],
    colors: ["#217346", "#f59e0b"],
    dataLabels: { enabled: false },
    legend: { show: false },
    plotOptions: {
      pie: {
        donut: {
          size: "65%",
          labels: {
            show: true,
            total: {
              show: true, label: "Total", fontSize: "11px", color: "#94a3b8",
              formatter: (w) => `${w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0)}`,
            },
          },
        },
      },
    },
    tooltip: { y: { formatter: (val: number) => `${val} sheets` } },
    stroke: { width: 2 },
  };

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 animate-fade-in">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#217346]/20 to-[#217346]/10 flex items-center justify-center shrink-0 ring-2 ring-[#217346]/15 shadow-sm">
              <span className="text-lg font-bold text-[#217346]">{user?.full_name ? getInitials(user.full_name) : "?"}</span>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest mb-0.5">{getGreeting()}</p>
              <h1 className="text-2xl font-bold text-slate-900 leading-tight">{user?.full_name ?? "—"}</h1>
              {user?.designation && (
                <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" />{user.designation}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-sm text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2">
              <Calendar className="w-4 h-4 text-[#217346]" />{monthLabel}
            </div>
            <button
              onClick={() => navigate("/timesheet/employee")}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-[#217346] text-white rounded-lg hover:bg-[#1a5c38] transition-colors shadow-sm"
            >
              My Timesheets <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── KPI Row ── */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<Layers className="w-4.5 h-4.5 text-[#217346]" />} label="Assigned Projects" value={stats.totalProjects} sub="active mappings" accent="bg-green-50" />
            <StatCard icon={<TrendingUp className="w-4.5 h-4.5 text-blue-600" />} label={`${MONTHS[stats.currentMonth - 1]} Billable`} value={`${stats.currentBillable}h`} sub="billable this month" accent="bg-blue-50"
              badge={stats.currentBillable > 0 ? { label: "On track", color: "bg-emerald-50 text-emerald-700" } : null} />
            <StatCard icon={<CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />} label="Submitted" value={stats.submitted} sub="timesheets approved/submitted" accent="bg-emerald-50"
              badge={submissionRate > 0 ? { label: `${submissionRate}% rate`, color: submissionRate >= 80 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700" } : null} />
            <StatCard icon={<FileText className="w-4.5 h-4.5 text-amber-600" />} label="In Draft" value={stats.drafts} sub="pending submission" accent="bg-amber-50"
              badge={stats.drafts > 0 ? { label: "Action needed", color: "bg-amber-50 text-amber-700" } : { label: "All clear", color: "bg-emerald-50 text-emerald-700" }} />
          </div>
        ) : null}

        {/* ── Charts row ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Skeleton className="h-56 sm:col-span-2" />
            <Skeleton className="h-56" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Radial: working-days attendance */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:col-span-2 flex flex-col sm:flex-row items-center gap-6">
              <div className="shrink-0 flex flex-col items-center">
                <ReactApexChart
                  type="radialBar"
                  series={[workingPct]}
                  options={radialOptions}
                  height={200}
                  width={200}
                />
                <p className="text-xs text-slate-400 -mt-3">of {EXPECTED_WORKING} working days</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                  {MONTHS[stats.currentMonth - 1]} Attendance
                </p>
                <p className="text-3xl font-bold text-slate-900">
                  {stats.currentWorking} <span className="text-lg font-medium text-slate-400">days</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {EXPECTED_WORKING - stats.currentWorking > 0 ? `${EXPECTED_WORKING - stats.currentWorking} working days remaining` : "Month complete"}
                </p>
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-0.5">Billable (month)</p>
                    <p className="text-xl font-bold text-[#217346]">{stats.currentBillable}h</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-0.5">All-time Billable</p>
                    <p className="text-xl font-bold text-slate-800">{stats.totalBillable}h</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Donut: timesheet status distribution */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Timesheet Status</p>
              <p className="text-sm font-semibold text-slate-700 mb-2">{totalSheets} total timesheets</p>
              {totalSheets > 0 ? (
                <>
                  <ReactApexChart
                    type="donut"
                    series={[stats.submitted, stats.drafts]}
                    options={donutOptions}
                    height={180}
                  />
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#217346] inline-block" />Submitted</span>
                      <span className="font-semibold text-slate-700">{stats.submitted}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />In Draft</span>
                      <span className="font-semibold text-slate-700">{stats.drafts}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                  <FileText className="w-10 h-10 mb-2" />
                  <p className="text-xs text-slate-400">No timesheets yet</p>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* ── Draft alert ── */}
        {!loading && stats && stats.drafts > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">{stats.drafts} timesheet{stats.drafts !== 1 ? "s" : ""} pending submission</p>
              <p className="text-xs text-amber-600 mt-0.5">Submit your timesheets to your manager for approval.</p>
            </div>
            <button onClick={() => navigate("/timesheet/employee")} className="shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1 transition-colors">
              Go to timesheets <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Projects ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-[#217346]" />My Projects
            </h2>
            {projects.length > 0 && (
              <button onClick={() => navigate("/timesheet/employee")} className="text-xs text-[#217346] hover:underline font-medium flex items-center gap-0.5">
                View timesheets <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : projects.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center py-12 text-slate-400">
              <FolderOpen className="w-8 h-8 mb-2 opacity-30" />
              <p className="font-medium text-slate-600 text-sm">No projects assigned yet</p>
              <p className="text-xs mt-0.5">Your manager will assign you to projects</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              {projects.map((proj, i) => (
                <div key={proj.mapping_id} className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50/80 transition-colors ${i < projects.length - 1 ? "border-b border-slate-100" : ""}`}>
                  <div className="w-9 h-9 rounded-xl bg-[#217346]/10 flex items-center justify-center shrink-0">
                    <Briefcase className="w-4 h-4 text-[#217346]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 text-sm">{proj.project_name || "Unnamed Project"}</p>
                      {proj.project_code && <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{proj.project_code}</span>}
                    </div>
                    {proj.manager && <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><User className="w-3 h-3" />Manager: {proj.manager.full_name}</p>}
                  </div>
                  <button onClick={() => navigate("/timesheet/employee")} className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-[#217346] border border-[#217346]/30 hover:bg-[#217346]/5 px-3 py-1.5 rounded-lg transition-colors">
                    Timesheet <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Quick actions ── */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-[#217346]" />Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={() => navigate("/timesheet/employee")} className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-[#217346]/40 hover:shadow-sm transition-all text-left group">
              <div className="w-10 h-10 rounded-xl bg-[#217346]/10 group-hover:bg-[#217346]/15 flex items-center justify-center shrink-0 transition-colors">
                <FileText className="w-5 h-5 text-[#217346]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm">Fill Timesheet</p>
                <p className="text-xs text-slate-400 mt-0.5">Log hours for {MONTHS[now.getMonth()]}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#217346] transition-colors shrink-0" />
            </button>
            <button onClick={() => navigate("/timesheet/employee")} className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-[#217346]/40 hover:shadow-sm transition-all text-left group">
              <div className="w-10 h-10 rounded-xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm">View & Submit</p>
                <p className="text-xs text-slate-400 mt-0.5">Review drafts and submit for approval</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
            </button>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
