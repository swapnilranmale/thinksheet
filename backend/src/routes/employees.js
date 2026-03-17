/**
 * Employee Routes
 * Employees are sourced exclusively from Streamline360 Resource Master sync.
 * Manual creation and CSV bulk upload are not supported.
 *
 * GET    /api/employees        — list synced employees (team-filtered for managers)
 * PUT    /api/employees/:id    — update employee metadata
 * DELETE /api/employees/:id    — soft delete employee
 */
import express from 'express';
import mongoose from 'mongoose';
import { authenticate, checkActive, authorize } from '../middlewares/auth.js';
import Employee from '../models/users/Employee.js';
import EmployeeManagerMapping from '../models/timesheet/EmployeeManagerMapping.js';
import User from '../models/users/User.js';
import { logActivity } from '../utils/logActivity.js';

const router = express.Router();
const TENANT_ID = process.env.TENANT_ID || 'thinkitive_inc';

// ── GET /api/employees/me — get own Employee record (EMPLOYEE role only) ──────
router.get('/me',
    authenticate, checkActive, authorize(['EMPLOYEE']),
    async (req, res) => {
        try {
            const employee = await Employee.findOne({
                official_email: req.user.email,
                tenant_id: TENANT_ID,
                is_deleted: { $ne: true }
            })
            .select('_id employee_name official_email unique_id designation team_id team_name is_active')
            .lean();

            if (!employee) {
                return res.json({ success: true, data: null });
            }

            res.json({ success: true, data: employee });
        } catch (err) {
            res.status(500).json({ error: 'Server error', message: err.message });
        }
    }
);

// ── GET /api/employees — list Streamline-synced employees (team-filtered for managers) ──
// Only returns employees that are mapped to at least one project (have an active
// EmployeeManagerMapping record). The Employee Master stores ALL Streamline employees,
// but this endpoint surfaces only those assigned as resources to projects.
router.get('/',
    authenticate, checkActive, authorize(['ADMINISTRATOR', 'MANAGER']),
    async (req, res) => {
        try {
            // ── Step 1: Determine which employees are mapped to projects ──────────
            const mappingFilter = {
                tenant_id: TENANT_ID,
                is_deleted: { $ne: true },
                is_active: true,
            };
            const mappedEmployeeIds = await EmployeeManagerMapping.distinct('employee_id', mappingFilter);

            if (mappedEmployeeIds.length === 0) {
                return res.json({
                    success: true,
                    data: [],
                    pagination: { total: 0, page: 1, limit: 20, pages: 0 },
                });
            }

            // ── Step 2: Build employee filter ─────────────────────────────────────
            const filter = {
                _id: { $in: mappedEmployeeIds },
                tenant_id: TENANT_ID,
                is_deleted: { $ne: true },
                synced_from_streamline: true,
                // Only show employees that have a non-empty resource_id (actual resource
                // assignment from Streamline Resource Master, e.g. "UPID-26-03-1").
                // Excludes employees imported from Employee Master only.
                $and: [
                    { resource_id: { $exists: true } },
                    { resource_id: { $ne: null } },
                    { resource_id: { $ne: '' } },
                ],
                // Engineering Managers are shown in the Managers tab, not here
                is_engineering_manager: { $ne: true },
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

            // Pagination & search
            const page  = Math.max(1, parseInt(req.query.page)  || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
            const skip  = (page - 1) * limit;

            if (req.query.search) {
                const rx = new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                filter.$or = [
                    { employee_name: rx },
                    { official_email: rx },
                    { designation: rx },
                    { unique_id: rx },
                ];
            }

            const [employees, total] = await Promise.all([
                Employee.find(filter)
                    .select('_id employee_name official_email unique_id designation team_id team_name profile_resource actual_resource resource_id is_active')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Employee.countDocuments(filter),
            ]);

            res.json({
                success: true,
                data: employees,
                pagination: { total, page, limit, pages: Math.ceil(total / limit) },
            });
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

            // Mark as locally modified so Streamline sync preserves these edits
            employee.locally_modified = true;
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

export default router;
