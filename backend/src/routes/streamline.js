/**
 * Streamline 360 Proxy Routes
 * ThinkSheet backend proxies Streamline API calls using a service token.
 * All routes require ThinkSheet authentication.
 *
 * GET  /api/streamline/resources              → Streamline /api/invoicing/resources
 * GET  /api/streamline/projects               → Streamline /api/project_masters
 * GET  /api/streamline/projects-with-dates    → merged project + resource dates
 * GET  /api/streamline/departments            → Streamline /api/departments
 * GET  /api/streamline/teams                  → Streamline /api/teams
 * GET  /api/streamline/clients                → Streamline /api/client_masters
 * GET  /api/streamline/resource-master        → Streamline /api/invoicing/resources (full data)
 * GET  /api/streamline/my-resource-projects   → Projects from Resource Master grouped (Manager/Admin)
 * POST /api/streamline/sync                   → Full sync: Resource Master → ThinkSheet
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, checkActive, authorize } from '../middlewares/auth.js';
import Employee from '../models/users/Employee.js';
import User from '../models/users/User.js';
import EmployeeManagerMapping from '../models/timesheet/EmployeeManagerMapping.js';

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
router.get('/projects', authenticate, checkActive, (req, res) =>
    proxyGet('/api/project_masters', req, res)
);

// ── GET /api/streamline/departments ─────────────────────────────────────────
router.get('/departments', authenticate, checkActive, (req, res) =>
    proxyGet('/api/departments', req, res)
);

// ── GET /api/streamline/teams ──────────────────────────────────────────────
router.get('/teams', authenticate, checkActive, (req, res) =>
    proxyGet('/api/teams', req, res)
);

// ── GET /api/streamline/clients ───────────────────────────────────────────────
// Proxies Streamline's Client Master list
router.get('/clients', authenticate, checkActive, (req, res) =>
    proxyGet('/api/client_masters', req, res)
);

// ── GET /api/streamline/resource-master ──────────────────────────────────────
// Full Resource Master (same endpoint as /resources, exposed explicitly for clarity)
router.get('/resource-master', authenticate, checkActive, (req, res) =>
    proxyGet('/api/invoicing/resources', req, res)
);

// ── GET /api/streamline/projects-with-dates ────────────────────────────────
// Merges project master data with resource dates (start_from / end_date)
router.get('/projects-with-dates', authenticate, checkActive, async (req, res) => {
    try {
        const { url: streamlineUrl } = getStreamlineConfig();
        const token = makeStreamlineToken();
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const [projRes, resRes] = await Promise.all([
            fetch(`${streamlineUrl}/api/project_masters?page=1&limit=500`, { headers, signal: controller.signal }),
            fetch(`${streamlineUrl}/api/invoicing/resources?page=1&limit=1000`, { headers, signal: controller.signal }),
        ]);
        clearTimeout(timeout);

        const projData = await projRes.json();
        const resData = await resRes.json();

        const projects = projData.projects || [];
        const resources = resData.resources || [];

        // Build date ranges per project_id from resources
        const projectDates = {};
        resources.forEach(r => {
            const pid = r.project_id?.toString();
            if (!pid) return;
            if (!projectDates[pid]) projectDates[pid] = { start: null, end: null };
            if (r.start_from) {
                const s = new Date(r.start_from);
                if (!projectDates[pid].start || s < projectDates[pid].start) projectDates[pid].start = s;
            }
            if (r.end_date) {
                const e = new Date(r.end_date);
                if (!projectDates[pid].end || e > projectDates[pid].end) projectDates[pid].end = e;
            }
        });

        // Merge dates into projects
        const merged = projects.map(p => ({
            ...p,
            project_start_date: p.project_start_date || projectDates[p._id]?.start || null,
            project_end_date: projectDates[p._id]?.end || null,
        }));

        res.json({ projects: merged, pagination: projData.pagination });
    } catch (err) {
        console.error('[Streamline proxy error]', err.message);
        res.status(502).json({ error: 'Streamline service unavailable', message: err.message });
    }
});

// ── GET /api/streamline/my-resource-projects ─────────────────────────────────
// Returns all projects from Streamline360 Resource Master, grouped with their
// assigned resources (employees). Managers see only projects in their teams;
// Administrators see all.
//
// Response: { success, data: [{ project_id, project_name, project_code,
//   client_id, client_name, start_date, end_date, resource_count, resources[] }] }
router.get('/my-resource-projects', authenticate, checkActive, authorize(['MANAGER', 'ADMINISTRATOR']), async (req, res) => {
    try {
        const { url: streamlineUrl } = getStreamlineConfig();
        const token = makeStreamlineToken();
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

        // Get manager's team_ids for filtering (admins see everything)
        let allowedTeamIds = null;
        if (req.user.role === 'MANAGER') {
            const manager = await User.findById(req.user._id).select('team_ids').lean();
            allowedTeamIds = new Set((manager?.team_ids || []).map(id => id.toString()));
        }

        // Fetch ALL resource records from Streamline (paginated)
        let allResources = [];
        let page = 1;
        const pageLimit = 100;

        while (true) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            let pageData;
            try {
                const resp = await fetch(
                    `${streamlineUrl}/api/invoicing/resources?page=${page}&limit=${pageLimit}`,
                    { headers, signal: controller.signal }
                );
                clearTimeout(timeout);
                pageData = await resp.json();
            } catch (fetchErr) {
                clearTimeout(timeout);
                return res.status(502).json({ error: 'Streamline service unavailable', message: fetchErr.message });
            }

            const records = pageData.resources || pageData.data || [];
            allResources = allResources.concat(records);

            const pagination = pageData.pagination || {};
            const totalPages = pagination.pages || pagination.totalPages || 1;
            if (records.length < pageLimit || page >= totalPages) break;
            page++;
        }

        // Group resources by project, filtered to manager's teams
        const projectMap = {};

        for (const r of allResources) {
            // Normalize team info
            const teamObj = (r.team_id && typeof r.team_id === 'object') ? r.team_id : null;
            const teamId = teamObj?._id?.toString() || (typeof r.team_id === 'string' ? r.team_id : '');

            // Filter: managers only see their teams
            if (allowedTeamIds && allowedTeamIds.size > 0 && teamId && !allowedTeamIds.has(teamId)) continue;

            // Normalize project info
            const projObj = (r.project_id && typeof r.project_id === 'object') ? r.project_id : null;
            const projectId = projObj?._id?.toString() || (typeof r.project_id === 'string' ? r.project_id : null);
            if (!projectId) continue;

            // Normalize client info
            const clientObj = (r.client_id && typeof r.client_id === 'object')
                ? r.client_id
                : (r.client_master_id && typeof r.client_master_id === 'object')
                    ? r.client_master_id
                    : null;

            if (!projectMap[projectId]) {
                projectMap[projectId] = {
                    project_id: projectId,
                    project_name: (projObj?.project_name || r.project_name || '').trim(),
                    project_code: (projObj?.unique_id || projObj?.project_code || r.project_code || '').trim(),
                    client_id: clientObj?._id?.toString() || (typeof r.client_id === 'string' ? r.client_id : '') || '',
                    client_name: (clientObj?.client_name || clientObj?.name || r.client_name || '').trim(),
                    start_date: r.start_from || null,
                    end_date: r.end_date || null,
                    resources: [],
                };
            } else {
                // Expand date range if needed
                if (r.start_from) {
                    const s = new Date(r.start_from);
                    if (!projectMap[projectId].start_date || s < new Date(projectMap[projectId].start_date)) {
                        projectMap[projectId].start_date = r.start_from;
                    }
                }
                if (r.end_date) {
                    const e = new Date(r.end_date);
                    if (!projectMap[projectId].end_date || e > new Date(projectMap[projectId].end_date)) {
                        projectMap[projectId].end_date = r.end_date;
                    }
                }
            }

            // Normalize employee info
            const empName = (r.resource_name || r.employee_name || r.user_id?.full_name || r.user_id?.name || '').trim();
            const empEmail = (r.resource_email || r.employee_email || r.user_id?.email || '').toLowerCase().trim();
            const empCode = String(r.employee_code || r.resource_code || r.emp_id || r.unique_id || '').trim();
            const designation = (r.designation || r.resource_designation || '').trim();
            const teamName = (teamObj?.team_name || r.team_name || '').trim();

            if (empName || empEmail) {
                projectMap[projectId].resources.push({
                    name: empName,
                    email: empEmail,
                    emp_id: empCode,
                    designation,
                    team_name: teamName,
                    start_from: r.start_from || null,
                    end_date: r.end_date || null,
                });
            }
        }

        const projects = Object.values(projectMap).map(p => ({
            ...p,
            resource_count: p.resources.length,
        }));

        // Sort: most resources first
        projects.sort((a, b) => b.resource_count - a.resource_count);

        res.json({ success: true, data: projects, total: projects.length });
    } catch (err) {
        console.error('[Streamline my-resource-projects error]', err.message);
        res.status(500).json({ error: 'Failed to fetch resource projects', message: err.message });
    }
});

// ── POST /api/streamline/sync ─────────────────────────────────────────────────
// Full sync from Streamline360 Resource Master into ThinkSheet.
//
// Data hierarchy fetched:
//   Client Master → Project Master → Resource Intimation → Resource Master
//
// What it does per resource record:
//   1. Upsert Employee (by official_email + tenant_id)
//   2. Upsert EmployeeManagerMapping (by employee_id + project_id + tenant_id)
//      - Stores client_id, client_name, resource_start_date, resource_end_date
//      - Auto-matches a ThinkSheet MANAGER by email (from team's manager_ids)
//      - If no match found, manager_id is left null (admin can assign later)
//
// Returns: { employees_synced, mappings_synced, total_resources, errors[] }
router.post('/sync', authenticate, checkActive, authorize(['ADMINISTRATOR']), async (req, res) => {
    try {
        const { url: streamlineUrl } = getStreamlineConfig();
        const token = makeStreamlineToken();
        const tenantId = req.tenantIdString;
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

        // ── Step 1: Fetch ALL resource records (paginate through every page) ──
        let allResources = [];
        let page = 1;
        const pageLimit = 100;

        while (true) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            let pageData;
            try {
                const resp = await fetch(
                    `${streamlineUrl}/api/invoicing/resources?page=${page}&limit=${pageLimit}`,
                    { headers, signal: controller.signal }
                );
                clearTimeout(timeout);
                pageData = await resp.json();
            } catch (fetchErr) {
                clearTimeout(timeout);
                return res.status(502).json({ error: 'Streamline service unavailable', message: fetchErr.message });
            }

            // Support both { resources: [] } and { data: [] } response shapes
            const records = pageData.resources || pageData.data || [];
            allResources = allResources.concat(records);

            const pagination = pageData.pagination || {};
            const totalPages = pagination.pages || pagination.totalPages || 1;
            if (records.length < pageLimit || page >= totalPages) break;
            page++;
        }

        if (allResources.length === 0) {
            return res.json({
                success: true,
                data: { total_resources: 0, employees_synced: 0, mappings_synced: 0, errors: [] }
            });
        }

        // ── Step 2: Load all ThinkSheet MANAGER users for email-based matching ──
        const managers = await User.find({
            tenant_id: tenantId,
            role: 'MANAGER',
            is_active: true,
            is_deleted: { $ne: true }
        }).select('_id email').lean();

        const managerByEmail = {};
        managers.forEach(m => { managerByEmail[m.email.toLowerCase()] = m._id; });

        // ── Step 3: Process each resource record ──────────────────────────────
        const results = {
            total_resources: allResources.length,
            employees_synced: 0,
            mappings_synced: 0,
            errors: []
        };

        for (const r of allResources) {
            try {
                // ── Extract employee fields (handle multiple possible field names) ──
                const empName = (
                    r.resource_name ||
                    r.employee_name ||
                    r.user_id?.full_name ||
                    r.user_id?.name ||
                    ''
                ).trim();

                const empEmail = (
                    r.resource_email ||
                    r.employee_email ||
                    r.user_id?.email ||
                    ''
                ).toLowerCase().trim();

                const empCode = String(
                    r.employee_code || r.resource_code || r.emp_id || r.unique_id || ''
                ).trim();

                const designation = (r.designation || r.resource_designation || '').trim();

                if (!empEmail || !empName) {
                    results.errors.push({ resource_id: r._id, reason: 'Missing employee name or email' });
                    continue;
                }

                // ── Extract team + department ──────────────────────────────────
                const teamObj = (r.team_id && typeof r.team_id === 'object') ? r.team_id : null;
                const teamId = teamObj?._id?.toString() || (typeof r.team_id === 'string' ? r.team_id : '') || '';
                const teamName = (teamObj?.team_name || r.team_name || '').trim();

                const deptObj = (r.department_id && typeof r.department_id === 'object') ? r.department_id : null;
                const departmentId = deptObj?._id || (typeof r.department_id === 'string' ? r.department_id : null);

                // ── Upsert Employee record ─────────────────────────────────────
                const empUpdate = {
                    employee_name: empName,
                    designation,
                    team_id: teamId,
                    team_name: teamName,
                    is_active: true,
                    is_deleted: false,
                    tenant_id: tenantId,
                };
                if (empCode) empUpdate.unique_id = empCode;
                if (departmentId) empUpdate.department_id = departmentId;

                const empDoc = await Employee.findOneAndUpdate(
                    { official_email: empEmail, tenant_id: tenantId },
                    { $set: empUpdate, $setOnInsert: { official_email: empEmail, unique_id: empCode || empEmail.split('@')[0] } },
                    { upsert: true, new: true }
                );

                results.employees_synced++;

                // ── Extract project ────────────────────────────────────────────
                const projObj = (r.project_id && typeof r.project_id === 'object') ? r.project_id : null;
                const projectId = projObj?._id?.toString() || (typeof r.project_id === 'string' ? r.project_id : null);
                const projectName = (projObj?.project_name || r.project_name || '').trim();
                const projectCode = (projObj?.unique_id || projObj?.project_code || r.project_code || '').trim();

                if (!projectId) continue; // Skip — can't create a mapping without a project

                // ── Extract client ─────────────────────────────────────────────
                const clientObj = (r.client_id && typeof r.client_id === 'object')
                    ? r.client_id
                    : (r.client_master_id && typeof r.client_master_id === 'object')
                        ? r.client_master_id
                        : null;
                const clientId = clientObj?._id?.toString() || (typeof r.client_id === 'string' ? r.client_id : null);
                const clientName = (clientObj?.client_name || clientObj?.name || r.client_name || '').trim();

                // ── Extract Resource Intimation dates ──────────────────────────
                const resourceStartDate = r.start_from ? new Date(r.start_from) : null;
                const resourceEndDate = r.end_date ? new Date(r.end_date) : null;

                // ── Try to match a ThinkSheet MANAGER from team's manager_ids ──
                let managerId = null;
                const teamManagerIds = teamObj?.manager_ids || [];
                for (const tm of teamManagerIds) {
                    const tmEmail = (tm.email || '').toLowerCase().trim();
                    if (tmEmail && managerByEmail[tmEmail]) {
                        managerId = managerByEmail[tmEmail];
                        break;
                    }
                }

                // ── Upsert EmployeeManagerMapping ──────────────────────────────
                const setFields = {
                    project_name: projectName,
                    project_code: projectCode,
                    client_id: clientId,
                    client_name: clientName,
                    resource_start_date: resourceStartDate,
                    resource_end_date: resourceEndDate,
                    synced_from_streamline: true,
                    synced_at: new Date(),
                    is_active: true,
                };
                // Only overwrite manager if we found a match (preserve existing manual assignment)
                if (managerId) setFields.manager_id = managerId;

                await EmployeeManagerMapping.findOneAndUpdate(
                    { employee_id: empDoc._id, project_id: projectId, tenant_id: tenantId },
                    {
                        $set: setFields,
                        $setOnInsert: {
                            employee_id: empDoc._id,
                            project_id: projectId,
                            tenant_id: tenantId,
                            mapped_at: new Date(),
                            is_deleted: false,
                        }
                    },
                    { upsert: true, new: true }
                );

                results.mappings_synced++;
            } catch (rowErr) {
                results.errors.push({ resource_id: r._id, reason: rowErr.message });
            }
        }

        console.log(`[Streamline sync] tenant=${tenantId} resources=${results.total_resources} employees=${results.employees_synced} mappings=${results.mappings_synced} errors=${results.errors.length}`);
        res.json({ success: true, data: results });

    } catch (err) {
        console.error('[Streamline sync error]', err.message);
        res.status(500).json({ error: 'Sync failed', message: err.message });
    }
});

export default router;
