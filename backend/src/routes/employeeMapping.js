/**
 * Employee-Manager Mapping Routes
 * Admin-only: map employees (from Employee Master) under managers (User with MANAGER role)
 */
import express from 'express';
import mongoose from 'mongoose';
import { authenticate, checkActive, authorize } from '../middlewares/auth.js';
import EmployeeManagerMapping from '../models/timesheet/EmployeeManagerMapping.js';
import Employee from '../models/users/Employee.js';
import User from '../models/users/User.js';
import ProjectMaster from '../models/invoicing/ProjectMaster.js';

const router = express.Router();
const adminOnly = [authenticate, checkActive, authorize(['ADMINISTRATOR'])];

// ── GET /api/employee-mapping  — list all mappings ─────────────────────────

router.get('/', ...adminOnly, async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const mappings = await EmployeeManagerMapping.find({
            tenant_id: tenantId,
            is_deleted: { $ne: true }
        })
            .populate('project_id', 'project_name unique_id project_status')
            .populate('manager_id', 'full_name email designation')
            .populate('employee_id', 'employee_name official_email unique_id designation department_id')
            .sort({ createdAt: -1 })
            .lean();

        res.json({ success: true, data: mappings });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ── GET /api/employee-mapping/managers  — managers dropdown ────────────────

router.get('/managers', ...adminOnly, async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const managers = await User.find({
            tenant_id: tenantId,
            role: 'MANAGER',
            is_active: true,
            is_deleted: { $ne: true }
        })
            .select('_id full_name email designation department_id')
            .lean();

        res.json({ success: true, data: managers });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ── GET /api/employee-mapping/employees  — employees dropdown ──────────────

router.get('/employees', ...adminOnly, async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const employees = await Employee.find({
            tenant_id: tenantId,
            is_active: true
        })
            .select('_id employee_name official_email unique_id designation department_id')
            .lean();

        res.json({ success: true, data: employees });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ── GET /api/employee-mapping/projects  — projects dropdown ──────────────────

router.get('/projects', ...adminOnly, async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const projects = await ProjectMaster.find({
            tenant_id: tenantId,
            project_status: 'Active'
        })
            .select('_id project_name unique_id project_status')
            .sort({ project_name: 1 })
            .lean();

        res.json({ success: true, data: projects });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ── GET /api/employee-mapping/manager/:managerId  — employees under a manager

router.get('/manager/:managerId', ...adminOnly, async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const { managerId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(managerId)) {
            return res.status(400).json({ error: 'Invalid manager ID' });
        }

        const mappings = await EmployeeManagerMapping.find({
            tenant_id: tenantId,
            manager_id: managerId,
            is_deleted: { $ne: true }
        })
            .populate('employee_id', 'employee_name official_email unique_id designation')
            .lean();

        res.json({ success: true, data: mappings });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ── Helper: create or sync EMPLOYEE User record for an Employee Master record ──
async function ensureEmployeeUser(employee, tenantId) {
    if (!employee.official_email || !employee.unique_id) return null;

    const existing = await User.findOne({
        email: employee.official_email.toLowerCase(),
        tenant_id: tenantId,
        role: 'EMPLOYEE',
        is_deleted: { $ne: true }
    });

    if (existing) {
        // Always sync password to current unique_id (covers reset/re-mapping scenarios)
        existing.password = employee.unique_id;
        existing.full_name = employee.employee_name;
        existing.is_active = true;
        await existing.save();
        return existing;
    }

    // Create new EMPLOYEE user: password = unique_id (hashed by pre-save hook)
    const user = await User.create({
        email: employee.official_email.toLowerCase(),
        password: employee.unique_id,
        full_name: employee.employee_name,
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
    return user;
}

// ── POST /api/employee-mapping  — create/update mappings ──────────────────

router.post('/', ...adminOnly, async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const { manager_id, project_id, employee_ids } = req.body;

        if (!manager_id || !project_id || !Array.isArray(employee_ids) || employee_ids.length === 0) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'manager_id, project_id and employee_ids[] are required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(manager_id)) {
            return res.status(400).json({ error: 'Invalid manager_id' });
        }
        if (!mongoose.Types.ObjectId.isValid(project_id)) {
            return res.status(400).json({ error: 'Invalid project_id' });
        }

        const results = { created: [], updated: [], errors: [], users_created: [] };

        for (const empId of employee_ids) {
            if (!mongoose.Types.ObjectId.isValid(empId)) {
                results.errors.push({ employee_id: empId, reason: 'Invalid ID' });
                continue;
            }
            try {
                // Fetch employee master record
                const employee = await Employee.findOne({ _id: empId, tenant_id: tenantId }).lean();
                if (!employee) {
                    results.errors.push({ employee_id: empId, reason: 'Employee not found' });
                    continue;
                }

                // Auto-create EMPLOYEE User if needed (for login)
                const empUser = await ensureEmployeeUser(employee, tenantId);
                if (empUser && empUser.isNew !== false) {
                    results.users_created.push(employee.official_email);
                }

                // Upsert mapping (unique per employee+project+tenant)
                await EmployeeManagerMapping.findOneAndUpdate(
                    { employee_id: empId, project_id, tenant_id: tenantId },
                    {
                        manager_id,
                        project_id,
                        employee_id: empId,
                        tenant_id: tenantId,
                        mapped_by: req.user._id,
                        mapped_at: new Date(),
                        is_active: true,
                        is_deleted: false
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
                results.created.push(empId);
            } catch (e) {
                results.errors.push({ employee_id: empId, reason: e.message });
            }
        }

        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ── DELETE /api/employee-mapping/:id  — soft delete mapping ───────────────

router.delete('/:id', ...adminOnly, async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid mapping ID' });
        }

        const mapping = await EmployeeManagerMapping.findOne({
            _id: id,
            tenant_id: tenantId,
            is_deleted: { $ne: true }
        });

        if (!mapping) {
            return res.status(404).json({ error: 'Mapping not found' });
        }

        mapping.is_deleted = true;
        mapping.is_active = false;
        await mapping.save();

        res.json({ success: true, message: 'Mapping removed' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ── PUT /api/employee-mapping/:id  — reassign employee to different manager

router.put('/:id', ...adminOnly, async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const { id } = req.params;
        const { manager_id } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid mapping ID' });
        }
        if (!manager_id || !mongoose.Types.ObjectId.isValid(manager_id)) {
            return res.status(400).json({ error: 'Valid manager_id is required' });
        }

        const mapping = await EmployeeManagerMapping.findOne({
            _id: id,
            tenant_id: tenantId,
            is_deleted: { $ne: true }
        });

        if (!mapping) {
            return res.status(404).json({ error: 'Mapping not found' });
        }

        mapping.manager_id = manager_id;
        mapping.mapped_by = req.user._id;
        mapping.mapped_at = new Date();
        await mapping.save();

        res.json({ success: true, message: 'Mapping updated' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

export default router;
