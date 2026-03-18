/**
 * Timesheet Routes
 * - EMPLOYEE: view/create/edit own timesheet, submit
 * - MANAGER: view team members' timesheets (read-only)
 * - ADMINISTRATOR: view all timesheets
 */
import express from 'express';
import mongoose from 'mongoose';
import { authenticate, checkActive, authorize } from '../middlewares/auth.js';
import Timesheet from '../models/timesheet/Timesheet.js';
import Notification from '../models/timesheet/Notification.js';
import ProjectSubmission from '../models/timesheet/ProjectSubmission.js';
import EmployeeManagerMapping from '../models/timesheet/EmployeeManagerMapping.js';
import Employee from '../models/users/Employee.js';
import User from '../models/users/User.js';

const router = express.Router();
const auth = [authenticate, checkActive];

// ─── Helper: find Employee record for the logged-in EMPLOYEE user ───────────
async function getEmployeeForUser(user) {
    // Match by official_email against the user's email
    return Employee.findOne({
        tenant_id: user.tenant_id,
        official_email: user.email,
        is_active: true
    }).lean();
}

// ─── GET /api/timesheet?month=3&year=2026&projectId=xxx — employee's own timesheet ────────
router.get('/', ...auth, authorize(['EMPLOYEE']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const month = parseInt(req.query.month);
        const year = parseInt(req.query.year);
        const projectId = req.query.projectId || null;

        if (!month || !year || month < 1 || month > 12 || year < 2000 || year > 2100) {
            return res.status(400).json({ error: 'Valid month (1-12) and year (2000-2100) are required' });
        }

        const employee = await getEmployeeForUser(req.user);
        if (!employee) {
            return res.status(404).json({ error: 'Employee record not found for this user' });
        }

        let projectObjectId = null;
        if (projectId) {
            if (!mongoose.Types.ObjectId.isValid(projectId)) {
                return res.status(400).json({ error: 'Invalid projectId' });
            }
            projectObjectId = new mongoose.Types.ObjectId(projectId);
        }

        const query = {
            tenant_id: tenantId,
            user_id: req.user._id,
            month,
            year,
            project_id: projectObjectId
        };

        const timesheet = await Timesheet.findOne(query).lean();

        res.json({
            success: true,
            data: timesheet || null,
            employee: {
                _id: employee._id,
                employee_name: employee.employee_name,
                unique_id: employee.unique_id,
                designation: employee.designation,
                official_email: employee.official_email
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── GET /api/timesheet/my-stats — employee dashboard stats ─────────────────
router.get('/my-stats', ...auth, authorize(['EMPLOYEE']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // Use same internal lookup as /my-projects: find employee by official_email, then get assigned mappings
        // We replicate the exact logic from employeeMapping.js /my-projects to guarantee consistency
        const empForMapping = await Employee.findOne({
            tenant_id: tenantId,
            official_email: req.user.email,
            is_active: true
        }).sort({ createdAt: 1 }).lean(); // sort ascending — same first record as my-projects
        const assignedMappings = empForMapping
            ? await EmployeeManagerMapping.find({
                tenant_id: tenantId,
                employee_id: empForMapping._id,
                is_deleted: { $ne: true },
                is_active: true
            }).lean()
            : [];
        const totalProjects = assignedMappings.length;

        // Single-pass aggregation over all timesheets
        const all = await Timesheet.find({ tenant_id: tenantId, user_id: req.user._id }).lean();

        let submitted = 0, drafts = 0;
        let currentBillable = 0, currentWorking = 0, totalBillable = 0;

        for (const t of all) {
            if (t.status === 'submitted' || t.status === 'approved') submitted++;
            else if (t.status === 'draft' || t.status === 'rejected') drafts++;

            const isCurrent = t.month === currentMonth && t.year === currentYear;
            for (const e of t.entries) {
                const bh = e.billable_hours || 0;
                totalBillable += bh;
                if (isCurrent) {
                    currentBillable += bh;
                    if (e.status === 'Working') currentWorking++;
                }
            }
        }

        res.json({
            success: true,
            data: {
                totalProjects,
                submitted,
                drafts,
                currentBillable,
                currentWorking,
                totalBillable,
                currentMonth,
                currentYear,
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── POST /api/timesheet — create new timesheet (draft) ─────────────────────
router.post('/', ...auth, authorize(['EMPLOYEE']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const { month, year, entries, project_id } = req.body;

        if (!month || !year) {
            return res.status(400).json({ error: 'month and year are required' });
        }

        const employee = await getEmployeeForUser(req.user);
        if (!employee) {
            return res.status(404).json({ error: 'Employee record not found for this user' });
        }

        const projectObjectId = project_id ? new mongoose.Types.ObjectId(project_id) : null;

        const existing = await Timesheet.findOne({
            tenant_id: tenantId,
            user_id: req.user._id,
            project_id: projectObjectId,
            month,
            year
        });
        if (existing) {
            return res.status(409).json({ error: 'Timesheet already exists for this month. Use PUT to update.' });
        }

        const timesheet = await Timesheet.create({
            tenant_id: tenantId,
            employee_id: employee._id,
            user_id: req.user._id,
            project_id: projectObjectId,
            month,
            year,
            entries: entries || [],
            status: 'draft'
        });

        res.status(201).json({ success: true, data: timesheet });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── PUT /api/timesheet/:id — update entries (draft only) ───────────────────
router.put('/:id', ...auth, authorize(['EMPLOYEE']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const { id } = req.params;
        const { entries } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid timesheet ID' });
        }

        const timesheet = await Timesheet.findOne({
            _id: id,
            tenant_id: tenantId,
            user_id: req.user._id
        });

        if (!timesheet) {
            return res.status(404).json({ error: 'Timesheet not found' });
        }

        if (timesheet.status === 'submitted' || timesheet.status === 'approved') {
            return res.status(403).json({ error: 'Cannot edit a submitted or approved timesheet' });
        }

        timesheet.entries = entries || [];
        await timesheet.save();

        res.json({ success: true, data: timesheet });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── PUT /api/timesheet/:id/submit — submit timesheet (locks it) ────────────
router.put('/:id/submit', ...auth, authorize(['EMPLOYEE']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid timesheet ID' });
        }

        const timesheet = await Timesheet.findOne({
            _id: id,
            tenant_id: tenantId,
            user_id: req.user._id
        });

        if (!timesheet) {
            return res.status(404).json({ error: 'Timesheet not found' });
        }

        if (timesheet.status === 'submitted') {
            return res.status(400).json({ error: 'Timesheet already submitted' });
        }

        if (!timesheet.entries || timesheet.entries.length === 0) {
            return res.status(400).json({ error: 'Cannot submit an empty timesheet' });
        }

        // Validate working days have task description and billable hours > 0
        const errors = [];
        let emptyTaskCount = 0;
        let zeroBillableCount = 0;
        let overMaxHours = 0;

        for (const entry of timesheet.entries) {
            if (entry.status === 'Working' || entry.status === 'Extra Working') {
                if (!entry.tasks || entry.tasks.filter(t => t.trim()).length === 0) emptyTaskCount++;
                if (!entry.billable_hours || entry.billable_hours <= 0) zeroBillableCount++;
            }
            if (entry.billable_hours > 24) overMaxHours++;
        }

        if (emptyTaskCount > 0) errors.push(`${emptyTaskCount} working day(s) have no task description`);
        if (zeroBillableCount > 0) errors.push(`${zeroBillableCount} working day(s) have zero billable hours`);
        if (overMaxHours > 0) errors.push(`${overMaxHours} entry(ies) exceed 24 billable hours`);

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join('. ') });
        }

        timesheet.status = 'submitted';
        timesheet.submitted_at = new Date();
        await timesheet.save();

        // ── Notify managers ────────────────────────────────────────────────
        try {
            const employee = await Employee.findOne({ tenant_id: tenantId, official_email: req.user.email, is_active: true }).lean();
            const empName = employee?.employee_name || req.user.full_name || req.user.email;

            // Find manager(s) via team_id
            if (employee?.team_id) {
                const managers = await User.find({
                    tenant_id: tenantId,
                    role: 'MANAGER',
                    team_ids: employee.team_id,
                    is_deleted: { $ne: true }
                }).select('_id').lean();

                const MONTH_NAMES = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

                for (const mgr of managers) {
                    await Notification.create({
                        tenant_id: tenantId,
                        recipient_id: mgr._id,
                        type: 'timesheet_submitted',
                        title: 'Timesheet Submitted',
                        message: `${empName} submitted their timesheet for ${MONTH_NAMES[timesheet.month]} ${timesheet.year}`,
                        timesheet_id: timesheet._id,
                        metadata: {
                            employee_id: employee._id,
                            employee_name: empName,
                            project_id: timesheet.project_id,
                            month: timesheet.month,
                            year: timesheet.year,
                        }
                    });
                }
            }
        } catch (_notifErr) { /* notification failure should not block submit */ }

        res.json({ success: true, data: timesheet, message: 'Timesheet submitted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── PUT /api/timesheet/:id/recall — recall a submitted timesheet back to draft
router.put('/:id/recall', ...auth, authorize(['EMPLOYEE']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid timesheet ID' });
        }

        const timesheet = await Timesheet.findOne({
            _id: id,
            tenant_id: tenantId,
            user_id: req.user._id
        });

        if (!timesheet) {
            return res.status(404).json({ error: 'Timesheet not found' });
        }

        if (timesheet.status === 'draft') {
            return res.status(400).json({ error: 'Timesheet is already a draft' });
        }
        if (timesheet.status === 'approved') {
            return res.status(400).json({ error: 'Cannot recall an approved timesheet' });
        }

        timesheet.status = 'draft';
        timesheet.submitted_at = null;
        timesheet.approved_by = null;
        timesheet.approved_at = null;
        timesheet.rejection_reason = null;
        await timesheet.save();

        res.json({ success: true, data: timesheet, message: 'Timesheet recalled to draft' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── PUT /api/timesheet/:id/approve — manager approves a submitted timesheet ──
router.put('/:id/approve', ...auth, authorize(['MANAGER', 'ADMINISTRATOR']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid timesheet ID' });
        }

        const timesheet = await Timesheet.findOne({ _id: id, tenant_id: tenantId });
        if (!timesheet) {
            return res.status(404).json({ error: 'Timesheet not found' });
        }

        if (timesheet.status !== 'submitted') {
            return res.status(400).json({ error: 'Only submitted timesheets can be approved' });
        }

        // Verify manager has access to this employee (via team_ids)
        if (req.user.role === 'MANAGER') {
            const empUser = await User.findOne({ _id: timesheet.user_id, tenant_id: tenantId }).lean();
            if (empUser) {
                const emp = await Employee.findOne({ tenant_id: tenantId, official_email: empUser.email, is_active: true }).lean();
                if (emp) {
                    const manager = await User.findById(req.user._id).select('team_ids').lean();
                    const teamIdSet = new Set((manager?.team_ids || []).map(tid => tid.toString()));
                    const empTeamId = emp.team_id?.toString();
                    if (!empTeamId || !teamIdSet.has(empTeamId)) {
                        return res.status(403).json({ error: 'Access denied: employee not under your management' });
                    }
                }
            }
        }

        timesheet.status = 'approved';
        timesheet.approved_by = req.user._id;
        timesheet.approved_at = new Date();
        timesheet.rejection_reason = null;
        await timesheet.save();

        // Notify the employee
        try {
            const empUser = await User.findOne({ _id: timesheet.user_id, tenant_id: tenantId }).lean();
            const employee = empUser ? await Employee.findOne({ tenant_id: tenantId, official_email: empUser.email }).lean() : null;
            const MONTH_NAMES = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
            await Notification.create({
                tenant_id: tenantId,
                recipient_id: timesheet.user_id,
                type: 'timesheet_approved',
                title: 'Timesheet Approved',
                message: `Your timesheet for ${MONTH_NAMES[timesheet.month]} ${timesheet.year} has been approved by ${req.user.full_name || req.user.email}`,
                timesheet_id: timesheet._id,
                metadata: {
                    employee_id: employee?._id || null,
                    employee_name: employee?.employee_name || null,
                    project_id: timesheet.project_id,
                    month: timesheet.month,
                    year: timesheet.year,
                }
            });
        } catch (_notifErr) { /* notification failure should not block approve */ }

        res.json({ success: true, data: timesheet, message: 'Timesheet approved' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── PUT /api/timesheet/:id/reject — manager rejects a submitted timesheet ───
router.put('/:id/reject', ...auth, authorize(['MANAGER', 'ADMINISTRATOR']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const { id } = req.params;
        const { reason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid timesheet ID' });
        }

        if (!reason || !reason.trim()) {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }

        const timesheet = await Timesheet.findOne({ _id: id, tenant_id: tenantId });
        if (!timesheet) {
            return res.status(404).json({ error: 'Timesheet not found' });
        }

        if (timesheet.status !== 'submitted') {
            return res.status(400).json({ error: 'Only submitted timesheets can be rejected' });
        }

        // Verify manager has access
        if (req.user.role === 'MANAGER') {
            const empUser = await User.findOne({ _id: timesheet.user_id, tenant_id: tenantId }).lean();
            if (empUser) {
                const emp = await Employee.findOne({ tenant_id: tenantId, official_email: empUser.email, is_active: true }).lean();
                if (emp) {
                    const manager = await User.findById(req.user._id).select('team_ids').lean();
                    const teamIdSet = new Set((manager?.team_ids || []).map(tid => tid.toString()));
                    const empTeamId = emp.team_id?.toString();
                    if (!empTeamId || !teamIdSet.has(empTeamId)) {
                        return res.status(403).json({ error: 'Access denied: employee not under your management' });
                    }
                }
            }
        }

        timesheet.status = 'rejected';
        timesheet.rejection_reason = reason.trim();
        timesheet.approved_by = req.user._id;
        timesheet.approved_at = new Date();
        await timesheet.save();

        // Notify the employee
        try {
            const empUser = await User.findOne({ _id: timesheet.user_id, tenant_id: tenantId }).lean();
            const employee = empUser ? await Employee.findOne({ tenant_id: tenantId, official_email: empUser.email }).lean() : null;
            const MONTH_NAMES = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
            await Notification.create({
                tenant_id: tenantId,
                recipient_id: timesheet.user_id,
                type: 'timesheet_rejected',
                title: 'Timesheet Rejected',
                message: `Your timesheet for ${MONTH_NAMES[timesheet.month]} ${timesheet.year} was rejected: ${reason.trim()}`,
                timesheet_id: timesheet._id,
                metadata: {
                    employee_id: employee?._id || null,
                    employee_name: employee?.employee_name || null,
                    project_id: timesheet.project_id,
                    month: timesheet.month,
                    year: timesheet.year,
                }
            });
        } catch (_notifErr) { /* notification failure should not block reject */ }

        res.json({ success: true, data: timesheet, message: 'Timesheet rejected' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── GET /api/timesheet/team?month=3&year=2026 — manager sees mapped employees
router.get('/team', ...auth, authorize(['MANAGER', 'ADMINISTRATOR']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const month = parseInt(req.query.month);
        const year = parseInt(req.query.year);

        if (!month || !year) {
            return res.status(400).json({ error: 'month and year are required' });
        }

        // For MANAGER: find employees in the manager's teams (via team_ids).
        // manager_id on mappings may be null (synced from Streamline), so we
        // use the team_id on Employee records to determine which employees
        // belong to this manager.
        let mappings;
        if (req.user.role === 'MANAGER') {
            const manager = await User.findById(req.user._id).select('team_ids').lean();
            const teamIds = (manager?.team_ids || []).map(id => id.toString());

            // Get all mappings, then filter to employees in manager's teams
            const allMappings = await EmployeeManagerMapping.find({
                tenant_id: tenantId,
                is_deleted: { $ne: true }
            })
                .populate('employee_id', 'employee_name official_email unique_id designation department_id team_id')
                .lean();

            const teamIdSet = new Set(teamIds);
            mappings = allMappings.filter(m => {
                const empTeamId = m.employee_id?.team_id?.toString();
                return empTeamId && teamIdSet.has(empTeamId);
            });
        } else {
            mappings = await EmployeeManagerMapping.find({
                tenant_id: tenantId,
                is_deleted: { $ne: true }
            })
                .populate('employee_id', 'employee_name official_email unique_id designation department_id team_id')
                .populate('manager_id', 'full_name email')
                .lean();
        }

        // Gather employee IDs to fetch their timesheets
        const employeeIds = mappings.map(m => m.employee_id?._id).filter(Boolean);

        // Find matching User records for these employees (by official_email)
        const employeeEmails = mappings
            .map(m => m.employee_id?.official_email)
            .filter(Boolean);

        const employeeUsers = await User.find({
            tenant_id: tenantId,
            email: { $in: employeeEmails },
            role: 'EMPLOYEE',
            is_deleted: { $ne: true }
        }).lean();

        const emailToUserId = {};
        employeeUsers.forEach(u => { emailToUserId[u.email] = u._id; });

        // Fetch timesheets for the month
        const userIds = Object.values(emailToUserId);
        const timesheets = await Timesheet.find({
            tenant_id: tenantId,
            user_id: { $in: userIds },
            month,
            year
        }).lean();

        // Build lookup by userId+projectId for per-project matching, with fallback to userId-only
        const userProjectToTimesheet = {};
        const userIdToTimesheet = {};
        timesheets.forEach(ts => {
            const uid = ts.user_id.toString();
            const pid = ts.project_id ? ts.project_id.toString() : null;
            if (pid) userProjectToTimesheet[`${uid}:${pid}`] = ts;
            // Keep first (or latest submitted) as fallback for userId-only lookup
            if (!userIdToTimesheet[uid] || ts.status === 'submitted') userIdToTimesheet[uid] = ts;
        });

        // Build response
        const team = mappings.map(mapping => {
            const emp = mapping.employee_id;
            if (!emp) return null;
            const userId = emailToUserId[emp.official_email];
            const uid = userId ? userId.toString() : null;
            const pid = mapping.project_id ? mapping.project_id.toString() : null;
            // Try per-project match first, then fallback
            const timesheet = uid
                ? (pid ? userProjectToTimesheet[`${uid}:${pid}`] : null) || userIdToTimesheet[uid] || null
                : null;
            return {
                mapping_id: mapping._id,
                employee_id: emp._id,
                employee_name: emp.employee_name,
                official_email: emp.official_email,
                unique_id: emp.unique_id,
                designation: emp.designation,
                department_id: emp.department_id,
                manager_id: mapping.manager_id,
                timesheet_id: timesheet?._id || null,
                status: timesheet?.status || 'not_started',
                submitted_at: timesheet?.submitted_at || null,
                entries_count: timesheet?.entries?.length || 0,
                total_worked: timesheet?.entries?.reduce((s, e) => s + e.worked_hours, 0) || 0,
                total_billable: timesheet?.entries?.reduce((s, e) => s + e.billable_hours, 0) || 0
            };
        }).filter(Boolean);

        res.json({ success: true, data: team });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── GET /api/timesheet/project/:projectId?month=3&year=2026 — manager views all employees in a project
router.get('/project/:projectId', ...auth, authorize(['MANAGER', 'ADMINISTRATOR']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const { projectId } = req.params;
        const month = parseInt(req.query.month);
        const year = parseInt(req.query.year);

        if (!month || !year || month < 1 || month > 12) {
            return res.status(400).json({ error: 'Valid month and year are required' });
        }

        // Find all mappings for this project.
        // For managers: filter by team_ids (manager_id on mappings may be null
        // when synced from Streamline, so we match via employee team_id).
        const projectMappings = await EmployeeManagerMapping.find({
            tenant_id: tenantId,
            project_id: projectId,
            is_deleted: { $ne: true }
        })
            .populate('employee_id', 'employee_name official_email unique_id designation team_id')
            .lean();

        const firstMapping = projectMappings[0];
        const projectInfo = firstMapping ? {
            project_id: projectId,
            project_name: firstMapping.project_name || '',
            project_code: firstMapping.project_code || '',
            client_id: firstMapping.client_id || null,
            client_name: firstMapping.client_name || ''
        } : { project_id: projectId, project_name: '', project_code: '', client_id: null, client_name: '' };

        let allMappings;
        if (req.user.role === 'MANAGER') {
            const manager = await User.findById(req.user._id).select('team_ids').lean();
            const teamIdSet = new Set((manager?.team_ids || []).map(id => id.toString()));
            allMappings = projectMappings.filter(m => {
                const empTeamId = m.employee_id?.team_id?.toString();
                return empTeamId && teamIdSet.has(empTeamId);
            });
        } else {
            allMappings = projectMappings;
        }

        const employeeEmails = allMappings.map(m => m.employee_id?.official_email).filter(Boolean);

        const employeeUsers = await User.find({
            tenant_id: tenantId,
            email: { $in: employeeEmails },
            role: 'EMPLOYEE',
            is_deleted: { $ne: true }
        }).lean();

        const emailToUserId = {};
        employeeUsers.forEach(u => { emailToUserId[u.email] = u._id; });

        const projectObjectId = mongoose.Types.ObjectId.isValid(projectId)
            ? new mongoose.Types.ObjectId(projectId)
            : null;

        const userIds = Object.values(emailToUserId);
        const timesheetQuery = {
            tenant_id: tenantId,
            user_id: { $in: userIds },
            month,
            year
        };
        // Filter by project_id so we find the correct per-project timesheet
        if (projectObjectId) timesheetQuery.project_id = projectObjectId;

        const timesheets = await Timesheet.find(timesheetQuery).lean();

        const userIdToTimesheet = {};
        timesheets.forEach(ts => { userIdToTimesheet[ts.user_id.toString()] = ts; });

        const team = allMappings.map(mapping => {
            const emp = mapping.employee_id;
            if (!emp) return null;
            const userId = emailToUserId[emp.official_email];
            const timesheet = userId ? userIdToTimesheet[userId.toString()] : null;
            return {
                employee_id: emp._id,
                employee_name: emp.employee_name,
                official_email: emp.official_email,
                unique_id: emp.unique_id,
                designation: emp.designation,
                timesheet_id: timesheet?._id || null,
                status: timesheet?.status || 'not_started',
                submitted_at: timesheet?.submitted_at || null,
                entries_count: timesheet?.entries?.length || 0,
                total_worked: timesheet?.entries?.reduce((s, e) => s + (e.worked_hours || 0), 0) || 0,
                total_billable: timesheet?.entries?.reduce((s, e) => s + (e.billable_hours || 0), 0) || 0
            };
        }).filter(Boolean);

        res.json({ success: true, project: projectInfo, data: team });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── GET /api/timesheet/employee/:employeeId?month=3&year=2026 — manager views a specific employee's timesheet
router.get('/employee/:employeeId', ...auth, authorize(['MANAGER', 'ADMINISTRATOR']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const { employeeId } = req.params;
        const month = parseInt(req.query.month);
        const year = parseInt(req.query.year);

        if (!mongoose.Types.ObjectId.isValid(employeeId)) {
            return res.status(400).json({ error: 'Invalid employee ID' });
        }
        if (!month || !year) {
            return res.status(400).json({ error: 'month and year are required' });
        }

        // Verify manager has access to this employee (via team_ids, since
        // manager_id on mappings may be null when synced from Streamline)
        if (req.user.role === 'MANAGER') {
            const manager = await User.findById(req.user._id).select('team_ids').lean();
            const teamIdSet = new Set((manager?.team_ids || []).map(id => id.toString()));
            const emp = await Employee.findById(employeeId).select('team_id').lean();
            const empTeamId = emp?.team_id?.toString();
            if (!empTeamId || !teamIdSet.has(empTeamId)) {
                return res.status(403).json({ error: 'Access denied: employee not under your management' });
            }
        }

        const employee = await Employee.findOne({
            _id: employeeId,
            tenant_id: tenantId
        }).lean();

        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        // Find the EMPLOYEE user linked to this employee
        const empUser = await User.findOne({
            tenant_id: tenantId,
            email: employee.official_email,
            role: 'EMPLOYEE',
            is_deleted: { $ne: true }
        }).lean();

        if (!empUser) {
            return res.json({
                success: true,
                employee,
                data: null // No timesheet — employee hasn't logged in yet
            });
        }

        const tsQuery = {
            tenant_id: tenantId,
            user_id: empUser._id,
            month,
            year
        };
        // Support optional project_id filter so manager sees the correct per-project timesheet
        const projectId = req.query.projectId || null;
        if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
            tsQuery.project_id = new mongoose.Types.ObjectId(projectId);
        }

        const timesheet = await Timesheet.findOne(tsQuery).lean();

        res.json({ success: true, employee, data: timesheet || null });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── POST /api/timesheet/project/:projectId/submit-project — manager submits project to admin
router.post('/project/:projectId/submit-project', ...auth, authorize(['MANAGER']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const { projectId } = req.params;
        const { month, year, project_name, project_code, client_id, client_name } = req.body;

        if (!month || !year) {
            return res.status(400).json({ error: 'month and year are required' });
        }

        // Check if already submitted
        const existing = await ProjectSubmission.findOne({
            tenant_id: tenantId, project_id: projectId, month, year
        });
        if (existing) {
            return res.status(400).json({ error: 'Project already submitted for this month' });
        }

        // Get all team members for this project (same logic as GET /project/:projectId)
        const projectMappings = await EmployeeManagerMapping.find({
            tenant_id: tenantId, project_id: projectId, is_deleted: { $ne: true }
        }).populate('employee_id', 'employee_name official_email team_id').lean();

        // Filter by manager's teams
        const manager = await User.findById(req.user._id).select('team_ids').lean();
        const teamIdSet = new Set((manager?.team_ids || []).map(id => id.toString()));
        const mappings = projectMappings.filter(m => {
            const empTeamId = m.employee_id?.team_id?.toString();
            return empTeamId && teamIdSet.has(empTeamId);
        });

        if (mappings.length === 0) {
            return res.status(400).json({ error: 'No employees found for this project' });
        }

        // Get timesheets for all employees
        const employeeEmails = mappings.map(m => m.employee_id?.official_email).filter(Boolean);
        const employeeUsers = await User.find({
            tenant_id: tenantId, email: { $in: employeeEmails }, role: 'EMPLOYEE', is_deleted: { $ne: true }
        }).lean();
        const userIds = employeeUsers.map(u => u._id);

        const projectObjectId = mongoose.Types.ObjectId.isValid(projectId)
            ? new mongoose.Types.ObjectId(projectId) : null;
        const tsQuery = { tenant_id: tenantId, user_id: { $in: userIds }, month, year };
        if (projectObjectId) tsQuery.project_id = projectObjectId;

        const timesheets = await Timesheet.find(tsQuery).lean();

        // Validate ALL timesheets are approved
        const notApproved = [];
        const userIdToTs = {};
        timesheets.forEach(ts => { userIdToTs[ts.user_id.toString()] = ts; });

        let totalBillable = 0;
        for (const empUser of employeeUsers) {
            const ts = userIdToTs[empUser._id.toString()];
            if (!ts || ts.status !== 'approved') {
                const emp = mappings.find(m => m.employee_id?.official_email === empUser.email);
                notApproved.push(emp?.employee_id?.employee_name || empUser.email);
            } else {
                totalBillable += ts.entries?.reduce((s, e) => s + (e.billable_hours || 0), 0) || 0;
            }
        }
        // Also check employees without user accounts
        for (const m of mappings) {
            const hasUser = employeeUsers.some(u => u.email === m.employee_id?.official_email);
            if (!hasUser) {
                notApproved.push(m.employee_id?.employee_name || 'Unknown');
            }
        }

        if (notApproved.length > 0) {
            return res.status(400).json({
                error: `Cannot submit: ${notApproved.length} employee(s) not approved`,
                employees: notApproved
            });
        }

        const MONTH_NAMES = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

        const submission = await ProjectSubmission.create({
            tenant_id: tenantId,
            project_id: projectId,
            project_name: project_name || '',
            project_code: project_code || '',
            client_id: client_id || null,
            client_name: client_name || '',
            month,
            year,
            status: 'submitted',
            submitted_by: req.user._id,
            submitted_at: new Date(),
            total_employees: mappings.length,
            total_billable_hours: totalBillable,
        });

        // Notify all admins
        try {
            const admins = await User.find({
                tenant_id: tenantId, role: 'ADMINISTRATOR', is_deleted: { $ne: true }
            }).select('_id').lean();

            for (const admin of admins) {
                await Notification.create({
                    tenant_id: tenantId,
                    recipient_id: admin._id,
                    type: 'project_submitted',
                    title: 'Project Submitted',
                    message: `${req.user.full_name || req.user.email} submitted ${project_name || 'project'} for ${MONTH_NAMES[month]} ${year}`,
                    metadata: {
                        project_id: projectId,
                        project_name: project_name || '',
                        month,
                        year,
                    }
                });
            }
        } catch (_notifErr) { /* notification failure should not block */ }

        res.status(201).json({ success: true, data: submission });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ error: 'Project already submitted for this month' });
        }
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── GET /api/timesheet/project/:projectId/submission?month=X&year=Y — check submission status
router.get('/project/:projectId/submission', ...auth, authorize(['MANAGER', 'ADMINISTRATOR']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const { projectId } = req.params;
        const month = parseInt(req.query.month);
        const year = parseInt(req.query.year);

        if (!month || !year) {
            return res.status(400).json({ error: 'month and year are required' });
        }

        const submission = await ProjectSubmission.findOne({
            tenant_id: tenantId, project_id: projectId, month, year
        }).populate('submitted_by', 'full_name email').lean();

        res.json({ success: true, data: submission || null });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── GET /api/timesheet/project-submissions?month=X&year=Y — admin lists all project submissions
router.get('/project-submissions', ...auth, authorize(['ADMINISTRATOR']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const query = { tenant_id: tenantId };
        if (req.query.month) query.month = parseInt(req.query.month);
        if (req.query.year) query.year = parseInt(req.query.year);

        const submissions = await ProjectSubmission.find(query)
            .populate('submitted_by', 'full_name email')
            .sort({ submitted_at: -1 })
            .lean();

        res.json({ success: true, data: submissions });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── PUT /api/timesheet/:id/request-correction — employee requests correction on approved timesheet
router.put('/:id/request-correction', ...auth, authorize(['EMPLOYEE']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const { id } = req.params;
        const { reason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid timesheet ID' });
        }
        if (!reason || !reason.trim()) {
            return res.status(400).json({ error: 'Correction reason is required' });
        }

        const timesheet = await Timesheet.findOne({ _id: id, tenant_id: tenantId, user_id: req.user._id });
        if (!timesheet) {
            return res.status(404).json({ error: 'Timesheet not found' });
        }
        if (timesheet.status !== 'approved') {
            return res.status(400).json({ error: 'Correction can only be requested for approved timesheets' });
        }
        if (timesheet.correction_request?.status === 'pending') {
            return res.status(400).json({ error: 'A correction request is already pending' });
        }

        timesheet.correction_request = {
            status: 'pending',
            reason: reason.trim(),
            requested_at: new Date(),
            requested_by: req.user._id
        };
        await timesheet.save();

        // Notify managers
        try {
            const employee = await Employee.findOne({ tenant_id: tenantId, official_email: req.user.email, is_active: true }).lean();
            const empName = employee?.employee_name || req.user.full_name || req.user.email;
            const MONTH_NAMES = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

            if (employee?.team_id) {
                const managers = await User.find({
                    tenant_id: tenantId, role: 'MANAGER', team_ids: employee.team_id, is_deleted: { $ne: true }
                }).select('_id').lean();

                for (const mgr of managers) {
                    await Notification.create({
                        tenant_id: tenantId,
                        recipient_id: mgr._id,
                        type: 'correction_requested',
                        title: 'Correction Requested',
                        message: `${empName} requested a correction for their ${MONTH_NAMES[timesheet.month]} ${timesheet.year} timesheet: ${reason.trim()}`,
                        timesheet_id: timesheet._id,
                        metadata: {
                            employee_id: employee._id,
                            employee_name: empName,
                            project_id: timesheet.project_id,
                            month: timesheet.month,
                            year: timesheet.year,
                        }
                    });
                }
            }
        } catch (_notifErr) { /* notification failure should not block */ }

        res.json({ success: true, data: timesheet, message: 'Correction request sent to your manager' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── PUT /api/timesheet/:id/revert — manager reverts an approved timesheet back to draft
router.put('/:id/revert', ...auth, authorize(['MANAGER', 'ADMINISTRATOR']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid timesheet ID' });
        }

        const timesheet = await Timesheet.findOne({ _id: id, tenant_id: tenantId });
        if (!timesheet) {
            return res.status(404).json({ error: 'Timesheet not found' });
        }
        if (timesheet.status !== 'approved') {
            return res.status(400).json({ error: 'Only approved timesheets can be reverted' });
        }

        // Verify manager has access via team_ids
        if (req.user.role === 'MANAGER') {
            const empUser = await User.findOne({ _id: timesheet.user_id, tenant_id: tenantId }).lean();
            if (empUser) {
                const emp = await Employee.findOne({ tenant_id: tenantId, official_email: empUser.email, is_active: true }).lean();
                if (emp) {
                    const manager = await User.findById(req.user._id).select('team_ids').lean();
                    const teamIdSet = new Set((manager?.team_ids || []).map(tid => tid.toString()));
                    if (!emp.team_id?.toString() || !teamIdSet.has(emp.team_id.toString())) {
                        return res.status(403).json({ error: 'Access denied: employee not under your management' });
                    }
                }
            }
        }

        timesheet.status = 'draft';
        timesheet.submitted_at = null;
        timesheet.approved_by = null;
        timesheet.approved_at = null;
        timesheet.rejection_reason = null;
        timesheet.correction_request = { status: null, reason: null, requested_at: null, requested_by: null };
        await timesheet.save();

        // Notify employee
        try {
            const empUser = await User.findOne({ _id: timesheet.user_id, tenant_id: tenantId }).lean();
            const employee = empUser ? await Employee.findOne({ tenant_id: tenantId, official_email: empUser.email }).lean() : null;
            const MONTH_NAMES = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
            await Notification.create({
                tenant_id: tenantId,
                recipient_id: timesheet.user_id,
                type: 'timesheet_reverted',
                title: 'Timesheet Reverted for Correction',
                message: `Your ${MONTH_NAMES[timesheet.month]} ${timesheet.year} timesheet has been reverted by ${req.user.full_name || req.user.email}. Please update and re-submit.`,
                timesheet_id: timesheet._id,
                metadata: {
                    employee_id: employee?._id || null,
                    employee_name: employee?.employee_name || null,
                    project_id: timesheet.project_id,
                    month: timesheet.month,
                    year: timesheet.year,
                }
            });
        } catch (_notifErr) { /* notification failure should not block */ }

        res.json({ success: true, data: timesheet, message: 'Timesheet reverted to draft for correction' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── PUT /api/timesheet/project/:projectId/revert-project — admin reverts a submitted project back to manager
router.put('/project/:projectId/revert-project', ...auth, authorize(['ADMINISTRATOR']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const { projectId } = req.params;
        const { month, year, reason } = req.body;

        if (!month || !year) {
            return res.status(400).json({ error: 'month and year are required' });
        }
        if (!reason || !reason.trim()) {
            return res.status(400).json({ error: 'Revert reason is required' });
        }

        const submission = await ProjectSubmission.findOne({ tenant_id: tenantId, project_id: projectId, month, year });
        if (!submission) {
            return res.status(404).json({ error: 'Project submission not found' });
        }
        if (submission.status === 'reverted') {
            return res.status(400).json({ error: 'Project is already reverted' });
        }

        submission.status = 'reverted';
        submission.reverted_by = req.user._id;
        submission.reverted_at = new Date();
        submission.revert_reason = reason.trim();
        await submission.save();

        // Notify the manager who submitted the project
        try {
            const MONTH_NAMES = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
            const projectName = submission.project_name || projectId;
            await Notification.create({
                tenant_id: tenantId,
                recipient_id: submission.submitted_by,
                type: 'project_reverted',
                title: 'Project Reverted for Correction',
                message: `Admin reverted ${projectName} for ${MONTH_NAMES[month]} ${year} for corrections: ${reason.trim()}. Please revert individual employee timesheets as needed.`,
                metadata: {
                    project_id: projectId,
                    project_name: projectName,
                    month,
                    year,
                }
            });
        } catch (_notifErr) { /* notification failure should not block */ }

        res.json({ success: true, data: submission, message: 'Project reverted to manager for corrections' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

export default router;
