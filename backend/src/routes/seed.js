/**
 * Seed Route — DEV ONLY
 * POST /api/seed  — insert sample employees for testing
 * Blocked in production (NODE_ENV=production)
 */
import express from 'express';
import Employee from '../models/users/Employee.js';

const router = express.Router();

router.post('/', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Seed endpoint disabled in production' });
    }

    try {
        const TENANT = process.env.TENANT_ID || 'thinkitive_inc';

        const employees = [
            { tenant_id: TENANT, employee_name: 'Rahul Sharma', official_email: 'rahul@thinkitive.com', unique_id: 'EMP001', designation: 'Software Engineer' },
            { tenant_id: TENANT, employee_name: 'Priya Patel',  official_email: 'priya@thinkitive.com',  unique_id: 'EMP002', designation: 'UI Designer' },
            { tenant_id: TENANT, employee_name: 'Amit Joshi',   official_email: 'amit@thinkitive.com',   unique_id: 'EMP003', designation: 'QA Engineer' },
            { tenant_id: TENANT, employee_name: 'Neha Singh',   official_email: 'neha@thinkitive.com',   unique_id: 'EMP004', designation: 'Backend Developer' },
        ];

        const results = [];
        for (const emp of employees) {
            const existing = await Employee.findOne({ official_email: emp.official_email, tenant_id: TENANT });
            results.push(existing ? `${emp.employee_name} (already exists)` : (await Employee.create(emp)).employee_name);
        }

        res.json({ success: true, message: 'Seed complete', employees: results });
    } catch (err) {
        res.status(500).json({ error: 'Seed failed', message: err.message });
    }
});

export default router;
