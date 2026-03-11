/**
 * Activity Log Routes
 * GET /api/logs — list activity logs (admin + manager)
 */
import express from 'express';
import { authenticate, checkActive, authorize } from '../middlewares/auth.js';
import ActivityLog from '../models/ActivityLog.js';

const router = express.Router();

// ── GET /api/logs — list activity logs ──────────────────────────────────────
router.get('/',
    authenticate, checkActive, authorize(['ADMINISTRATOR', 'MANAGER']),
    async (req, res) => {
        try {
            const tenantId = req.tenantIdString;
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
            const skip = (page - 1) * limit;

            const filter = { tenant_id: tenantId };

            // Managers can only see logs related to their own actions
            if (req.user.role === 'MANAGER') {
                filter.performed_by = req.user._id;
            }

            const [logs, total] = await Promise.all([
                ActivityLog.find(filter)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                ActivityLog.countDocuments(filter)
            ]);

            res.json({
                success: true,
                data: logs,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (err) {
            res.status(500).json({ error: 'Server error', message: err.message });
        }
    }
);

export default router;
