import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Users, Clock, TrendingUp, CheckCircle2, Loader2,
  Calendar, ArrowUpRight, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { dashboardService, ManagerDashboardStats } from "@/services/timesheet";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/api";
import { clsx } from "clsx";
import ReactApexChart from "react-apexcharts";
import type ApexCharts from "apexcharts";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const PROJECT_COLORS = [
  "#217346", "#2563eb", "#7c3aed", "#d97706", "#64748b", "#dc2626",
];

const STATUS_STYLES: Record<string, string> = {
  approved:    "bg-emerald-100 text-emerald-700",
  submitted:   "bg-amber-100 text-amber-700",
  draft:       "bg-slate-100 text-slate-600",
  rejected:    "bg-red-100 text-red-700",
  not_started: "bg-red-100 text-red-700",
};
const STATUS_LABELS: Record<string, string> = {
  approved:    "Approved",
  submitted:   "Pending",
  draft:       "Draft",
  rejected:    "Rejected",
  not_started: "Missing",
};

function StatCard({
  label, value, sub, icon, accent, highlight,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; accent: string; highlight?: boolean;
}) {
  return (
    <div className={clsx(
      "border rounded-xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200",
      highlight ? "bg-[#217346]/5 border-[#217346]/20" : "bg-white border-slate-200"
    )}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</span>
        <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", accent)}>
          {icon}
        </div>
      </div>
      <div>
        <p className={clsx("text-3xl font-bold leading-none", highlight ? "text-[#217346]" : "text-slate-900")}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function BillabilityBar({ value }: { value: number }) {
  const color = value >= 85 ? "bg-[#217346]" : value >= 70 ? "bg-blue-500" : value >= 50 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={clsx("h-full rounded-full transition-all duration-500", color)} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-700 w-9 text-right shrink-0">{value}%</span>
    </div>
  );
}

function SkeletonCard() {
  return <div className="bg-white border rounded-xl p-5 h-28 animate-pulse bg-slate-50" />;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function fmtSubmitted(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function ManagerDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<ManagerDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await dashboardService.getManagerStats();
        if (!cancelled) setStats(res.data);
      } catch (err) {
        if (!cancelled) toast.error(getErrorMessage(err, "Failed to load dashboard"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 4);

  const projectSlices = (stats?.projectWiseHours ?? []).map((p, i) => ({
    name: p.name,
    hours: p.hours,
    color: PROJECT_COLORS[i % PROJECT_COLORS.length],
  }));

  const donutOptions: ApexCharts.ApexOptions = {
    chart: { type: "donut", toolbar: { show: false } },
    labels: projectSlices.map(p => p.name),
    colors: projectSlices.map(p => p.color),
    legend: { show: false },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (v: number) => `${v}h` } },
    plotOptions: { pie: { donut: { size: "58%" } } },
    stroke: { width: 2 },
  };
  const donutSeries = projectSlices.map(p => p.hours);

  const memberHours = stats?.memberHoursOverview ?? [];
  const barOptions: ApexCharts.ApexOptions = {
    chart: { type: "bar", toolbar: { show: false }, animations: { enabled: true } },
    plotOptions: { bar: { horizontal: true, barHeight: "60%", borderRadius: 4 } },
    colors: memberHours.map(m => m.isOvertime ? "#f87171" : "#217346"),
    dataLabels: {
      enabled: true,
      formatter: (v: number) => `${v}h`,
      style: { fontSize: "11px", fontWeight: 600, colors: ["#fff"] },
      offsetX: -6,
    },
    xaxis: {
      categories: memberHours.map(m => m.name),
      labels: { style: { fontSize: "11px", colors: "#64748b" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { fontSize: "11px", colors: "#64748b" } } },
    grid: { borderColor: "#f1f5f9", xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    tooltip: { y: { formatter: (v: number) => `${v}h` } },
  };
  const barSeries = [{ name: "Hours", data: memberHours.map(m => m.hours) }];

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 animate-fade-in">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-slate-900">Engineering manager dashboard</h1>
            </div>
            <p className="text-sm text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {user?.full_name} · Week of {fmtDate(weekStart)} – {fmtDate(weekEnd)} {now.getFullYear()}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate("/timesheet/manager")}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-[#217346] text-white rounded-lg hover:bg-[#1a5e38] transition-colors"
            >
              Approve all <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => navigate("/workspace?tab=projects")}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Export <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Team members"
                value={stats.totalMembers}
                sub="all active"
                icon={<Users className="w-4.5 h-4.5 text-slate-600" />}
                accent="bg-slate-100"
              />
              <StatCard
                label="Submitted this week"
                value={`${stats.submittedCount} / ${stats.totalMembers}`}
                sub={stats.missingCount > 0 ? `${stats.missingCount} missing` : "all submitted"}
                icon={<CheckCircle2 className="w-4.5 h-4.5 text-[#217346]" />}
                accent="bg-green-50"
              />
              <StatCard
                label="Pending my approval"
                value={stats.pendingApproval}
                sub={stats.oldestPendingHours !== null ? `oldest: ${stats.oldestPendingHours}h ago` : "none pending"}
                icon={<AlertTriangle className="w-4.5 h-4.5 text-amber-600" />}
                accent="bg-amber-50"
                highlight={stats.pendingApproval > 0}
              />
              <StatCard
                label="Team billability"
                value={`${stats.teamBillability}%`}
                sub="target: 85%"
                icon={<TrendingUp className="w-4.5 h-4.5 text-blue-600" />}
                accent="bg-blue-50"
              />
            </div>

            {/* ── Approval Queue + Projects ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Approval queue */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-800">Approval queue</h2>
                    {stats.pendingApproval > 0 && (
                      <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                        {stats.pendingApproval} pending
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => navigate("/timesheet/manager")}
                    className="text-xs font-medium text-[#217346] hover:underline flex items-center gap-1"
                  >
                    Review all <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500">Member</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Period</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Hours</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500">Submitted</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.approvalQueue.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-slate-400">
                            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                            <p className="text-xs">No pending approvals</p>
                          </td>
                        </tr>
                      ) : stats.approvalQueue.map((item, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-bold text-slate-600">{item.employeeInitials}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-slate-800 truncate">{item.employeeName}</p>
                                {item.designation && <p className="text-[11px] text-slate-400 truncate">{item.designation}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center text-xs text-slate-500">
                            {item.periodStart && item.periodEnd
                              ? `${fmtDate(new Date(item.periodStart))} – ${fmtDate(new Date(item.periodEnd))}`
                              : MONTHS[stats.month - 1]}
                          </td>
                          <td className="px-3 py-3 text-center font-semibold text-slate-700">{item.totalHours}h</td>
                          <td className="px-3 py-3 text-xs text-slate-500">{fmtSubmitted(item.submittedAt)}</td>
                          <td className="px-3 py-3 text-center">
                            <button
                              onClick={() => navigate(`/timesheet/manager`)}
                              className="text-xs font-medium border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors flex items-center gap-1 mx-auto"
                            >
                              Approve <ArrowUpRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Project-wise hours */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-800">Project-wise hours this week</h2>
                  <button
                    onClick={() => navigate("/workspace?tab=projects")}
                    className="text-xs font-medium text-[#217346] hover:underline flex items-center gap-1"
                  >
                    Details <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
                {projectSlices.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                    <Clock className="w-8 h-8" />
                    <p className="text-xs">No project hours logged yet</p>
                  </div>
                ) : (
                  <div className="p-5 flex flex-col sm:flex-row items-center gap-6">
                    <div className="shrink-0">
                      <ReactApexChart
                        type="donut"
                        series={donutSeries}
                        options={donutOptions}
                        width={140}
                        height={140}
                      />
                    </div>
                    <div className="flex-1 space-y-2 min-w-0">
                      {projectSlices.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: p.color }} />
                          <span className="text-xs text-slate-600 flex-1 truncate">{p.name}</span>
                          <span className="text-xs font-semibold text-slate-700 shrink-0">{p.hours}h</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Member-wise timesheet status ── */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-800">Member-wise timesheet status</h2>
                <button
                  onClick={() => navigate("/workspace?tab=employees")}
                  className="flex items-center gap-1.5 text-xs font-medium border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
                >
                  Remind missing <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500">Member</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Role</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Mon</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Tue</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Wed</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Thu</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Fri</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Total</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 min-w-[120px]">Billable</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.memberWiseStatus.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-8 text-slate-400 text-xs">No team members found</td>
                      </tr>
                    ) : stats.memberWiseStatus.map((member, i) => {
                      const days = member.weekDays;
                      const renderDay = (h: number | null) => {
                        if (h === null) return <span className="text-slate-300 text-sm">–</span>;
                        const bg = h >= 8 ? "bg-blue-100 text-blue-700"
                          : h > 0 ? "bg-amber-100 text-amber-700"
                          : "bg-red-50 text-red-400";
                        return (
                          <span className={clsx("inline-flex items-center justify-center w-8 h-7 rounded-md text-xs font-semibold", bg)}>
                            {h}h
                          </span>
                        );
                      };
                      const statusStyle = STATUS_STYLES[member.status] || "bg-slate-100 text-slate-600";
                      const statusLabel = STATUS_LABELS[member.status] || member.status;
                      return (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-bold text-slate-600">{member.initials}</span>
                              </div>
                              <span className="font-medium text-slate-800">{member.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{member.designation || "—"}</td>
                          <td className="px-3 py-3 text-center">{renderDay(days.Mon)}</td>
                          <td className="px-3 py-3 text-center">{renderDay(days.Tue)}</td>
                          <td className="px-3 py-3 text-center">{renderDay(days.Wed)}</td>
                          <td className="px-3 py-3 text-center">{renderDay(days.Thu)}</td>
                          <td className="px-3 py-3 text-center">{renderDay(days.Fri)}</td>
                          <td className="px-3 py-3 text-center font-semibold text-slate-700">{member.totalHours}h</td>
                          <td className="px-4 py-3">
                            <BillabilityBar value={member.billability} />
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={clsx("text-[11px] font-semibold px-2.5 py-0.5 rounded-full", statusStyle)}>
                              {statusLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Member hours overview ── */}
            {stats.memberHoursOverview.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-slate-800">Member hours — week overview</h2>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#217346] inline-block" /> Normal</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> Overtime</span>
                  </div>
                </div>
                <ReactApexChart
                  type="bar"
                  series={barSeries}
                  options={barOptions}
                  height={Math.max(180, memberHours.length * 38)}
                />
              </div>
            )}
          </>
        ) : null}

        {loading && (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
