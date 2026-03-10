/**
 * Auth Routes
 * POST /api/auth/signup           — create first ADMINISTRATOR account
 * POST /api/auth/login            — email + password → JWT
 * GET  /api/auth/me               — get logged-in user
 * POST /api/auth/change-password  — change password (must_change_password flow)
 * POST /api/auth/create-manager   — ADMINISTRATOR creates a MANAGER account
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, checkActive, authorize } from '../middlewares/auth.js';
import User from '../models/users/User.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
const TENANT_ID = process.env.TENANT_ID || 'thinkitive_inc';

function makeToken(user) {
    return jwt.sign(
        {
            _id: user._id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            tenant_id: user.tenant_id,
            is_active: user.is_active,
            must_change_password: user.must_change_password
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
    );
}

// ── POST /api/auth/signup — create first ADMINISTRATOR ────────────────────────
router.post('/signup', async (req, res) => {
    try {
        const { email, password, full_name } = req.body;

        if (!email || !password || !full_name) {
            return res.status(400).json({ error: 'email, password and full_name are required' });
        }

        const existing = await User.findOne({ email: email.toLowerCase(), tenant_id: TENANT_ID });
        if (existing) {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }

        const user = await User.create({
            email: email.toLowerCase(),
            password,
            full_name,
            role: 'ADMINISTRATOR',
            tenant_id: TENANT_ID,
            is_active: true,
            must_change_password: false,
            permissions: {
                module_access: [
                    { module_name: 'timesheet', functions: ['view', 'create', 'edit', 'delete'], submodules: [] },
                    { module_name: 'employee-mapping', functions: ['view', 'create', 'edit', 'delete'], submodules: [] }
                ],
                can_approve_expenses: true,
                can_create_users: true,
                approval_limit: null
            }
        });

        const token = makeToken(user);
        res.status(201).json({
            success: true,
            token,
            user: {
                _id: user._id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                tenant_id: user.tenant_id,
                must_change_password: user.must_change_password
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'email and password are required' });
        }

        const user = await User.findOne({
            email: email.toLowerCase(),
            tenant_id: TENANT_ID,
            is_deleted: { $ne: true }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is inactive. Contact your administrator.' });
        }

        const match = await user.comparePassword(password);
        if (!match) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = makeToken(user);
        res.json({
            success: true,
            token,
            user: {
                _id: user._id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                tenant_id: user.tenant_id,
                must_change_password: user.must_change_password
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticate, checkActive, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password')
            .lean();

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ── POST /api/auth/change-password ───────────────────────────────────────────
router.post('/change-password', authenticate, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;

        if (!new_password || new_password.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // If not a forced change, require current password
        if (!user.must_change_password) {
            if (!current_password) {
                return res.status(400).json({ error: 'Current password is required' });
            }
            const match = await user.comparePassword(current_password);
            if (!match) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }
        }

        user.password = new_password;
        user.must_change_password = false;
        await user.save();

        // Issue a fresh token without must_change_password flag
        const token = makeToken(user);
        res.json({ success: true, token, message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ── POST /api/auth/create-manager — ADMINISTRATOR creates MANAGER account ────
router.post('/create-manager', authenticate, checkActive, authorize(['ADMINISTRATOR']), async (req, res) => {
    try {
        const { email, password, full_name, designation } = req.body;

        if (!email || !password || !full_name) {
            return res.status(400).json({ error: 'email, password and full_name are required' });
        }

        const existing = await User.findOne({ email: email.toLowerCase(), tenant_id: TENANT_ID });
        if (existing) {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }

        const user = await User.create({
            email: email.toLowerCase(),
            password,
            full_name,
            role: 'MANAGER',
            tenant_id: TENANT_ID,
            designation: designation || '',
            is_active: true,
            must_change_password: false,
            permissions: {
                module_access: [
                    { module_name: 'timesheet', functions: ['view'], submodules: [] }
                ],
                can_approve_expenses: false,
                can_create_users: false,
                approval_limit: null
            }
        });

        res.status(201).json({
            success: true,
            user: {
                _id: user._id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                designation: user.designation
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

// ── GET /api/auth/managers — list all managers (for admin UI) ─────────────────
router.get('/managers', authenticate, checkActive, authorize(['ADMINISTRATOR']), async (req, res) => {
    try {
        const managers = await User.find({
            role: 'MANAGER',
            tenant_id: TENANT_ID,
            is_deleted: { $ne: true }
        }).select('_id full_name email designation is_active').lean();

        res.json({ success: true, data: managers });
    } catch (err) {
        res.status(500).json({ error: 'Server error', message: err.message });
    }
});

export default router;
