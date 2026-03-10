/**
 * Streamline 360 Proxy Routes
 * ThinkSheet backend proxies Streamline API calls using a service token.
 * All routes require ThinkSheet authentication.
 *
 * GET /api/streamline/resources  → Streamline /api/invoicing/resources
 * GET /api/streamline/projects   → Streamline /api/invoicing/projects
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, checkActive } from '../middlewares/auth.js';

const router = express.Router();

// Read lazily so dotenv in index.js has time to load before these are evaluated
const getStreamlineConfig = () => ({
    url: process.env.STREAMLINE_URL || 'http://localhost:5000',
    jwtSecret: process.env.STREAMLINE_JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-2024',
    tenantId: process.env.STREAMLINE_TENANT_ID || 'thinkitive_inc',
    serviceUserId: process.env.STREAMLINE_SERVICE_USER_ID || '697a0ea239c5bb2c05498004',
});

/** Generate a short-lived Streamline service token using a real Streamline user ID */
function makeStreamlineToken() {
    const { jwtSecret, tenantId, serviceUserId } = getStreamlineConfig();
    return jwt.sign(
        {
            userId: serviceUserId,
            email: 'ghanshyam@thinkitive.com',
            role: 'ADMINISTRATOR',
            tenant_id: tenantId,
        },
        jwtSecret,
        { expiresIn: '1h' }
    );
}

/** Forward a GET request to Streamline and pipe the response */
async function proxyGet(path, req, res) {
    try {
        const { url: streamlineUrl } = getStreamlineConfig();
        const token = makeStreamlineToken();
        const qs = new URLSearchParams(req.query).toString();
        const url = `${streamlineUrl}${path}${qs ? '?' + qs : ''}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            signal: controller.signal,
        });
        clearTimeout(timeout);

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (err) {
        console.error('[Streamline proxy error]', err.message, err.cause?.message, err.cause?.code);
        res.status(502).json({ error: 'Streamline service unavailable', message: err.message, cause: err.cause?.message });
    }
}

// ── GET /api/streamline/resources ────────────────────────────────────────────
router.get('/resources', authenticate, checkActive, (req, res) =>
    proxyGet('/api/invoicing/resources', req, res)
);

// ── GET /api/streamline/projects ─────────────────────────────────────────────
// Proxies Streamline's /api/project_masters endpoint (proper project list).
router.get('/projects', authenticate, checkActive, (req, res) =>
    proxyGet('/api/project_masters', req, res)
);

export default router;
