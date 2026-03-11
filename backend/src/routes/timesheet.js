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

// ─── GET /api/timesheet?month=3&year=2026 — employee's own timesheet ────────
router.get('/', ...auth, authorize(['EMPLOYEE']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const month = parseInt(req.query.month);
        const year = parseInt(req.query.year);

        if (!month || !year || month < 1 || month > 12 || year < 2000 || year > 2100) {
            return res.status(400).json({ error: 'Valid month (1-12) and year (2000-2100) are required' });
        }

        const employee = await getEmployeeForUser(req.user);
        if (!employee) {
            return res.status(404).json({ error: 'Employee record not found for this user' });
        }

        const timesheet = await Timesheet.findOne({
            tenant_id: tenantId,
            user_id: req.user._id,
            month,
            year
        }).lean();

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

// ─── POST /api/timesheet — create new timesheet (draft) ─────────────────────
router.post('/', ...auth, authorize(['EMPLOYEE']), async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const { month, year, entries } = req.body;

        if (!month || !year) {
            return res.status(400).json({ error: 'month and year are required' });
        }

        const employee = await getEmployeeForUser(req.user);
        if (!employee) {
            return res.status(404).json({ error: 'Employee record not found for this user' });
        }

        const existing = await Timesheet.findOne({
            tenant_id: tenantId,
            user_id: req.user._id,
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

        if (timesheet.status === 'submitted') {
            return res.status(403).json({ error: 'Cannot edit a submitted timesheet' });
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

        timesheet.status = 'submitted';
        timesheet.submitted_at = new Date();
        await timesheet.save();

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

        if (timesheet.status !== 'submitted') {
            return res.status(400).json({ error: 'Timesheet is not submitted' });
        }

        timesheet.status = 'draft';
        timesheet.submitted_at = null;
        await timesheet.save();

        res.json({ success: true, data: timesheet, message: 'Timesheet recalled to draft' });
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

        // For MANAGER: only their mapped employees. For ADMINISTRATOR: all.
        let mappings;
        if (req.user.role === 'MANAGER') {
            mappings = await EmployeeManagerMapping.find({
                tenant_id: tenantId,
                manager_id: req.user._id,
                is_deleted: { $ne: true }
            })
                .populate('employee_id', 'employee_name official_email unique_id designation department_id')
                .lean();
        } else {
            mappings = await EmployeeManagerMapping.find({
                tenant_id: tenantId,
                is_deleted: { $ne: true }
            })
                .populate('employee_id', 'employee_name official_email unique_id designation department_id')
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

        const userIdToTimesheet = {};
        timesheets.forEach(ts => { userIdToTimesheet[ts.user_id.toString()] = ts; });

        // Build response
        const team = mappings.map(mapping => {
            const emp = mapping.employee_id;
            if (!emp) return null;
            const userId = emailToUserId[emp.official_email];
            const timesheet = userId ? userIdToTimesheet[userId.toString()] : null;
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

        // Find all mappings for this project (manager only sees their own mappings)
        const filter = {
            tenant_id: tenantId,
            project_id: projectId,
            is_deleted: { $ne: true }
        };
        if (req.user.role === 'MANAGER') {
            filter.manager_id = req.user._id;
        }

        const mappings = await EmployeeManagerMapping.findOne({ tenant_id: tenantId, project_id: projectId, is_deleted: { $ne: true } }).lean();
        const projectInfo = mappings ? {
            project_id: projectId,
            project_name: mappings.project_name || '',
            project_code: mappings.project_code || '',
            client_id: mappings.client_id || null,
            client_name: mappings.client_name || ''
        } : { project_id: projectId, project_name: '', project_code: '', client_id: null, client_name: '' };

        const allMappings = await EmployeeManagerMapping.find(filter)
            .populate('employee_id', 'employee_name official_email unique_id designation')
            .lean();

        const employeeEmails = allMappings.map(m => m.employee_id?.official_email).filter(Boolean);

        const employeeUsers = await User.find({
            tenant_id: tenantId,
            email: { $in: employeeEmails },
            role: 'EMPLOYEE',
            is_deleted: { $ne: true }
        }).lean();

        const emailToUserId = {};
        employeeUsers.forEach(u => { emailToUserId[u.email] = u._id; });

        const userIds = Object.values(emailToUserId);
        const timesheets = await Timesheet.find({
            tenant_id: tenantId,
            user_id: { $in: userIds },
            month,
            year
        }).lean();

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

        // Verify manager has access to this employee
        if (req.user.role === 'MANAGER') {
            const mapping = await EmployeeManagerMapping.findOne({
                tenant_id: tenantId,
                manager_id: req.user._id,
                employee_id: employeeId,
                is_deleted: { $ne: true }
            });
            if (!mapping) {
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

        const timesheet = await Timesheet.findOne({
            tenant_id: tenantId,
            user_id: empUser._id,
            month,
            year
        }).lean();

        res.json({ success: true, employee, data: timesheet || null });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

export default router;
