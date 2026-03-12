/**
 * Employee Routes
 * CRUD operations for employees with team-based access control.
 * Bulk upload (admin only), manual create (admin + manager).
 *
 * POST /api/employees/bulk-upload   — Admin: upload CSV/Excel
 * POST /api/employees               — Admin/Manager: create single employee
 * GET  /api/employees               — list employees (filtered by team for managers)
 * PUT  /api/employees/:id           — update employee
 * DELETE /api/employees/:id         — soft delete employee
 */
import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import mongoose from 'mongoose';
import { authenticate, checkActive, authorize } from '../middlewares/auth.js';
import Employee from '../models/users/Employee.js';
import User from '../models/users/User.js';
import { logActivity } from '../utils/logActivity.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const TENANT_ID = process.env.TENANT_ID || 'thinkitive_inc';
const DEFAULT_PASSWORD = 'Think@2026';

// Helper: create or update EMPLOYEE User record
// password defaults to empId (the employee's own ID), falling back to DEFAULT_PASSWORD
async function ensureEmployeeUser(empEmail, empName, empId, tenantId, password = null) {
    const existing = await User.findOne({
        email: empEmail.toLowerCase(),
        tenant_id: tenantId,
        is_deleted: { $ne: true }
    });

    if (existing) {
        return { user: existing, isNew: false };
    }

    const user = await User.create({
        email: empEmail.toLowerCase(),
        password: password || empId || DEFAULT_PASSWORD,
        full_name: empName,
        role: 'EMPLOYEE',
        tenant_id: tenantId,
        is_active: true,
        is_deleted: false,
        must_change_password: true,
        permissions: {
            module_access: [
                { module_name: 'timesheet', functions: ['view', 'create', 'edit'], submodules: [] }
            ],
            can_approve_expenses: false,
            can_create_users: false,
            approval_limit: null
        }
    });
    return { user, isNew: true };
}

// ── POST /api/employees/bulk-upload — Admin only ─────────────────────────────
router.post('/bulk-upload',
    authenticate, checkActive, authorize(['ADMINISTRATOR']),
    upload.single('file'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'File is required' });
            }

            const { team_id, team_name } = req.body;
            if (!team_id) {
                return res.status(400).json({ error: 'team_id is required' });
            }

            // Parse file (CSV or Excel)
            const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

            if (rows.length === 0) {
                return res.status(400).json({ error: 'File is empty or has no valid rows' });
            }

            const results = { created: [], skipped: [], errors: [] };

            for (const row of rows) {
                const empId = String(row['Emp_ID'] || row['emp_id'] || row['EmpID'] || row['Employee ID'] || '').trim();
                const empEmail = String(row['Emp_Email'] || row['emp_email'] || row['Email'] || row['Employee Email'] || '').trim();
                const empName = String(row['Emp_Name'] || row['emp_name'] || row['Name'] || row['Employee Name'] || '').trim();

                if (!empId || !empEmail || !empName) {
                    results.errors.push({
                        row: row,
                        reason: 'Missing required field(s): Emp_ID, Emp_Email, or Emp_Name'
                    });
                    continue;
                }

                // Basic email validation
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(empEmail)) {
                    results.errors.push({ row, reason: `Invalid email: ${empEmail}` });
                    continue;
                }

                try {
                    // Check for duplicate
                    const existing = await Employee.findOne({
                        official_email: empEmail.toLowerCase(),
                        tenant_id: TENANT_ID,
                        is_deleted: { $ne: true }
                    });

                    if (existing) {
                        results.skipped.push({ emp_id: empId, email: empEmail, reason: 'Already exists' });
                        continue;
                    }

                    // Create Employee master
                    await Employee.create({
                        tenant_id: TENANT_ID,
                        employee_name: empName,
                        official_email: empEmail.toLowerCase(),
                        unique_id: empId,
                        team_id: team_id,
                        team_name: team_name || '',
                        is_active: true,
                        is_deleted: false
                    });

                    // Create User account
                    const { isNew } = await ensureEmployeeUser(empEmail, empName, empId, TENANT_ID);
                    results.created.push({
                        emp_id: empId,
                        email: empEmail,
                        name: empName,
                        user_created: isNew
                    });
                } catch (e) {
                    results.errors.push({ emp_id: empId, email: empEmail, reason: e.message });
                }
            }

            if (results.created.length > 0) {
                await logActivity({
                    tenantId: TENANT_ID,
                    action: 'EMPLOYEE_BULK_UPLOADED',
                    performedBy: req.user,
                    targetType: 'EMPLOYEE',
                    targetName: `${results.created.length} employees`,
                    details: `Bulk uploaded ${results.created.length} employees to team ${team_name || team_id}`,
                    metadata: { created: results.created.length, skipped: results.skipped.length, errors: results.errors.length }
                });
            }

            res.json({
                success: true,
                data: results,
                summary: {
                    total: rows.length,
                    created: results.created.length,
                    skipped: results.skipped.length,
                    errors: results.errors.length
                }
            });
        } catch (err) {
            res.status(500).json({ error: 'Server error', message: err.message });
        }
    }
);

// ── POST /api/employees — create single employee (Admin or Manager) ──────────
router.post('/',
    authenticate, checkActive, authorize(['ADMINISTRATOR', 'MANAGER']),
    async (req, res) => {
        try {
            const { emp_id, emp_email, emp_name, team_id, team_name, designation } = req.body;

            if (!emp_id || !emp_email || !emp_name || !team_id) {
                return res.status(400).json({
                    error: 'emp_id, emp_email, emp_name and team_id are required'
                });
            }

            // Manager can only create employees in their teams
            if (req.user.role === 'MANAGER') {
                const manager = await User.findById(req.user._id).lean();
                if (!manager?.team_ids?.includes(team_id)) {
                    return res.status(403).json({
                        error: 'Access denied: you can only create employees in your assigned teams'
                    });
                }
            }

            // Check duplicate
            const existing = await Employee.findOne({
                official_email: emp_email.toLowerCase(),
                tenant_id: TENANT_ID,
                is_deleted: { $ne: true }
            });
            if (existing) {
                return res.status(409).json({ error: 'An employee with this email already exists' });
            }

            const employee = await Employee.create({
                tenant_id: TENANT_ID,
                employee_name: emp_name.trim(),
                official_email: emp_email.toLowerCase().trim(),
                unique_id: emp_id.trim(),
                team_id,
                team_name: team_name || '',
                designation: designation || '',
                is_active: true,
                is_deleted: false
            });

            // Create User account
            const { user, isNew } = await ensureEmployeeUser(emp_email, emp_name, emp_id, TENANT_ID);

            await logActivity({
                tenantId: TENANT_ID,
                action: 'EMPLOYEE_CREATED',
                performedBy: req.user,
                targetType: 'EMPLOYEE',
                targetName: emp_name.trim(),
                targetEmail: emp_email.toLowerCase().trim(),
                details: `Created employee ${emp_name} (${emp_id}) in team ${team_name || team_id}`,
                metadata: { team_id, team_name, designation, user_created: isNew }
            });

            res.status(201).json({
                success: true,
                data: employee,
                user_created: isNew
            });
        } catch (err) {
            res.status(500).json({ error: 'Server error', message: err.message });
        }
    }
);

// ── GET /api/employees — list employees (team-filtered for managers) ─────────
router.get('/',
    authenticate, checkActive, authorize(['ADMINISTRATOR', 'MANAGER']),
    async (req, res) => {
        try {
            const filter = {
                tenant_id: TENANT_ID,
                is_deleted: { $ne: true }
            };

            // Manager: only their teams
            if (req.user.role === 'MANAGER') {
                const manager = await User.findById(req.user._id).lean();
                const teamIds = manager?.team_ids || [];
                if (teamIds.length === 0) {
                    return res.json({ success: true, data: [] });
                }
                filter.team_id = { $in: teamIds };
            }

            // Optional team_id filter from query
            if (req.query.team_id) {
                // For managers, ensure the requested team_id is in their allowed list
                if (req.user.role === 'MANAGER') {
                    const manager = await User.findById(req.user._id).lean();
                    if (!manager?.team_ids?.includes(req.query.team_id)) {
                        return res.status(403).json({ error: 'Access denied to this team' });
                    }
                }
                filter.team_id = req.query.team_id;
            }

            const employees = await Employee.find(filter)
                .select('_id employee_name official_email unique_id designation team_id team_name is_active')
                .sort({ createdAt: -1 })
                .lean();

            res.json({ success: true, data: employees });
        } catch (err) {
            res.status(500).json({ error: 'Server error', message: err.message });
        }
    }
);

// ── PUT /api/employees/:id — update employee ─────────────────────────────────
router.put('/:id',
    authenticate, checkActive, authorize(['ADMINISTRATOR', 'MANAGER']),
    async (req, res) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                return res.status(400).json({ error: 'Invalid employee ID' });
            }

            const employee = await Employee.findOne({
                _id: req.params.id,
                tenant_id: TENANT_ID,
                is_deleted: { $ne: true }
            });

            if (!employee) {
                return res.status(404).json({ error: 'Employee not found' });
            }

            // Manager: check team access
            if (req.user.role === 'MANAGER') {
                const manager = await User.findById(req.user._id).lean();
                if (!manager?.team_ids?.includes(employee.team_id)) {
                    return res.status(403).json({ error: 'Access denied: employee not in your teams' });
                }
            }

            const { emp_name, designation, team_id, team_name } = req.body;
            if (emp_name) employee.employee_name = emp_name;
            if (designation !== undefined) employee.designation = designation;
            if (team_id) {
                // Manager can only move to their own teams
                if (req.user.role === 'MANAGER') {
                    const manager = await User.findById(req.user._id).lean();
                    if (!manager?.team_ids?.includes(team_id)) {
                        return res.status(403).json({ error: 'Access denied: target team not in your teams' });
                    }
                }
                employee.team_id = team_id;
                if (team_name) employee.team_name = team_name;
            }

            await employee.save();
            res.json({ success: true, data: employee });
        } catch (err) {
            res.status(500).json({ error: 'Server error', message: err.message });
        }
    }
);

// ── DELETE /api/employees/:id — soft delete ──────────────────────────────────
router.delete('/:id',
    authenticate, checkActive, authorize(['ADMINISTRATOR', 'MANAGER']),
    async (req, res) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                return res.status(400).json({ error: 'Invalid employee ID' });
            }

            const employee = await Employee.findOne({
                _id: req.params.id,
                tenant_id: TENANT_ID,
                is_deleted: { $ne: true }
            });

            if (!employee) {
                return res.status(404).json({ error: 'Employee not found' });
            }

            // Manager: check team access
            if (req.user.role === 'MANAGER') {
                const manager = await User.findById(req.user._id).lean();
                if (!manager?.team_ids?.includes(employee.team_id)) {
                    return res.status(403).json({ error: 'Access denied: employee not in your teams' });
                }
            }

            employee.is_deleted = true;
            employee.is_active = false;
            await employee.save();

            await logActivity({
                tenantId: TENANT_ID,
                action: 'EMPLOYEE_DELETED',
                performedBy: req.user,
                targetType: 'EMPLOYEE',
                targetName: employee.employee_name,
                targetEmail: employee.official_email,
                details: `Deleted employee ${employee.employee_name} (${employee.unique_id})`
            });

            res.json({ success: true, message: 'Employee deleted' });
        } catch (err) {
            res.status(500).json({ error: 'Server error', message: err.message });
        }
    }
);

// ── GET /api/employees/download-template — CSV template download ─────────────
router.get('/download-template',
    authenticate, checkActive, authorize(['ADMINISTRATOR']),
    (req, res) => {
        const csv = 'Emp_ID,Emp_Email,Emp_Name\n340,abhay.ahire@company.com,Abhay Ahire\n341,john.doe@company.com,John Doe';
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=employee_template.csv');
        res.send(csv);
    }
);

export default router;
