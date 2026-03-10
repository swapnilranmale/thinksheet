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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  Clock,
  CheckCircle2,
  Users,
  Eye,
  Calendar,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  managerTimesheetService,
  TeamMember,
  Timesheet,
  EmployeeMaster,
} from "@/services/timesheet";

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const CURRENT_MONTH = NOW.getMonth(); // 0-indexed

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TeamMember["status"] }) {
  if (status === "submitted") {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 text-xs">
        <CheckCircle2 className="w-3 h-3" />
        Submitted
      </Badge>
    );
  }
  if (status === "draft") {
    return (
      <Badge variant="outline" className="gap-1 text-xs text-orange-600 border-orange-200">
        <Clock className="w-3 h-3" />
        In Progress
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs text-muted-foreground">
      Not Started
    </Badge>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ManagerTimesheetReviewPage() {
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH); // 0-indexed
  const [selectedYear] = useState(CURRENT_YEAR);

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewingMember, setViewingMember] = useState<TeamMember | null>(null);
  const [viewingTimesheet, setViewingTimesheet] = useState<Timesheet | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<EmployeeMaster | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Load team list ────────────────────────────────────────────────────────

  const loadTeam = useCallback(async () => {
    try {
      setLoading(true);
      const apiMonth = selectedMonth + 1;
      const res = await managerTimesheetService.getTeam(apiMonth, selectedYear);
      setTeam(res.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load team data");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  // ── Load individual employee timesheet ────────────────────────────────────

  async function viewEmployee(member: TeamMember) {
    setViewingMember(member);
    setDetailLoading(true);
    try {
      const apiMonth = selectedMonth + 1;
      const res = await managerTimesheetService.getEmployeeTimesheet(
        member.employee_id,
        apiMonth,
        selectedYear
      );
      setViewingTimesheet(res.data);
      setViewingEmployee(res.employee);
    } catch (err: any) {
      toast.error(err.message || "Failed to load timesheet");
      setViewingMember(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function backToTeam() {
    setViewingMember(null);
    setViewingTimesheet(null);
    setViewingEmployee(null);
  }

  const submittedCount = team.filter((e) => e.status === "submitted").length;
  const draftCount = team.filter((e) => e.status === "draft").length;
  const notStartedCount = team.filter((e) => e.status === "not_started").length;

  // ── Detail view ───────────────────────────────────────────────────────────

  if (viewingMember) {
    const entries = [...(viewingTimesheet?.entries ?? [])].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const totalWorked = entries.reduce((s, e) => s + (e.worked_hours || 0), 0);
    const totalBillable = entries.reduce((s, e) => s + (e.billable_hours || 0), 0);
    const totalActual = entries.reduce((s, e) => s + (e.actual_hours || 0), 0);
    const completed = entries.filter((e) => e.completed_task).length;
    const unplanned = entries.filter((e) => e.unplanned_task).length;

    // Excel-like column definitions
    const COL = {
      row:       "w-8   min-w-[32px]",
      date:      "w-24  min-w-[96px]",
      day:       "w-20  min-w-[80px]",
      tasks:     "min-w-[260px]",
      worked:    "w-20  min-w-[80px]",
      billable:  "w-20  min-w-[80px]",
      actual:    "w-20  min-w-[80px]",
      done:      "w-20  min-w-[80px]",
      unplanned: "w-24  min-w-[96px]",
      desc:      "min-w-[200px]",
      comments:  "min-w-[200px]",
    };

    return (
      <DashboardLayout>
        <div className="flex-1 flex flex-col min-h-0 animate-fade-in">

          {/* ── Toolbar ─────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 mb-4">
            <Button variant="outline" size="sm" onClick={backToTeam} className="gap-1.5 shrink-0">
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold tracking-tight leading-tight truncate">
                {viewingMember.employee_name}
              </h1>
              <p className="text-muted-foreground text-xs truncate">
                {viewingMember.designation} · {viewingMember.unique_id} · {MONTHS[selectedMonth]} {selectedYear}
              </p>
            </div>
            <StatusBadge status={viewingMember.status} />
          </div>

          {detailLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading timesheet...</span>
            </div>
          ) : (
            <>
              {/* ── KPI strip (compact) ─────────────────────────────────── */}
              <div className="grid grid-cols-6 gap-2 mb-3">
                {[
                  { label: "Days",      value: entries.length,   color: "" },
                  { label: "Worked",    value: `${totalWorked}h`,  color: "text-slate-700" },
                  { label: "Billable",  value: `${totalBillable}h`, color: "text-blue-600" },
                  { label: "Actual",    value: `${totalActual}h`, color: "text-violet-600" },
                  { label: "Completed", value: completed,         color: "text-green-600" },
                  { label: "Unplanned", value: unplanned,         color: "text-orange-500" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white border rounded px-3 py-2 flex flex-col">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
                    <span className={`text-xl font-bold leading-tight mt-0.5 ${color}`}>{value}</span>
                  </div>
                ))}
              </div>

              {/* ── Excel grid ─────────────────────────────────────────── */}
              {entries.length === 0 ? (
                <div className="flex-1 border rounded-lg flex flex-col items-center justify-center py-16 text-muted-foreground bg-white">
                  <Clock className="w-10 h-10 mb-3 opacity-25" />
                  <p className="font-medium">No entries for this month</p>
                  <p className="text-sm">Employee hasn't filled in any timesheet data yet</p>
                </div>
              ) : (
                <div className="flex-1 border rounded-lg overflow-auto bg-white">
                  <table className="w-full border-collapse text-xs" style={{ minWidth: "900px" }}>
                    {/* Sticky header */}
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#217346] text-white">
                        <th className={`border border-[#1a5c38] px-2 py-2 text-center font-semibold ${COL.row}`}>#</th>
                        <th className={`border border-[#1a5c38] px-2 py-2 text-left   font-semibold ${COL.date}`}>Date</th>
                        <th className={`border border-[#1a5c38] px-2 py-2 text-left   font-semibold ${COL.day}`}>Day</th>
                        <th className={`border border-[#1a5c38] px-2 py-2 text-left   font-semibold ${COL.tasks}`}>Tasks</th>
                        <th className={`border border-[#1a5c38] px-2 py-2 text-right  font-semibold ${COL.worked}`}>Worked</th>
                        <th className={`border border-[#1a5c38] px-2 py-2 text-right  font-semibold ${COL.billable}`}>Billable</th>
                        <th className={`border border-[#1a5c38] px-2 py-2 text-right  font-semibold ${COL.actual}`}>Actual</th>
                        <th className={`border border-[#1a5c38] px-2 py-2 text-center font-semibold ${COL.done}`}>Done?</th>
                        <th className={`border border-[#1a5c38] px-2 py-2 text-center font-semibold ${COL.unplanned}`}>Unplanned?</th>
                        <th className={`border border-[#1a5c38] px-2 py-2 text-left   font-semibold ${COL.desc}`}>Completion Note</th>
                        <th className={`border border-[#1a5c38] px-2 py-2 text-left   font-semibold ${COL.comments}`}>Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, idx) => {
                        const d = new Date(entry.date);
                        const dayName = d.toLocaleDateString("en-IN", { weekday: "short" });
                        const dateStr = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        const rowBg = entry.completed_task
                          ? "bg-green-50"
                          : entry.unplanned_task
                          ? "bg-orange-50"
                          : idx % 2 === 0
                          ? "bg-white"
                          : "bg-[#f5f5f5]";

                        return (
                          <tr key={idx} className={`${rowBg} hover:bg-blue-50 transition-colors`}>
                            {/* # */}
                            <td className="border border-gray-200 px-2 py-1.5 text-center text-gray-400 font-mono select-none">
                              {idx + 1}
                            </td>
                            {/* Date */}
                            <td className={`border border-gray-200 px-2 py-1.5 whitespace-nowrap font-medium ${isWeekend ? "text-blue-600" : ""}`}>
                              {dateStr}
                            </td>
                            {/* Day */}
                            <td className={`border border-gray-200 px-2 py-1.5 font-medium ${isWeekend ? "text-blue-600" : "text-gray-500"}`}>
                              {dayName}
                            </td>
                            {/* Tasks */}
                            <td className="border border-gray-200 px-2 py-1.5">
                              {(entry.tasks || []).length === 0 ? (
                                <span className="text-gray-300">—</span>
                              ) : (entry.tasks || []).length === 1 ? (
                                <span>{entry.tasks[0]}</span>
                              ) : (
                                <ul className="space-y-0.5 list-none">
                                  {(entry.tasks || []).map((t, ti) => (
                                    <li key={ti} className="flex items-start gap-1">
                                      <span className="text-gray-400 shrink-0 mt-0.5 select-none">▸</span>
                                      <span>{t}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                            {/* Worked */}
                            <td className="border border-gray-200 px-2 py-1.5 text-right font-mono font-semibold">
                              {entry.worked_hours ?? 0}
                            </td>
                            {/* Billable */}
                            <td className="border border-gray-200 px-2 py-1.5 text-right font-mono text-blue-600 font-semibold">
                              {entry.billable_hours ?? 0}
                            </td>
                            {/* Actual */}
                            <td className="border border-gray-200 px-2 py-1.5 text-right font-mono text-violet-600">
                              {entry.actual_hours ?? 0}
                            </td>
                            {/* Done */}
                            <td className="border border-gray-200 px-2 py-1.5 text-center">
                              {entry.completed_task ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600 font-bold text-[10px]">✓</span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            {/* Unplanned */}
                            <td className="border border-gray-200 px-2 py-1.5 text-center">
                              {entry.unplanned_task ? (
                                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-semibold text-[10px] uppercase tracking-wide">
                                  Yes
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            {/* Completion note */}
                            <td className="border border-gray-200 px-2 py-1.5 text-green-700">
                              {entry.completed_task_description ? (
                                entry.completed_task_description.includes("\n") ? (
                                  <ul className="space-y-0.5 list-none">
                                    {entry.completed_task_description.split("\n").filter(Boolean).map((line, li) => (
                                      <li key={li} className="flex items-start gap-1">
                                        <span className="text-green-400 shrink-0 mt-0.5 select-none">▸</span>
                                        <span>{line}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <span>{entry.completed_task_description}</span>
                                )
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            {/* Comments */}
                            <td className="border border-gray-200 px-2 py-1.5 text-gray-500">
                              {entry.comments || <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Totals row */}
                      <tr className="bg-[#e8f0fe] font-semibold sticky bottom-0 border-t-2 border-[#217346]">
                        <td className="border border-gray-300 px-2 py-2 text-center text-gray-500 text-[10px] uppercase tracking-wide" colSpan={4}>
                          TOTAL — {entries.length} {entries.length === 1 ? "day" : "days"}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-right font-mono text-slate-800 font-bold">
                          {totalWorked}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-right font-mono text-blue-700 font-bold">
                          {totalBillable}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-right font-mono text-violet-700 font-bold">
                          {totalActual}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-center text-green-700 font-bold">
                          {completed}/{entries.length}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-center text-orange-600 font-bold">
                          {unplanned}
                        </td>
                        <td className="border border-gray-300 px-2 py-2" colSpan={2} />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ── Team list view ────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="flex-1 flex flex-col min-h-0 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Employee Timesheets</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Review timesheets submitted by your team members
            </p>
          </div>
          <Select
            value={String(selectedMonth)}
            onValueChange={(v) => setSelectedMonth(Number(v))}
          >
            <SelectTrigger className="w-44">
              <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month, idx) => (
                <SelectItem key={idx} value={String(idx)}>
                  {month} {selectedYear}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{team.length}</p>
              <p className="text-xs text-muted-foreground">Team Members</p>
            </div>
          </div>
          <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{submittedCount}</p>
              <p className="text-xs text-muted-foreground">Submitted</p>
            </div>
          </div>
          <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{draftCount}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
          </div>
          <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{notStartedCount}</p>
              <p className="text-xs text-muted-foreground">Not Started</p>
            </div>
          </div>
        </div>

        {/* Team table */}
        <div className="bg-card border rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading team data...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-8">#</TableHead>
                  <TableHead className="font-semibold">Employee</TableHead>
                  <TableHead className="font-semibold text-center">Entries</TableHead>
                  <TableHead className="font-semibold text-center">Hours Logged</TableHead>
                  <TableHead className="font-semibold">Last Submitted</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-right w-24">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No team members mapped</p>
                      <p className="text-sm">Ask your admin to map employees under you</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  team.map((member, idx) => (
                    <TableRow key={member.mapping_id} className="hover:bg-muted/30">
                      <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{member.employee_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.unique_id} · {member.designation}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {member.entries_count > 0 ? (
                          <span className="font-medium">{member.entries_count}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {member.total_worked > 0 ? (
                          <span className="font-medium">{member.total_worked}h</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {member.submitted_at ? (
                          <span className="text-sm">
                            {new Date(member.submitted_at).toLocaleDateString("en-IN", {
                              day: "2-digit", month: "short", year: "numeric",
                            })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={member.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 h-8"
                          disabled={member.status === "not_started"}
                          onClick={() => viewEmployee(member)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
