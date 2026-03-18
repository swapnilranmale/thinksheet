/**
 * Dashboard Stats Routes
 * - ADMINISTRATOR: org-wide dashboard metrics
 * - MANAGER: team dashboard metrics
 */
import express from 'express';
import { authenticate, checkActive, authorize } from '../middlewares/auth.js';
import Timesheet from '../models/timesheet/Timesheet.js';
import EmployeeManagerMapping from '../models/timesheet/EmployeeManagerMapping.js';
import Employee from '../models/users/Employee.js';
import User from '../models/users/User.js';

const router = express.Router();
const auth = [authenticate, checkActive];

// ─── GET /api/dashboard/admin-stats ─────────────────────────────────────────
router.get('/admin-stats', ...auth, authorize(['ADMINISTRATOR']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // ── 1. Total active employees ──
        const totalEmployees = await Employee.countDocuments({
            tenant_id: tenantId,
            is_active: true,
            is_deleted: { $ne: true }
        });

        // ── 2. All active mappings (for team & manager data) ──
        const allMappings = await EmployeeManagerMapping.find({
            tenant_id: tenantId,
            is_active: true,
            is_deleted: { $ne: true }
        })
            .populate('employee_id', 'employee_name official_email unique_id designation team_id team_name')
            .populate('manager_id', 'full_name email designation team_ids')
            .lean();

        // ── 3. Current month timesheets ──
        const timesheets = await Timesheet.find({ tenant_id: tenantId, month, year }).lean();

        // Lookup: userId → timesheet(s)
        const userIdToTimesheets = {};
        for (const t of timesheets) {
            const uid = t.user_id.toString();
            if (!userIdToTimesheets[uid]) userIdToTimesheets[uid] = [];
            userIdToTimesheets[uid].push(t);
        }

        // ── 4. Employee users (to detect missing timesheets) ──
        const employeeUsers = await User.find({
            tenant_id: tenantId,
            role: 'EMPLOYEE',
            is_active: true,
            is_deleted: { $ne: true }
        }).lean();

        const employeeUserIds = new Set(employeeUsers.map(u => u._id.toString()));

        // ── 5. Compute per-user worked & billable hours ──
        let totalBillableHours = 0;
        let totalWorkedHours = 0;
        const userHours = {}; // userId → { worked, billable }

        for (const t of timesheets) {
            const uid = t.user_id.toString();
            if (!userHours[uid]) userHours[uid] = { worked: 0, billable: 0 };
            for (const e of t.entries) {
                userHours[uid].worked += e.worked_hours || 0;
                userHours[uid].billable += e.billable_hours || 0;
                totalBillableHours += e.billable_hours || 0;
                totalWorkedHours += e.worked_hours || 0;
            }
        }

        // ── 6. Core KPIs ──
        const submittedTimesheets = timesheets.filter(t => ['submitted', 'approved'].includes(t.status));
        const timesheetsSubmitted = submittedTimesheets.length;
        const pendingApprovals = timesheets.filter(t => t.status === 'submitted').length;

        // Submission rate: how many employee users have at least one submitted/approved timesheet
        const submittedUserIds = new Set(submittedTimesheets.map(t => t.user_id.toString()));
        const submissionRate = employeeUsers.length > 0
            ? Math.round((submittedUserIds.size / employeeUsers.length) * 100)
            : 0;

        const orgBillability = totalWorkedHours > 0
            ? Math.round((totalBillableHours / totalWorkedHours) * 100)
            : 0;

        // Overtime: employees who worked > 160h this month (approx 40h/week × 4 weeks)
        const overtimeMembers = Object.values(userHours).filter(h => h.worked > 160).length;

        // Missing timesheets: employee users with no timesheet at all this month
        const usersWithTimesheets = new Set(timesheets.map(t => t.user_id.toString()));
        const missingTimesheets = employeeUsers.filter(u => !usersWithTimesheets.has(u._id.toString())).length;

        // ── 7. Team-wise stats ──
        // Build email → employee mapping
        const emailToEmployee = {};
        const employees = await Employee.find({
            tenant_id: tenantId,
            is_active: true,
            is_deleted: { $ne: true }
        }).lean();
        for (const emp of employees) {
            emailToEmployee[emp.official_email] = emp;
        }

        // email → userId
        const emailToUserId = {};
        for (const u of employeeUsers) {
            emailToUserId[u.email] = u._id.toString();
        }

        // Group employees by team
        const teamMap = {}; // teamName → { members: Set<empId>, submittedUsers: Set<userId>, worked, billable }
        for (const emp of employees) {
            const teamName = emp.team_name || 'General';
            if (!teamMap[teamName]) {
                teamMap[teamName] = { members: new Set(), submittedUsers: new Set(), worked: 0, billable: 0 };
            }
            teamMap[teamName].members.add(emp._id.toString());

            const userId = emailToUserId[emp.official_email];
            if (userId) {
                const uTimesheets = userIdToTimesheets[userId] || [];
                for (const t of uTimesheets) {
                    if (['submitted', 'approved'].includes(t.status)) {
                        teamMap[teamName].submittedUsers.add(userId);
                    }
                    for (const e of t.entries) {
                        teamMap[teamName].worked += e.worked_hours || 0;
                        teamMap[teamName].billable += e.billable_hours || 0;
                    }
                }
            }
        }

        const teamWiseStats = Object.entries(teamMap).map(([teamName, data]) => ({
            teamName,
            members: data.members.size,
            submitted: data.submittedUsers.size,
            submissionRate: data.members.size > 0 ? Math.round((data.submittedUsers.size / data.members.size) * 100) : 0,
            billability: data.worked > 0 ? Math.round((data.billable / data.worked) * 100) : 0,
        })).sort((a, b) => b.members - a.members);

        // ── 8. Manager performance ──
        // Group mappings by manager
        const managerMap = {}; // managerId → { manager, employeeEmails: Set }
        for (const mapping of allMappings) {
            const mgr = mapping.manager_id;
            if (!mgr) continue;
            const mgrId = mgr._id.toString();
            if (!managerMap[mgrId]) {
                managerMap[mgrId] = { manager: mgr, employeeEmails: new Set() };
            }
            const emp = mapping.employee_id;
            if (emp?.official_email) {
                managerMap[mgrId].employeeEmails.add(emp.official_email);
            }
        }

        const managerPerformance = Object.entries(managerMap).map(([mgrId, data]) => {
            const { manager, employeeEmails } = data;
            const mgrUserIds = [...employeeEmails]
                .map(email => emailToUserId[email])
                .filter(Boolean);

            let pending = 0;
            let approvedCount = 0;
            let totalApprovalMs = 0;

            for (const uid of mgrUserIds) {
                const uTimesheets = userIdToTimesheets[uid] || [];
                for (const t of uTimesheets) {
                    if (t.status === 'submitted') pending++;
                    if (t.status === 'approved' && t.submitted_at && t.approved_at) {
                        totalApprovalMs += new Date(t.approved_at) - new Date(t.submitted_at);
                        approvedCount++;
                    }
                }
            }

            const avgApprovalHours = approvedCount > 0
                ? Math.round(totalApprovalMs / approvedCount / (1000 * 60 * 60))
                : null;

            // Get team name from manager's team_ids by finding employees in their team
            const teamNames = [...new Set(
                [...employeeEmails].map(email => emailToEmployee[email]?.team_name).filter(Boolean)
            )];

            return {
                managerId: mgrId,
                managerName: manager.full_name,
                teamName: teamNames.slice(0, 2).join('/') || 'General',
                pending,
                avgApprovalHours,
                allClear: pending === 0,
            };
        }).sort((a, b) => b.pending - a.pending);

        // ── 9. Non-compliant members ──
        const nonCompliant = [];
        for (const u of employeeUsers) {
            const uid = u._id.toString();
            const uTimesheets = userIdToTimesheets[uid] || [];
            const emp = emailToEmployee[u.email];
            if (!emp) continue;

            const mapping = allMappings.find(m => m.employee_id?._id?.toString() === emp._id.toString());
            const managerName = mapping?.manager_id?.full_name || 'Unassigned';

            if (uTimesheets.length === 0) {
                nonCompliant.push({
                    userId: uid,
                    name: emp.employee_name,
                    team: emp.team_name || 'General',
                    issue: 'Missing timesheet',
                    manager: managerName,
                    daysOverdue: now.getDate(),
                });
            } else {
                const anySubmitted = uTimesheets.some(t => ['submitted', 'approved'].includes(t.status));
                const anyDraft = uTimesheets.some(t => t.status === 'draft');
                if (!anySubmitted && anyDraft && now.getDate() > 20) {
                    nonCompliant.push({
                        userId: uid,
                        name: emp.employee_name,
                        team: emp.team_name || 'General',
                        issue: 'Timesheet not submitted',
                        manager: managerName,
                        daysOverdue: Math.max(1, now.getDate() - 20),
                    });
                }
            }
        }

        // ── 10. Alerts & anomalies ──
        const alerts = [];
        for (const u of employeeUsers) {
            const uid = u._id.toString();
            const emp = emailToEmployee[u.email];
            if (!emp) continue;

            const uTimesheets = userIdToTimesheets[uid] || [];
            const hours = userHours[uid];

            // No timesheet at all this month
            if (uTimesheets.length === 0 && now.getDate() > 3) {
                alerts.push({
                    type: 'missing',
                    severity: 'critical',
                    name: emp.employee_name,
                    team: emp.team_name || 'General',
                    message: `no timesheet submitted this ${now.getDate() > 10 ? 'month' : 'week'}`,
                });
                continue;
            }

            if (!hours) continue;

            // Under-hours: worked less than 80% of expected (40h/week × weeks in month)
            const weeksInMonth = Math.ceil(now.getDate() / 7);
            const expectedHours = weeksInMonth * 40;
            if (hours.worked > 0 && hours.worked < expectedHours * 0.8) {
                alerts.push({
                    type: 'under_hours',
                    severity: 'warning',
                    name: emp.employee_name,
                    team: emp.team_name || 'General',
                    message: `logged only ${Math.round(hours.worked)}h — below ${expectedHours}h threshold`,
                });
            }

            // Overtime: worked > 160h
            if (hours.worked > 160) {
                alerts.push({
                    type: 'overtime',
                    severity: 'info',
                    name: emp.employee_name,
                    team: emp.team_name || 'General',
                    message: `clocked ${Math.round(hours.worked)}h — overtime flagged`,
                });
            }

            // Pending approval too long (submitted but not approved, submitted_at > 48h ago)
            for (const t of uTimesheets) {
                if (t.status === 'submitted' && t.submitted_at) {
                    const hoursAgo = (now - new Date(t.submitted_at)) / (1000 * 60 * 60);
                    if (hoursAgo > 48) {
                        alerts.push({
                            type: 'pending_approval',
                            severity: 'warning',
                            name: emp.employee_name,
                            team: emp.team_name || 'General',
                            message: `timesheet pending manager approval for ${Math.round(hoursAgo)}h`,
                        });
                        break;
                    }
                }
            }
        }

        // High billability team (best performer)
        const bestTeam = teamWiseStats.reduce((best, t) => {
            return (!best || t.billability > best.billability) ? t : best;
        }, null);
        if (bestTeam && bestTeam.billability >= 90) {
            alerts.push({
                type: 'top_performer',
                severity: 'success',
                name: bestTeam.teamName,
                team: bestTeam.teamName,
                message: `team billability at ${bestTeam.billability}% — best this month`,
            });
        }

        res.json({
            success: true,
            data: {
                month,
                year,
                totalEmployees,
                timesheetsSubmitted,
                submissionRate,
                orgBillability,
                overtimeMembers,
                pendingApprovals,
                missingTimesheets,
                totalBillableHours: Math.round(totalBillableHours),
                totalWorkedHours: Math.round(totalWorkedHours),
                teamWiseStats,
                managerPerformance,
                nonCompliant: nonCompliant.slice(0, 15),
                alerts: alerts.slice(0, 10),
            }
        });
    } catch (err) {
        console.error('admin-stats error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── GET /api/dashboard/manager-stats ───────────────────────────────────────
router.get('/manager-stats', ...auth, authorize(['MANAGER']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // Get manager's team_ids (same logic as /team endpoint)
        const managerUser = await User.findById(req.user._id).select('team_ids full_name').lean();
        const teamIds = (managerUser?.team_ids || []).map(id => id.toString());

        // All mappings — filter to employees in this manager's teams
        const allMappings = await EmployeeManagerMapping.find({
            tenant_id: tenantId,
            is_deleted: { $ne: true }
        })
            .populate('employee_id', 'employee_name official_email unique_id designation team_id team_name')
            .lean();

        const teamIdSet = new Set(teamIds);
        const myMappings = allMappings.filter(m => {
            const empTeamId = m.employee_id?.team_id?.toString();
            return empTeamId && teamIdSet.has(empTeamId);
        });

        // Unique employees on this manager's teams
        const uniqueEmployeeEmails = [...new Set(
            myMappings.map(m => m.employee_id?.official_email).filter(Boolean)
        )];

        // Find corresponding User records
        const employeeUsers = await User.find({
            tenant_id: tenantId,
            email: { $in: uniqueEmployeeEmails },
            role: 'EMPLOYEE',
            is_deleted: { $ne: true }
        }).lean();

        const emailToUserId = {};
        for (const u of employeeUsers) emailToUserId[u.email] = u._id.toString();

        const userIds = employeeUsers.map(u => u._id);

        // Current month timesheets for team
        const timesheets = await Timesheet.find({
            tenant_id: tenantId,
            user_id: { $in: userIds },
            month,
            year
        }).lean();

        const userIdToTimesheets = {};
        for (const t of timesheets) {
            const uid = t.user_id.toString();
            if (!userIdToTimesheets[uid]) userIdToTimesheets[uid] = [];
            userIdToTimesheets[uid].push(t);
        }

        // ── Core KPIs ──
        const totalMembers = employeeUsers.length;
        const submittedCount = timesheets.filter(t => ['submitted', 'approved'].includes(t.status)).length;
        const pendingApproval = timesheets.filter(t => t.status === 'submitted').length;

        let totalBillable = 0;
        let totalWorked = 0;
        for (const t of timesheets) {
            for (const e of t.entries) {
                totalBillable += e.billable_hours || 0;
                totalWorked += e.worked_hours || 0;
            }
        }
        const teamBillability = totalWorked > 0 ? Math.round((totalBillable / totalWorked) * 100) : 0;

        // Missing this month
        const usersWithTimesheets = new Set(timesheets.map(t => t.user_id.toString()));
        const missingCount = employeeUsers.filter(u => !usersWithTimesheets.has(u._id.toString())).length;

        // Oldest pending approval
        const pendingTimesheets = timesheets
            .filter(t => t.status === 'submitted' && t.submitted_at)
            .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
        const oldestPendingHours = pendingTimesheets.length > 0
            ? Math.round((now - new Date(pendingTimesheets[0].submitted_at)) / (1000 * 60 * 60))
            : null;

        // ── Approval queue ──
        // Build email → employee record
        const emailToEmployee = {};
        for (const m of myMappings) {
            const emp = m.employee_id;
            if (emp?.official_email) emailToEmployee[emp.official_email] = emp;
        }

        const approvalQueue = pendingTimesheets.map(t => {
            const uid = t.user_id.toString();
            const user = employeeUsers.find(u => u._id.toString() === uid);
            const emp = user ? emailToEmployee[user.email] : null;

            let totalHours = 0;
            for (const e of t.entries) totalHours += e.worked_hours || 0;

            // Period: first and last entry date
            const dates = t.entries.map(e => new Date(e.date)).filter(d => !isNaN(d));
            const minDate = dates.length > 0 ? dates.reduce((a, b) => a < b ? a : b) : null;
            const maxDate = dates.length > 0 ? dates.reduce((a, b) => a > b ? a : b) : null;

            return {
                timesheetId: t._id,
                employeeName: emp?.employee_name || user?.full_name || 'Unknown',
                employeeInitials: (emp?.employee_name || user?.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
                designation: emp?.designation || '',
                totalHours: Math.round(totalHours),
                submittedAt: t.submitted_at,
                periodStart: minDate,
                periodEnd: maxDate,
            };
        }).slice(0, 10);

        // ── Member-wise status ──
        const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const memberWiseStatus = employeeUsers.map(u => {
            const uid = u._id.toString();
            const emp = emailToEmployee[u.email];
            const uTimesheets = userIdToTimesheets[uid] || [];

            // Combine all entries across timesheets
            const allEntries = uTimesheets.flatMap(t => t.entries);

            // Get this week's entries (Mon–Fri of current week)
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
            weekStart.setHours(0, 0, 0, 0);

            const weekDays = { Mon: null, Tue: null, Wed: null, Thu: null, Fri: null };
            for (const entry of allEntries) {
                const d = new Date(entry.date);
                const dayName = DAY_NAMES[d.getDay()];
                if (['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(dayName) && d >= weekStart) {
                    const wh = entry.worked_hours || 0;
                    weekDays[dayName] = (weekDays[dayName] || 0) + wh;
                }
            }

            let totalHours = 0;
            let totalBillableH = 0;
            let totalWorkedH = 0;
            for (const t of uTimesheets) {
                for (const e of t.entries) {
                    totalHours += e.worked_hours || 0;
                    totalBillableH += e.billable_hours || 0;
                    totalWorkedH += e.worked_hours || 0;
                }
            }

            const billabilityPct = totalWorkedH > 0 ? Math.round((totalBillableH / totalWorkedH) * 100) : 0;

            // Status from latest timesheet
            const latestTs = uTimesheets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
            const status = latestTs?.status || 'not_started';

            return {
                userId: uid,
                name: emp?.employee_name || u.full_name,
                initials: (emp?.employee_name || u.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
                designation: emp?.designation || '',
                weekDays,
                totalHours: Math.round(totalHours),
                billability: billabilityPct,
                status,
            };
        });

        // ── Project-wise hours ──
        const projectHoursMap = {};
        for (const m of myMappings) {
            const projectName = m.project_name || 'Unknown';
            if (!projectHoursMap[projectName]) projectHoursMap[projectName] = 0;
        }

        // Sum hours per project (from timesheets that have project_id)
        for (const t of timesheets) {
            let projectName = 'General';
            if (t.project_id) {
                const mapping = myMappings.find(m => {
                    try {
                        return m.project_id?.toString() === t.project_id?.toString();
                    } catch { return false; }
                });
                if (mapping?.project_name) projectName = mapping.project_name;
            }
            let hours = 0;
            for (const e of t.entries) hours += e.billable_hours || 0;
            projectHoursMap[projectName] = (projectHoursMap[projectName] || 0) + hours;
        }

        const projectWiseHours = Object.entries(projectHoursMap)
            .filter(([, h]) => h > 0)
            .map(([name, hours]) => ({ name, hours: Math.round(hours) }))
            .sort((a, b) => b.hours - a.hours)
            .slice(0, 6);

        // ── Member hours overview (for bar chart) ──
        const memberHoursOverview = memberWiseStatus.map(m => ({
            name: m.name,
            hours: m.totalHours,
            isOvertime: m.totalHours > 160,
        })).filter(m => m.hours > 0).sort((a, b) => b.hours - a.hours);

        res.json({
            success: true,
            data: {
                month,
                year,
                totalMembers,
                submittedCount,
                pendingApproval,
                teamBillability,
                missingCount,
                oldestPendingHours,
                totalBillableHours: Math.round(totalBillable),
                approvalQueue,
                memberWiseStatus,
                projectWiseHours,
                memberHoursOverview,
            }
        });
    } catch (err) {
        console.error('manager-stats error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

export default router;
