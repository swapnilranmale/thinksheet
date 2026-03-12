import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Loader2, Calendar, CheckCircle2, Briefcase, TrendingUp, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { employeeProjectService, EmployeeStats } from "@/services/timesheet";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/api";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const NOW = new Date();

export default function EmployeeDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const statsRes = await employeeProjectService.getMyStats();
        if (!cancelled) setStats(statsRes.data);
      } catch (err) {
        if (!cancelled) toast.error(getErrorMessage(err, "Failed to load dashboard"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const monthLabel = MONTHS[NOW.getMonth()] + " " + NOW.getFullYear();

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest mb-1">Welcome back</p>
          <h1 className="text-3xl font-bold text-slate-900">{user?.full_name}</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-1.5 text-sm">
            <Calendar className="w-4 h-4" />
            {monthLabel}
          </p>
        </div>

        {/* ── KPI Cards ── */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white border rounded-xl p-4 h-24 animate-pulse bg-slate-50" />
            ))}
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                icon={<Briefcase className="w-5 h-5 text-[#217346]" />}
                label="Total Projects"
                value={stats.totalProjects}
                bg="bg-green-50"
              />
              <KpiCard
                icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
                label={`${MONTHS[stats.currentMonth - 1]} Billable`}
                value={`${stats.currentBillable}h`}
                bg="bg-blue-50"
              />
              <KpiCard
                icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                label="Submitted"
                value={stats.submitted}
                bg="bg-emerald-50"
              />
              <KpiCard
                icon={<FileText className="w-5 h-5 text-amber-600" />}
                label="Drafts"
                value={stats.drafts}
                bg="bg-amber-50"
              />
            </div>

            {/* ── Summary row ── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border rounded-xl p-5">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                  {MONTHS[stats.currentMonth - 1]} Working Days
                </p>
                <p className="text-3xl font-bold text-slate-800">{stats.currentWorking}</p>
                <p className="text-xs text-slate-400 mt-1">days with Working status</p>
              </div>
              <div className="bg-white border rounded-xl p-5">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                  Total Billable (All Time)
                </p>
                <p className="text-3xl font-bold text-slate-800">{stats.totalBillable}h</p>
                <p className="text-xs text-slate-400 mt-1">across all projects</p>
              </div>
            </div>
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

function KpiCard({ icon, label, value, bg }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  bg: string;
}) {
  return (
    <div className="bg-white border rounded-xl p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500 leading-tight">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
