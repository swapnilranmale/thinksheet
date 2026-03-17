/**
 * Notification Routes
 * - GET  /api/notifications          — list notifications for current user (paginated)
 * - GET  /api/notifications/count     — unread count
 * - PUT  /api/notifications/:id/read  — mark one as read
 * - PUT  /api/notifications/read-all  — mark all as read
 */
import express from 'express';
import mongoose from 'mongoose';
import { authenticate, checkActive } from '../middlewares/auth.js';
import Notification from '../models/timesheet/Notification.js';

const router = express.Router();
const auth = [authenticate, checkActive];

// ─── GET /api/notifications?page=1&limit=20 — list for current user ──────────
router.get('/', ...auth, async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const filter = { tenant_id: tenantId, recipient_id: req.user._id };
        const [notifications, total] = await Promise.all([
            Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Notification.countDocuments(filter),
        ]);

        res.json({
            success: true,
            data: notifications,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── GET /api/notifications/count — unread count ─────────────────────────────
router.get('/count', ...auth, async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const unread = await Notification.countDocuments({
            tenant_id: tenantId,
            recipient_id: req.user._id,
            is_read: false
        });
        res.json({ success: true, unread });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── PUT /api/notifications/read-all — mark all as read ──────────────────────
router.put('/read-all', ...auth, async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        await Notification.updateMany(
            { tenant_id: tenantId, recipient_id: req.user._id, is_read: false },
            { $set: { is_read: true, read_at: new Date() } }
        );
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ─── PUT /api/notifications/:id/read — mark one as read ─────────────────────
router.put('/:id/read', ...auth, async (req, res) => {
    try {
        const tenantId = req.tenantIdString;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid notification ID' });
        }

        const notif = await Notification.findOneAndUpdate(
            { _id: id, tenant_id: tenantId, recipient_id: req.user._id },
            { $set: { is_read: true, read_at: new Date() } },
            { new: true }
        );

        if (!notif) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ success: true, data: notif });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

export default router;
