import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Users, Clock, TrendingUp, AlertCircle, CheckCircle2,
  Loader2, Calendar, ArrowUpRight, AlertTriangle, Info,
  Star, UserX, Bell,
} from "lucide-react";
import { toast } from "sonner";
import { dashboardService, AdminDashboardStats } from "@/services/timesheet";
import { getErrorMessage } from "@/lib/api";
import { clsx } from "clsx";
import ReactApexChart from "react-apexcharts";
import type ApexCharts from "apexcharts";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const ALERT_COLORS = {
  critical: { dot: "bg-red-500",   text: "text-red-600",   bg: "bg-red-50"    },
  warning:  { dot: "bg-amber-500", text: "text-amber-600", bg: "bg-amber-50"  },
  info:     { dot: "bg-blue-500",  text: "text-blue-600",  bg: "bg-blue-50"   },
  success:  { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
};

const ISSUE_COLORS: Record<string, string> = {
  "Missing timesheet":       "bg-red-100 text-red-700",
  "Timesheet not submitted": "bg-amber-100 text-amber-700",
};

function StatCard({
  label, value, sub, icon, accent, trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
  trend?: { label: string; positive: boolean } | null;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</span>
        <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", accent)}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-slate-900 leading-none">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
      {trend && (
        <p className={clsx("text-xs font-medium", trend.positive ? "text-emerald-600" : "text-red-500")}>
          {trend.label}
        </p>
      )}
    </div>
  );
}

function BillabilityBar({ value, color }: { value: number; color: string }) {
  const width = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={clsx("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-slate-700 w-9 text-right shrink-0">{value}%</span>
    </div>
  );
}

function SkeletonCard() {
  return <div className="bg-white border rounded-xl p-5 h-28 animate-pulse bg-slate-50" />;
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await dashboardService.getAdminStats();
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
  const fmtDate = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  // ── ApexCharts configs ───────────────────────────────────────────────────────
  const submissionRate = stats?.submissionRate ?? 0;
  const orgBillability = stats?.orgBillability ?? 0;

  const radialOptions: ApexCharts.ApexOptions = {
    chart: { type: "radialBar", toolbar: { show: false } },
    plotOptions: {
      radialBar: {
        offsetY: 0,
        startAngle: -130,
        endAngle: 130,
        hollow: { size: "35%" },
        track: { background: "#f1f5f9", strokeWidth: "100%" },
        dataLabels: {
          name: { fontSize: "11px", color: "#94a3b8", offsetY: 14 },
          value: { fontSize: "16px", fontWeight: 700, color: "#0f172a", offsetY: -8,
            formatter: (v: number) => `${v}%` },
          total: {
            show: true,
            label: "Submission",
            fontSize: "10px",
            color: "#94a3b8",
            formatter: () => `${submissionRate}%`,
          },
        },
      },
    },
    colors: ["#217346", "#2563eb"],
    labels: ["Submission Rate", "Org Billability"],
    stroke: { lineCap: "round" },
  };
  const radialSeries = [submissionRate, orgBillability];

  const donutLabels = ["Submitted", "Pending Approval", "Missing"];
  const donutColors = ["#217346", "#f59e0b", "#ef4444"];
  const donutValues = [
    (stats?.timesheetsSubmitted ?? 0) - (stats?.pendingApprovals ?? 0),
    stats?.pendingApprovals ?? 0,
    stats?.missingTimesheets ?? 0,
  ];
  const donutOptions: ApexCharts.ApexOptions = {
    chart: { type: "donut", toolbar: { show: false } },
    labels: donutLabels,
    colors: donutColors,
    legend: { position: "bottom", fontSize: "11px", markers: { size: 6 } },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (v: number) => `${v} timesheets` } },
    plotOptions: { pie: { donut: { size: "60%",
      labels: { show: true, total: { show: true, label: "Total", fontSize: "11px",
        formatter: () => `${stats?.totalEmployees ?? 0}` } } } } },
    stroke: { width: 2 },
  };

  const teamNames = (stats?.teamWiseStats ?? []).map(t => t.teamName);
  const teamBillabilityValues = (stats?.teamWiseStats ?? []).map(t => t.billability);
  const teamSubmissionValues = (stats?.teamWiseStats ?? []).map(t => t.submissionRate);
  const teamBarOptions: ApexCharts.ApexOptions = {
    chart: { type: "bar", toolbar: { show: false }, animations: { enabled: true } },
    plotOptions: { bar: { horizontal: false, columnWidth: "55%", borderRadius: 4 } },
    colors: ["#217346", "#2563eb"],
    dataLabels: { enabled: false },
    xaxis: {
      categories: teamNames,
      labels: { style: { fontSize: "11px", colors: "#64748b" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { max: 100, labels: { formatter: (v: number) => `${v}%`, style: { fontSize: "11px", colors: "#64748b" } } },
    grid: { borderColor: "#f1f5f9" },
    legend: { position: "top", fontSize: "11px", markers: { size: 6 } },
    tooltip: { y: { formatter: (v: number) => `${v}%` } },
  };
  const teamBarSeries = [
    { name: "Billability %", data: teamBillabilityValues },
    { name: "Submission %", data: teamSubmissionValues },
  ];

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 animate-fade-in">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-slate-900">Admin dashboard</h1>
              <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Org-wide view</span>
            </div>
            <p className="text-sm text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Week of {fmtDate(weekStart)} – {fmtDate(weekEnd)} · {stats?.year ?? now.getFullYear()}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate("/timesheet/mapping?tab=projects")}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Payroll export <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => navigate("/timesheet/mapping?tab=logs")}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Compliance <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Top KPI row ── */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total employees"
                value={stats.totalEmployees}
                sub="active members"
                icon={<Users className="w-4.5 h-4.5 text-slate-600" />}
                accent="bg-slate-100"
              />
              <StatCard
                label="Timesheets submitted"
                value={stats.timesheetsSubmitted}
                sub={`of ${stats.totalEmployees} · ${stats.submissionRate}%`}
                icon={<CheckCircle2 className="w-4.5 h-4.5 text-[#217346]" />}
                accent="bg-green-50"
                trend={stats.submissionRate >= 80
                  ? { label: `+${stats.submissionRate - 70}% vs target`, positive: true }
                  : { label: `${stats.submissionRate}% — below 80% target`, positive: false }}
              />
              <StatCard
                label="Org billability"
                value={`${stats.orgBillability}%`}
                sub="billable / worked hours"
                icon={<TrendingUp className="w-4.5 h-4.5 text-blue-600" />}
                accent="bg-blue-50"
                trend={stats.orgBillability > 0
                  ? { label: `${stats.orgBillability >= 80 ? "+" : ""}${stats.orgBillability - 80}% vs target`, positive: stats.orgBillability >= 80 }
                  : null}
              />
              <StatCard
                label="Overtime this week"
                value={`${stats.overtimeMembers} members`}
                sub="worked >160h this month"
                icon={<Clock className="w-4.5 h-4.5 text-amber-600" />}
                accent="bg-amber-50"
                trend={stats.overtimeMembers > 0
                  ? { label: `+${stats.overtimeMembers} vs last week`, positive: false }
                  : null}
              />
            </div>

            {/* ── Secondary KPI row ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Pending approvals</p>
                <p className="text-3xl font-bold text-slate-900">{stats.pendingApprovals}</p>
                {stats.managerPerformance.length > 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    across {stats.managerPerformance.filter(m => m.pending > 0).length} managers
                  </p>
                )}
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Missing timesheets</p>
                <p className={clsx("text-3xl font-bold", stats.missingTimesheets > 0 ? "text-red-600" : "text-slate-900")}>
                  {stats.missingTimesheets}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {stats.missingTimesheets > 0 ? "reminders sent today" : "all members on track"}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Total billable hours</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalBillableHours.toLocaleString()} h</p>
                <p className="text-xs text-slate-400 mt-1">of {stats.totalWorkedHours.toLocaleString()} total worked</p>
              </div>
            </div>

            {/* ── Charts row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Radial: submission rate + billability */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col items-center">
                <h2 className="text-sm font-semibold text-slate-800 mb-1 self-start">Org KPIs</h2>
                <p className="text-xs text-slate-400 mb-2 self-start">Submission rate vs billability</p>
                <ReactApexChart
                  type="radialBar"
                  series={radialSeries}
                  options={radialOptions}
                  height={220}
                  width="100%"
                />
              </div>

              {/* Donut: timesheet status breakdown */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col items-center">
                <h2 className="text-sm font-semibold text-slate-800 mb-1 self-start">Timesheet status</h2>
                <p className="text-xs text-slate-400 mb-2 self-start">Org-wide breakdown</p>
                <ReactApexChart
                  type="donut"
                  series={donutValues}
                  options={donutOptions}
                  height={220}
                  width="100%"
                />
              </div>

              {/* Bar: team-wise billability + submission */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-800 mb-1">Team performance</h2>
                <p className="text-xs text-slate-400 mb-2">Billability & submission by team</p>
                {teamNames.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                    <Clock className="w-6 h-6" />
                    <p className="text-xs">No team data</p>
                  </div>
                ) : (
                  <ReactApexChart
                    type="bar"
                    series={teamBarSeries}
                    options={teamBarOptions}
                    height={190}
                  />
                )}
              </div>
            </div>

            {/* ── Team-wise + Alerts row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Team-wise submission & billability */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-800">Team-wise submission &amp; billability</h2>
                  <button
                    onClick={() => navigate("/timesheet/mapping?tab=employees")}
                    className="flex items-center gap-1 text-xs font-medium text-[#217346] hover:underline"
                  >
                    Details <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500">Team</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Members</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Submitted</th>
                        <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 min-w-[140px]">Billability</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.teamWiseStats.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-slate-400 text-xs">No team data available</td>
                        </tr>
                      ) : stats.teamWiseStats.map((team, i) => {
                        const barColor = team.billability >= 85 ? "bg-[#217346]"
                          : team.billability >= 70 ? "bg-blue-500"
                          : team.billability >= 50 ? "bg-amber-500"
                          : "bg-red-400";
                        const statusColor = team.submissionRate === 100 ? "bg-emerald-100 text-emerald-700"
                          : team.submissionRate >= 80 ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700";
                        const statusLabel = team.submissionRate === 100 ? "On track"
                          : team.submissionRate >= 80 ? "On track"
                          : "Behind";
                        return (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-3 font-medium text-slate-800 text-sm">{team.teamName}</td>
                            <td className="px-3 py-3 text-center text-slate-600">{team.members}</td>
                            <td className="px-3 py-3 text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-slate-700 font-medium">{team.submitted}/{team.members}</span>
                                <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded-full", team.submissionRate === 100 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                                  {team.submissionRate}%
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <BillabilityBar value={team.billability} color={barColor} />
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={clsx("text-[10px] font-semibold px-2 py-0.5 rounded-full", statusColor)}>
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

              {/* Alerts & anomalies */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-800">Alerts &amp; anomalies</h2>
                  <button
                    onClick={() => navigate("/timesheet/mapping?tab=employees")}
                    className="flex items-center gap-1 text-xs font-medium text-[#217346] hover:underline"
                  >
                    View all <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="divide-y divide-slate-50">
                  {stats.alerts.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      <p className="text-sm font-medium">No alerts — all teams on track</p>
                    </div>
                  ) : stats.alerts.map((alert, i) => {
                    const colors = ALERT_COLORS[alert.severity];
                    const Icon = alert.severity === "critical" ? AlertCircle
                      : alert.severity === "warning" ? AlertTriangle
                      : alert.severity === "success" ? Star
                      : Info;
                    return (
                      <div key={i} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                        <div className={clsx("w-2 h-2 rounded-full mt-1.5 shrink-0", colors.dot)} />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-slate-800">
                            {alert.name}{alert.team && alert.name !== alert.team ? ` (${alert.team})` : ""}
                          </span>
                          <span className="text-sm text-slate-500"> — {alert.message}</span>
                        </div>
                        <Icon className={clsx("w-4 h-4 shrink-0 mt-0.5", colors.text)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Manager performance ── */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-800">Manager approval performance</h2>
                <button className="flex items-center gap-1.5 text-xs font-medium border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors">
                  <Bell className="w-3 h-3" /> Remind all <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500">Manager</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Team</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500">Pending</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Avg. approval time</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.managerPerformance.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-slate-400 text-xs">No manager data available</td>
                      </tr>
                    ) : stats.managerPerformance.map((mgr, i) => {
                      const initials = mgr.managerName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                      const pendingColor = mgr.pending === 0 ? "bg-emerald-100 text-emerald-700"
                        : mgr.pending <= 2 ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700";
                      return (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#217346] to-emerald-600 flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-bold text-white">{initials}</span>
                              </div>
                              <span className="font-medium text-slate-800">{mgr.managerName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{mgr.teamName}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={clsx("text-sm font-bold px-2.5 py-0.5 rounded-full", pendingColor)}>
                              {mgr.pending}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {mgr.allClear ? (
                              <span className="text-emerald-600 font-medium text-xs">All clear</span>
                            ) : mgr.avgApprovalHours !== null ? (
                              <span>{mgr.avgApprovalHours}h avg</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {mgr.pending > 0 ? (
                              <button className="text-xs font-medium border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors flex items-center gap-1 mx-auto">
                                Remind <ArrowUpRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Non-compliant members ── */}
            {stats.nonCompliant.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <UserX className="w-4 h-4 text-red-500" />
                    <h2 className="text-sm font-semibold text-slate-800">Non-compliant members — action required</h2>
                  </div>
                  <button className="flex items-center gap-1.5 text-xs font-medium border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors">
                    Send reminders <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500">Member</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Team</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Issue</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Reporting manager</th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500">Days overdue</th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.nonCompliant.map((member, i) => {
                        const initials = member.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                        const issueColor = ISSUE_COLORS[member.issue] || "bg-slate-100 text-slate-600";
                        return (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                                  <span className="text-[10px] font-bold text-slate-600">{initials}</span>
                                </div>
                                <span className="font-medium text-slate-800">{member.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-500">{member.team}</td>
                            <td className="px-4 py-3">
                              <span className={clsx("text-[11px] font-semibold px-2 py-0.5 rounded-full", issueColor)}>
                                {member.issue}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{member.manager}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                {member.daysOverdue}d
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button className="text-xs font-medium border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors flex items-center gap-1 mx-auto">
                                Remind <ArrowUpRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
