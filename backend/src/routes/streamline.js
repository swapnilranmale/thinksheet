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
import mongoose from 'mongoose';
import { authenticate, checkActive, authorize } from '../middlewares/auth.js';
import Employee from '../models/users/Employee.js';
import User from '../models/users/User.js';
import EmployeeManagerMapping from '../models/timesheet/EmployeeManagerMapping.js';

const router = express.Router();

// Read lazily so dotenv in index.js has time to load before these are evaluated
const getStreamlineConfig = () => ({
    url: process.env.STREAMLINE_URL,
    jwtSecret: process.env.STREAMLINE_JWT_SECRET,
    tenantId: process.env.STREAMLINE_TENANT_ID,
    serviceUserId: process.env.STREAMLINE_SERVICE_USER_ID,
    serviceEmail: process.env.STREAMLINE_SERVICE_EMAIL,
});

/** Generate a short-lived Streamline service token (expires in 1 hour) */
function makeStreamlineToken() {
    const { jwtSecret, tenantId, serviceUserId, serviceEmail } = getStreamlineConfig();

    if (!jwtSecret || !serviceUserId || !serviceEmail) {
        throw new Error('Missing required Streamline configuration: STREAMLINE_JWT_SECRET, STREAMLINE_SERVICE_USER_ID, or STREAMLINE_SERVICE_EMAIL');
    }

    return jwt.sign(
        {
            userId: serviceUserId,
            email: serviceEmail,
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
        res.set('Cache-Control', 'no-store');
        res.status(response.status).json(data);
    } catch (err) {
        console.error('[Streamline proxy error]', err.message, err.cause?.message, err.cause?.code);
        res.status(502).json({ error: 'Streamline service unavailable', message: err.message, cause: err.cause?.message });
    }
}

/**
 * Fetch ALL Streamline Employee Master records (paginated).
 * Returns two lookup maps:
 *   byId    — keyed by Streamline Employee Master _id string
 *   byEmail — keyed by lowercase email
 *
 * The `actual_resource_emp_id` / `profile_id` on resource records are
 * Streamline Employee Master _id values (NOT ThinkSheet IDs).
 * This lookup resolves them to name + email so we can find/create ThinkSheet employees.
 */
async function fetchStreamlineEmployeeMasters(streamlineUrl, headers) {
    const byId = {};
    const byEmail = {};
    const byEmpId = {}; // keyed by emp_id or unique_id (company employee code)
    // Streamline360 employee endpoint — try /api/employees first (primary), fallback to /api/employee_masters
    const ENDPOINTS = ['/api/employees', '/api/employee_masters'];
    for (const endpoint of ENDPOINTS) {
        let page = 1;
        const limit = 200;
        let fetched = 0;
        try {
            while (true) {
                const ctrl = new AbortController();
                const to = setTimeout(() => ctrl.abort(), 15000);
                let data;
                try {
                    const resp = await fetch(
                        `${streamlineUrl}${endpoint}?page=${page}&limit=${limit}`,
                        { headers, signal: ctrl.signal }
                    );
                    clearTimeout(to);
                    if (!resp.ok) break; // endpoint doesn't exist — try next
                    data = await resp.json();
                } catch (e) { clearTimeout(to); break; }

                // Support multiple response shapes: { employees: [] } | { data: [] } | { employee_masters: [] }
                const recs = data.employees || data.data || data.employee_masters || [];
                if (recs.length === 0) break;
                for (const se of recs) {
                    const id = String(se._id || '');
                    const email = (se.official_email || se.email || se.work_email || '').toLowerCase().trim();
                    const empId = String(se.emp_id || '').trim();
                    const uniqueId = String(se.unique_id || '').trim();
                    if (id) byId[id] = se;
                    if (email) byEmail[email] = se;
                    // Also index by company employee code (emp_id / unique_id) so resource records
                    // that store the code instead of MongoDB _id can still be resolved correctly.
                    if (empId) byEmpId[empId] = se;
                    if (uniqueId && uniqueId !== empId) byEmpId[uniqueId] = se;
                    fetched++;
                }
                const pg = data.pagination || {};
                const totalPages = pg.pages || pg.totalPages || 1;
                if (recs.length < limit || page >= totalPages) break;
                page++;
            }
        } catch (err) {
            console.warn(`[Streamline] Could not fetch from ${endpoint}:`, err.message);
        }
        if (fetched > 0) break; // got data — no need to try fallback endpoint
    }
    return { byId, byEmail, byEmpId };
}

/**
 * Resolve employee data from a Streamline resource record.
 *
 * Resolution priority:
 *  1. actual_resource_emp_id / actual_emp_id  → Streamline Employee Master by _id
 *  2. profile_id / ttpl_id                    → Streamline Employee Master by _id (fallback)
 *  3. Direct name/email fields on resource record
 *  4. ThinkSheet User._id lookup → email → ThinkSheet Employee (last resort)
 *
 * Returns { empName, empEmail, empCode, designation } or null if unresolvable.
 */
function resolveResourceEmployee(r, slEmpById, slEmpByEmail, slEmpByEmpId, tsUserMap, tsEmpByEmail) {
    // Streamline360 resource record field names:
    //   actual_resource_emp_ttpl_id — the ACTUAL worker (e.g. Nilesh Gorhe)  ← primary
    //   profile_ttpl_id             — the billing profile (e.g. Swapnil Ranmale) ← fallback
    // These may be a plain ID string, a MongoDB ObjectId, a company emp_id code,
    // or a populated object { _id, name, email }.
    const rawActual = r.actual_resource_emp_ttpl_id || r.actual_resource_emp_id || r.actual_emp_id
        || r.employee_id || r.resource_employee_id || null;
    const rawProf   = r.profile_ttpl_id || r.profile_id || r.ttpl_id || r.employee_profile_id || null;

    const actualId = rawActual && typeof rawActual === 'object'
        ? String(rawActual._id || '')
        : String(rawActual || '');
    const profId = rawProf && typeof rawProf === 'object'
        ? String(rawProf._id || '')
        : String(rawProf || '');

    // If the field was a populated object, extract inline name/email as high-priority fallback
    const actualObjName  = (rawActual && typeof rawActual === 'object')
        ? (rawActual.full_name || rawActual.name || rawActual.employee_name || '').trim() : '';
    const actualObjEmail = (rawActual && typeof rawActual === 'object')
        ? (rawActual.email || rawActual.official_email || '').toLowerCase().trim() : '';

    // Look up by MongoDB _id first (most precise), then fall back to company emp_id code.
    // This handles resource records that store the employee's emp_id instead of their _id.
    let slEmp = (actualId && (slEmpById[actualId] || slEmpByEmpId?.[actualId]))
        || (profId && (slEmpById[profId] || slEmpByEmpId?.[profId]))
        || null;

    // Try direct fields on resource record.
    // Streamline360 uses: actual_resource (worker name), profile_resource (billing name)
    const directName  = (r.actual_resource || r.resource_name || r.employee_name || r.user_id?.full_name || r.user_id?.name || '').trim();
    const directEmail = (r.resource_email  || r.employee_email || r.user_id?.email || '').toLowerCase().trim();

    // Try Streamline Employee Master by email (populated object email takes priority over direct fields)
    if (!slEmp && actualObjEmail) slEmp = slEmpByEmail[actualObjEmail] || null;
    if (!slEmp && directEmail) slEmp = slEmpByEmail[directEmail] || null;

    // Try ThinkSheet User lookup (in case TTPL IDs are ThinkSheet User _ids)
    let tsEmpFromUser = null;
    if (!slEmp) {
        const tsUser = (actualId && tsUserMap[actualId]) || (profId && tsUserMap[profId]) || null;
        if (tsUser) {
            const userEmail = tsUser.email?.toLowerCase().trim();
            if (userEmail) tsEmpFromUser = tsEmpByEmail[userEmail] || null;
            if (!slEmp && userEmail) slEmp = slEmpByEmail[userEmail] || null;
        }
    }

    const empName = (
        slEmp?.full_name || slEmp?.name || slEmp?.employee_name ||
        actualObjName || directName ||
        tsEmpFromUser?.employee_name || ''
    ).trim();

    const empEmail = (
        slEmp?.official_email || slEmp?.email || slEmp?.work_email ||
        actualObjEmail || directEmail ||
        tsEmpFromUser?.official_email || ''
    ).toLowerCase().trim();

    const empCode = String(
        slEmp?.emp_id || slEmp?.employee_id || slEmp?.unique_id ||
        r.employee_code || r.resource_code || r.emp_id ||
        tsEmpFromUser?.unique_id || r.unique_id || ''
    ).trim();

    const designation = (
        slEmp?.designation || slEmp?.job_title ||
        r.designation || r.resource_designation ||
        tsEmpFromUser?.designation || ''
    ).trim();

    return { empName, empEmail, empCode, designation };
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
// Only Engineering department teams are used in the Timesheet system.
router.get('/teams', authenticate, checkActive, async (req, res) => {
    try {
        const { url: streamlineUrl } = getStreamlineConfig();
        const token = makeStreamlineToken();
        const qs = new URLSearchParams(req.query).toString();
        const upstream = `${streamlineUrl}/api/teams${qs ? '?' + qs : ''}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const upstreamRes = await fetch(upstream, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            signal: controller.signal,
        });
        clearTimeout(timeout);

        const data = await upstreamRes.json();
        const allTeams = data.teams ?? [];
        const engineeringTeams = allTeams.filter(t =>
            t.department_id?.department_name?.toLowerCase().includes('engin')
        );
        console.log(`[streamline/teams] total=${allTeams.length} engineering=${engineeringTeams.length}`);
        res.set('Cache-Control', 'no-store');
        return res.json({ ...data, teams: engineeringTeams });
    } catch (err) {
        console.error('[streamline/teams] Error:', err.message);
        return res.status(502).json({ success: false, message: 'Failed to fetch teams from Streamline' });
    }
});

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

// ── GET /api/streamline/employee-masters ─────────────────────────────────────
// Streamline360 Employee Master list — used to get fresh employee data during sync
router.get('/employee-masters', authenticate, checkActive, (req, res) =>
    proxyGet('/api/employee_masters', req, res)
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

        // ── Build lookup maps for employee resolution ─────────────────────────
        //
        // actual_resource_emp_id / profile_id on resource records are Streamline
        // Employee Master _id values. We build three lookup maps:
        //   1. Streamline Employee Master by _id  (primary path)
        //   2. ThinkSheet User by _id             (fallback — in case IDs are ThinkSheet User IDs)
        //   3. ThinkSheet Employee by email        (used after resolving email from User)

        // 1. Fetch Streamline Employee Masters (resolves TTPL IDs → name/email)
        const { byId: slEmpById, byEmail: slEmpByEmail, byEmpId: slEmpByEmpId } =
            await fetchStreamlineEmployeeMasters(streamlineUrl, headers);

        // 2 & 3. Collect all candidate IDs → lookup ThinkSheet Users + Employees
        const candidateIds = new Set();
        for (const r of allResources) {
            const rawA = r.actual_resource_emp_ttpl_id || r.actual_resource_emp_id || r.actual_emp_id || null;
            const rawP = r.profile_ttpl_id || r.profile_id || r.ttpl_id || r.employee_profile_id || null;
            const aid = rawA && typeof rawA === 'object' ? String(rawA._id || '') : String(rawA || '');
            const pid = rawP && typeof rawP === 'object' ? String(rawP._id || '') : String(rawP || '');
            if (aid && mongoose.Types.ObjectId.isValid(aid)) candidateIds.add(aid);
            if (pid && mongoose.Types.ObjectId.isValid(pid)) candidateIds.add(pid);
        }

        const tsUserMap = {};      // ThinkSheet User by _id
        const tsEmpByEmail = {};   // ThinkSheet Employee by email
        if (candidateIds.size > 0) {
            const tsUsers = await User.find({ _id: { $in: [...candidateIds] } })
                .select('_id email full_name').lean();
            tsUsers.forEach(u => { tsUserMap[u._id.toString()] = u; });

            const userEmails = tsUsers.map(u => u.email?.toLowerCase()).filter(Boolean);
            if (userEmails.length > 0) {
                const tsEmps = await Employee.find({ official_email: { $in: userEmails } })
                    .select('_id employee_name official_email designation unique_id team_name').lean();
                tsEmps.forEach(e => { tsEmpByEmail[e.official_email] = e; });
            }
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

            // Resolve employee using all available lookup maps
            const { empName, empEmail, empCode, designation } =
                resolveResourceEmployee(r, slEmpById, slEmpByEmail, slEmpByEmpId, tsUserMap, tsEmpByEmail);

            const teamName = (teamObj?.team_name || r.team || r.team_name || '').trim();
            // Streamline Resource ID (e.g. "UPID-26-18-1") — field is resource_id on the record
            const resourceId = String(r.resource_id || r.unique_id || '').trim();

            // Include the resource if we have any identifying information
            if (empName || empEmail || resourceId) {
                projectMap[projectId].resources.push({
                    name: empName,
                    email: empEmail,
                    emp_id: empCode,
                    resource_id: resourceId,
                    designation,
                    team_name: teamName,
                    start_from: r.start_from || null,
                    end_date: r.end_date || null,
                    is_active: r.active === true || (String(r.status || r.active_status || 'ACTIVE')).toUpperCase() === 'ACTIVE',
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
// Matches all common engineering manager designation variants:
// "Engineering Manager", "Engineering Mgr", "Engg Manager", "Engg. Manager", etc.
const ENGG_MANAGER_RE = /engg\.?\s*manager|engineering\s+(manager|mgr)/i;

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
                data: { total_resources: 0, employees_synced: 0, new_employees_count: 0, mappings_synced: 0, errors: [], synced_employees: [], is_first_sync: false }
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

        // ── Step 3: Build employee lookup maps ────────────────────────────────
        //
        // actual_resource_emp_id / profile_id are Streamline Employee Master _ids.
        // We use three lookup strategies (in priority order):
        //   1. Streamline Employee Master by _id  → authoritative name/email
        //   2. ThinkSheet User by _id              → get email → find Employee
        //   3. Direct fields on resource record    → last resort

        // Fetch Streamline Employee Masters (primary resolution source)
        const { byId: slEmpById, byEmail: slEmpByEmail, byEmpId: slEmpByEmpId } =
            await fetchStreamlineEmployeeMasters(streamlineUrl, headers);

        console.log(`[Sync] Streamline Employee Masters fetched: ${Object.keys(slEmpById).length}`);

        // ── Step 2b: Pre-fetch Streamline teams for team name + manager resolution ─
        // Resource records store team as "team" (plain name string, e.g. "JAVA") — no team_id field.
        // Build byId AND byName maps so we can look up manager_ids by team name.
        const streamlineTeamMap = {};     // keyed by team _id string
        const streamlineTeamByName = {}; // keyed by lowercase team name
        try {
            const teamCtrl = new AbortController();
            const teamTo = setTimeout(() => teamCtrl.abort(), 15000);
            const teamResp = await fetch(`${streamlineUrl}/api/teams?page=1&limit=500`, { headers, signal: teamCtrl.signal });
            clearTimeout(teamTo);
            if (teamResp.ok) {
                const teamData = await teamResp.json();
                (teamData.teams || []).forEach(t => {
                    streamlineTeamMap[String(t._id)] = t;
                    if (t.team_name) streamlineTeamByName[t.team_name.toLowerCase().trim()] = t;
                });
                console.log(`[Sync] Streamline teams fetched: ${Object.keys(streamlineTeamMap).length}`);
            }
        } catch (e) {
            console.warn('[Streamline sync] Could not pre-fetch teams:', e.message);
        }

        // Collect candidate IDs for ThinkSheet User fallback lookup
        const syncCandidateIds = new Set();
        for (const r of allResources) {
            const rawA = r.actual_resource_emp_ttpl_id || r.actual_resource_emp_id || r.actual_emp_id || null;
            const rawP = r.profile_ttpl_id || r.profile_id || r.ttpl_id || r.employee_profile_id || null;
            const aid = rawA && typeof rawA === 'object' ? String(rawA._id || '') : String(rawA || '');
            const pid = rawP && typeof rawP === 'object' ? String(rawP._id || '') : String(rawP || '');
            if (aid && mongoose.Types.ObjectId.isValid(aid)) syncCandidateIds.add(aid);
            if (pid && mongoose.Types.ObjectId.isValid(pid)) syncCandidateIds.add(pid);
        }

        const syncTsUserMap = {};
        const syncTsEmpByEmail = {};
        if (syncCandidateIds.size > 0) {
            const tsUsers = await User.find({ _id: { $in: [...syncCandidateIds] } })
                .select('_id email full_name').lean();
            tsUsers.forEach(u => { syncTsUserMap[u._id.toString()] = u; });

            const userEmails = tsUsers.map(u => u.email?.toLowerCase()).filter(Boolean);
            if (userEmails.length > 0) {
                const tsEmps = await Employee.find({ official_email: { $in: userEmails }, tenant_id: tenantId })
                    .select('_id employee_name official_email designation unique_id').lean();
                tsEmps.forEach(e => { syncTsEmpByEmail[e.official_email] = e; });
            }
        }

        // ── Step 4: Process each resource record ──────────────────────────────
        // Detect first-time sync: if no employees exist for this tenant yet
        const existingEmployeeCount = await Employee.countDocuments({ tenant_id: tenantId, is_deleted: { $ne: true } });
        const isFirstSync = existingEmployeeCount === 0;

        const results = {
            total_resources: allResources.length,
            employees_synced: 0,
            new_employees_count: 0,  // count of employees newly inserted (not updated)
            mappings_synced: 0,
            errors: [],
            synced_employees: [], // list of newly added employees only
            is_first_sync: isFirstSync,
        };
        const resourceSyncedCodes = new Set(); // track emp codes synced via resource records

        for (const r of allResources) {
            try {
                // Resolve employee using all available lookup maps
                const { empName, empEmail, empCode, designation } =
                    resolveResourceEmployee(r, slEmpById, slEmpByEmail, slEmpByEmpId, syncTsUserMap, syncTsEmpByEmail);

                if (!empEmail || !empName) {
                    results.errors.push({ resource_id: r._id, reason: 'Missing employee name or email' });
                    continue;
                }

                // ── Extract team + department ──────────────────────────────────
                // Resource Master stores team as "team" (plain name string, e.g. "JAVA").
                // There is no team_id field on the resource record.
                const teamObj = (r.team_id && typeof r.team_id === 'object') ? r.team_id : null;
                const teamId = teamObj?._id?.toString() || (typeof r.team_id === 'string' ? r.team_id : '') || '';
                // Team name: use the direct "team" field, fall back to populated object or team_name
                const teamName = (r.team || teamObj?.team_name || r.team_name || '').trim();
                // Look up the team object by name (since resource records have no team_id)
                const resolvedTeam = teamObj
                    || (teamId ? streamlineTeamMap[teamId] : null)
                    || (teamName ? streamlineTeamByName[teamName.toLowerCase()] : null);

                const deptObj = (r.department_id && typeof r.department_id === 'object') ? r.department_id : null;
                const departmentId = deptObj?._id || (typeof r.department_id === 'string' ? r.department_id : null);

                // ── Upsert Employee record ─────────────────────────────────────
                // Use unique_id (Streamline employee ID) as primary key to prevent duplicates
                // Fallback to email for backward compatibility if unique_id is not available

                if (!empCode) {
                    results.errors.push({
                        resource_id: r._id,
                        reason: 'Cannot sync: Streamline employee code (emp_id/unique_id) not found'
                    });
                    continue;
                }

                // Extract Profile Resource and Actual Resource from resource record
                const rawProf = r.profile_ttpl_id || r.profile_id || r.ttpl_id || r.employee_profile_id || null;
                const profileResource = (
                    (rawProf && typeof rawProf === 'object'
                        ? (rawProf.full_name || rawProf.name || rawProf.employee_name || '')
                        : (r.profile_resource || ''))
                ).trim();
                const actualResource = (r.actual_resource || '').trim();
                const resourceId = String(r.resource_id || '').trim();

                // Use resolvedTeam._id for team_id if available (resource records have no team_id)
                const resolvedTeamId = resolvedTeam?._id?.toString() || teamId || '';

                // Check if this employee was locally modified by an admin/manager.
                // If so, only update Streamline-specific fields (resource data) and
                // preserve user-edited fields (name, designation, team).
                const existingEmp = await Employee.findOne({ unique_id: empCode, tenant_id: tenantId }).lean();
                const isLocallyModified = existingEmp?.locally_modified === true;

                let empUpdate;
                if (isLocallyModified) {
                    // Preserve local edits — only sync Streamline resource fields
                    empUpdate = {
                        profile_resource: profileResource,
                        actual_resource: actualResource,
                        resource_id: resourceId,
                        synced_from_streamline: true,
                        is_active: true,
                        is_deleted: false,
                        tenant_id: tenantId,
                    };
                } else {
                    // No local edits — full sync from Streamline
                    empUpdate = {
                        employee_name: empName,
                        official_email: empEmail,
                        designation,
                        team_id: resolvedTeamId,
                        team_name: teamName,
                        profile_resource: profileResource,
                        actual_resource: actualResource,
                        resource_id: resourceId,
                        synced_from_streamline: true,
                        is_engineering_manager: ENGG_MANAGER_RE.test(designation),
                        is_active: true,
                        is_deleted: false,
                        tenant_id: tenantId,
                    };
                }
                if (!isLocallyModified && departmentId) empUpdate.department_id = departmentId;

                let empDoc = null;
                try {
                    // Primary upsert: by unique_id + tenant_id (the Streamline employee ID)
                    // For new employees: $setOnInsert adds unique_id + all Streamline fields
                    const empRaw = await Employee.findOneAndUpdate(
                        { unique_id: empCode, tenant_id: tenantId },
                        { $set: empUpdate, $setOnInsert: { unique_id: empCode } },
                        { upsert: true, new: true, includeResultMetadata: true }
                    );
                    empDoc = empRaw.value;
                    const isNewEmployee = !empRaw.lastErrorObject?.updatedExisting;

                    results.employees_synced++;
                    resourceSyncedCodes.add(empCode);
                    if (isNewEmployee) {
                        results.new_employees_count++;
                        results.synced_employees.push({ name: empName, email: empEmail, unique_id: empCode });
                    }
                } catch (upsertErr) {
                    // If upsert fails due to unique constraint, try fallback: check by email
                    // This handles edge cases where unique_id conflicts with existing data
                    if (upsertErr.code === 11000 || upsertErr.message?.includes('unique')) {
                        console.warn(
                            `[Streamline sync] Unique constraint violation for unique_id="${empCode}". ` +
                            `Attempting fallback: lookup by email="${empEmail}"`
                        );
                        try {
                            // Find by email first
                            const existingByEmail = await Employee.findOne({
                                official_email: empEmail,
                                tenant_id: tenantId
                            });

                            if (existingByEmail) {
                                // Employee exists by email - check if unique_id is different
                                if (existingByEmail.unique_id !== empCode) {
                                    console.warn(
                                        `[Streamline sync] Employee email="${empEmail}" has existing unique_id="${existingByEmail.unique_id}", ` +
                                        `but Streamline reports unique_id="${empCode}". Keeping existing unique_id to avoid conflicts.`
                                    );
                                    // Update fields except unique_id to avoid conflict
                                    empDoc = await Employee.findByIdAndUpdate(
                                        existingByEmail._id,
                                        { $set: empUpdate },
                                        { new: true }
                                    );
                                } else {
                                    // unique_id matches, safe to update
                                    empDoc = await Employee.findByIdAndUpdate(
                                        existingByEmail._id,
                                        { $set: empUpdate },
                                        { new: true }
                                    );
                                }
                                results.employees_synced++;
                                resourceSyncedCodes.add(empCode);
                                // Not a new employee (found by email fallback) — do not add to synced_employees
                            } else {
                                // No employee by email and unique_id conflict - cannot proceed safely
                                results.errors.push({
                                    resource_id: r._id,
                                    reason: `Unique constraint conflict on unique_id="${empCode}" and no matching employee by email="${empEmail}". ` +
                                           `This suggests duplicate employee codes in Streamline or data corruption.`
                                });
                                continue;
                            }
                        } catch (fallbackErr) {
                            results.errors.push({
                                resource_id: r._id,
                                reason: `Failed to sync employee (${empName}/${empEmail}): ${fallbackErr.message}`
                            });
                            continue;
                        }
                    } else {
                        // Different error - re-throw
                        throw upsertErr;
                    }
                }

                // If empDoc is still null, skip mapping (error was already recorded)
                if (!empDoc) continue;

                // ── Ensure User credentials exist for this employee ────────────
                // Engineering Managers → MANAGER role, everyone else → EMPLOYEE.
                // Default password: Think@2026 (user must change on first login).
                // If a User already exists for this email it is left unchanged.
                const isEngineeringManager = ENGG_MANAGER_RE.test(designation);
                try {
                    const existingUser = await User.findOne({
                        email: empEmail.toLowerCase(),
                        tenant_id: tenantId,
                        is_deleted: { $ne: true }
                    });
                    if (!existingUser) {
                        const newUser = await User.create({
                            email: empEmail.toLowerCase(),
                            password: 'Think@2026',  // default password — forced change on first login
                            full_name: empName,
                            role: isEngineeringManager ? 'MANAGER' : 'EMPLOYEE',
                            tenant_id: tenantId,
                            designation,
                            team_ids: isEngineeringManager && resolvedTeamId ? [resolvedTeamId] : [],
                            is_active: true,
                            is_deleted: false,
                            must_change_password: true,
                            permissions: isEngineeringManager ? {
                                module_access: [
                                    { module_name: 'timesheet', functions: ['view'], submodules: [] }
                                ],
                                can_approve_expenses: false,
                                can_create_users: false,
                                approval_limit: null
                            } : {
                                module_access: [
                                    { module_name: 'timesheet', functions: ['view', 'create', 'edit'], submodules: [] }
                                ],
                                can_approve_expenses: false,
                                can_create_users: false,
                                approval_limit: null
                            }
                        });
                        // Keep managerByEmail map up-to-date so subsequent resource records
                        // in this same sync can immediately use the newly created manager.
                        if (isEngineeringManager) {
                            managerByEmail[empEmail.toLowerCase()] = newUser._id;
                        }
                    } else {
                        // Existing user: update role/team if needed, and fix password for users
                        // who never logged in (still have must_change_password: true).
                        let changed = false;

                        // Reset password to standard default if user never changed it
                        if (existingUser.must_change_password) {
                            existingUser.password = 'Think@2026';
                            existingUser.markModified('password');
                            changed = true;
                        }

                        if (isEngineeringManager) {
                            if (existingUser.role !== 'MANAGER') {
                                existingUser.role = 'MANAGER';
                                existingUser.permissions = {
                                    module_access: [
                                        { module_name: 'timesheet', functions: ['view'], submodules: [] }
                                    ],
                                    can_approve_expenses: false,
                                    can_create_users: false,
                                    approval_limit: null
                                };
                                changed = true;
                            }
                            if (resolvedTeamId && !existingUser.team_ids.includes(resolvedTeamId)) {
                                existingUser.team_ids = [...new Set([...existingUser.team_ids, resolvedTeamId])];
                                changed = true;
                            }
                            managerByEmail[empEmail.toLowerCase()] = existingUser._id;
                        }

                        if (changed) await existingUser.save();
                    }
                } catch (userErr) {
                    // Non-fatal: log but continue — employee record already saved
                    console.warn(`[Streamline sync] Could not create User for ${empEmail}: ${userErr.message}`);
                }

                // ── Extract project ────────────────────────────────────────────
                const projObj = (r.project_id && typeof r.project_id === 'object') ? r.project_id : null;
                const projectId = projObj?._id?.toString() || (typeof r.project_id === 'string' ? r.project_id : null);
                const projectName = (projObj?.project_name || r.project_name || '').trim();
                const projectCode = (projObj?.unique_id || projObj?.project_code || r.project_code || '').trim();

                console.log(`[Streamline sync] Resource project_id extraction - raw: ${JSON.stringify(r.project_id)}, projObj: ${projObj ? 'exists' : 'null'}, projectId: ${projectId}`);

                if (!projectId) {
                    console.warn(`[Streamline sync] Skipping mapping for employee=${empDoc._id} (project_id missing from resource)`);
                    continue;
                }

                console.log(`[Streamline sync] Creating mapping: employee=${empDoc._id} project=${projectId} tenant=${tenantId}`);

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
                const teamManagerIds = resolvedTeam?.manager_ids || [];
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
                console.error(`[Streamline sync] Error processing resource=${r._id}:`, rowErr.message, rowErr.stack);
                results.errors.push({
                    resource_id: r._id,
                    reason: rowErr.message,
                    error_code: rowErr.code,
                    error_name: rowErr.name
                });
            }
        }

        // ── Step 5: Sync remaining employees from Streamline Employee Master ─────
        // Employees who have no resource records (no project assignments) are not
        // imported by the resource loop above. Sync them here so all employees in
        // the Employee Master appear in ThinkSheet (without project mappings).
        const allSlEmps = Object.values(slEmpById);
        for (const slEmp of allSlEmps) {
            const empCode2 = String(slEmp.emp_id || slEmp.unique_id || '').trim();
            if (!empCode2 || resourceSyncedCodes.has(empCode2)) continue;

            const empName2 = (slEmp.employee_name || slEmp.full_name || slEmp.name || '').trim();
            const empEmail2 = (slEmp.official_email || slEmp.email || slEmp.work_email || '').toLowerCase().trim();
            if (!empName2 || !empEmail2) continue;

            const designation2 = (slEmp.designation || slEmp.job_title || '').trim();
            const isEngineeringManager2 = ENGG_MANAGER_RE.test(designation2);
            const rawTeamId2 = typeof slEmp.team_id === 'object'
                ? String(slEmp.team_id?._id || '')
                : String(slEmp.team_id || '').trim();
            const teamName2 = (rawTeamId2 && streamlineTeamMap[rawTeamId2]?.team_name) || '';

            try {
                // Check if locally modified — preserve user-edited fields
                const existingEmp2 = await Employee.findOne({ unique_id: empCode2, tenant_id: tenantId }).lean();
                const isLocallyModified2 = existingEmp2?.locally_modified === true;

                const empSet2 = isLocallyModified2
                    ? {
                        // Locally modified: only sync system fields, preserve user edits
                        synced_from_streamline: true,
                        is_active: true,
                        is_deleted: false,
                        tenant_id: tenantId,
                    }
                    : {
                        // Full sync from Streamline
                        employee_name: empName2,
                        official_email: empEmail2,
                        designation: designation2,
                        team_id: rawTeamId2,
                        team_name: teamName2,
                        synced_from_streamline: true,
                        is_engineering_manager: isEngineeringManager2,
                        is_active: true,
                        is_deleted: false,
                        tenant_id: tenantId,
                    };

                const empRaw2 = await Employee.findOneAndUpdate(
                    { unique_id: empCode2, tenant_id: tenantId },
                    {
                        $set: empSet2,
                        $setOnInsert: { unique_id: empCode2 }
                    },
                    { upsert: true, new: true, includeResultMetadata: true }
                );
                const isNewEmp2 = !empRaw2.lastErrorObject?.updatedExisting;

                // Ensure User credentials exist for ALL employees from Employee Master.
                // Engineering Managers → MANAGER role, everyone else → EMPLOYEE.
                // Default password: Think@2026 (forced change on first login).
                try {
                    const existingUser2 = await User.findOne({
                        email: empEmail2.toLowerCase(),
                        tenant_id: tenantId,
                        is_deleted: { $ne: true }
                    });
                    if (!existingUser2) {
                        const newUser2 = await User.create({
                            email: empEmail2.toLowerCase(),
                            password: 'Think@2026',
                            full_name: empName2,
                            role: isEngineeringManager2 ? 'MANAGER' : 'EMPLOYEE',
                            tenant_id: tenantId,
                            designation: designation2,
                            team_ids: isEngineeringManager2 && rawTeamId2 ? [rawTeamId2] : [],
                            is_active: true,
                            is_deleted: false,
                            must_change_password: true,
                            permissions: isEngineeringManager2 ? {
                                module_access: [
                                    { module_name: 'timesheet', functions: ['view'], submodules: [] }
                                ],
                                can_approve_expenses: false,
                                can_create_users: false,
                                approval_limit: null
                            } : {
                                module_access: [
                                    { module_name: 'timesheet', functions: ['view', 'create', 'edit'], submodules: [] }
                                ],
                                can_approve_expenses: false,
                                can_create_users: false,
                                approval_limit: null
                            }
                        });
                        if (isEngineeringManager2) {
                            managerByEmail[empEmail2.toLowerCase()] = newUser2._id;
                        }
                        console.log(`[Streamline sync] User credentials created (Employee Master): ${empName2} (${empCode2}) role=${newUser2.role}`);
                    } else {
                        // Existing user: fix password if never changed, promote to MANAGER if needed
                        let changed2 = false;

                        if (existingUser2.must_change_password) {
                            existingUser2.password = 'Think@2026';
                            existingUser2.markModified('password');
                            changed2 = true;
                        }

                        if (isEngineeringManager2 && existingUser2.role !== 'MANAGER') {
                            existingUser2.role = 'MANAGER';
                            existingUser2.permissions = {
                                module_access: [
                                    { module_name: 'timesheet', functions: ['view'], submodules: [] }
                                ],
                                can_approve_expenses: false,
                                can_create_users: false,
                                approval_limit: null
                            };
                            changed2 = true;
                        }
                        if (isEngineeringManager2 && rawTeamId2 && !existingUser2.team_ids.includes(rawTeamId2)) {
                            existingUser2.team_ids = [...new Set([...existingUser2.team_ids, rawTeamId2])];
                            changed2 = true;
                        }
                        if (isEngineeringManager2) {
                            managerByEmail[empEmail2.toLowerCase()] = existingUser2._id;
                        }

                        if (changed2) await existingUser2.save();
                    }
                } catch (userErr2) {
                    console.warn(`[Streamline sync] Could not create/update User for ${empEmail2}: ${userErr2.message}`);
                }

                results.employees_synced++;
                if (isNewEmp2) {
                    results.new_employees_count++;
                    results.synced_employees.push({ name: empName2, email: empEmail2, unique_id: empCode2 });
                }
                console.log(`[Streamline sync] Employee Master sync: ${empName2} (${empCode2}) isManager=${isEngineeringManager2}`);
            } catch (e) {
                if (e.code === 11000) {
                    // Email unique constraint — employee exists with different empCode
                    try {
                        const existingByEmail2 = await Employee.findOne({ official_email: empEmail2, tenant_id: tenantId });
                        if (existingByEmail2) {
                            await Employee.findByIdAndUpdate(existingByEmail2._id, {
                                $set: { employee_name: empName2, designation: designation2 }
                            });
                            results.employees_synced++;
                            // Not a new employee (found by email fallback) — do not add to synced_employees
                        }
                    } catch (e2) {
                        console.warn(`[Streamline sync] Employee Master fallback error for ${empEmail2}:`, e2.message);
                    }
                } else {
                    console.warn(`[Streamline sync] Employee Master sync error for ${empEmail2}:`, e.message);
                }
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
