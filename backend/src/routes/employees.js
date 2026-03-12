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
router.get('/',
    authenticate, checkActive, authorize(['ADMINISTRATOR', 'MANAGER']),
    async (req, res) => {
        try {
            const filter = {
                tenant_id: TENANT_ID,
                is_deleted: { $ne: true },
                synced_from_streamline: true,
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
