import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./db.js";
import timesheetRoutes from "./routes/timesheet.js";
import employeeMappingRoutes from "./routes/employeeMapping.js";
import authRoutes from "./routes/auth.js";
import seedRoutes from "./routes/seed.js";
import streamlineRoutes from "./routes/streamline.js";
import employeeRoutes from "./routes/employees.js";
import logRoutes from "./routes/logs.js";
import User from "./models/users/User.js";

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

/**
 * Ensures a default ADMINISTRATOR account exists.
 * Runs once on server startup — safe to call every time (idempotent).
 *
 * Credentials can be overridden via env vars:
 *   DEFAULT_ADMIN_EMAIL    (default: admin@thinkitive.com)
 *   DEFAULT_ADMIN_PASSWORD (default: Admin@2026)
 *   DEFAULT_ADMIN_NAME     (default: System Administrator)
 */
async function bootstrapAdmin() {
    const TENANT_ID = process.env.TENANT_ID || 'thinkitive_inc';
    const email     = (process.env.DEFAULT_ADMIN_EMAIL    || 'admin@thinkitive.com').toLowerCase();
    const password  = process.env.DEFAULT_ADMIN_PASSWORD  || 'Admin@2026';
    const full_name = process.env.DEFAULT_ADMIN_NAME      || 'System Administrator';

    const adminExists = await User.exists({
        role: 'ADMINISTRATOR',
        tenant_id: TENANT_ID,
        is_deleted: { $ne: true }
    });

    if (adminExists) return; // already have at least one admin — nothing to do

    await User.create({
        email,
        password,
        full_name,
        role: 'ADMINISTRATOR',
        tenant_id: TENANT_ID,
        is_active: true,
        must_change_password: false,
        permissions: {
            module_access: [
                { module_name: 'timesheet',         functions: ['view', 'create', 'edit', 'delete'], submodules: [] },
                { module_name: 'employee-mapping',  functions: ['view', 'create', 'edit', 'delete'], submodules: [] }
            ],
            can_approve_expenses: true,
            can_create_users: true,
            approval_limit: null
        }
    });

    console.log('─────────────────────────────────────────────────');
    console.log('  Default administrator account created');
    console.log(`  Email    : ${email}`);
    console.log(`  Password : ${password}`);
    console.log('  Change these credentials after first login.');
    console.log('─────────────────────────────────────────────────');
}

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/timesheet", timesheetRoutes);
app.use("/api/employee-mapping", employeeMappingRoutes);
app.use("/api/seed", seedRoutes);
app.use("/api/streamline", streamlineRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/logs", logRoutes);

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "thinksheet" }));

const PORT = process.env.PORT || 5001;

connectDB().then(async () => {
  await bootstrapAdmin();
  app.listen(PORT, () => {
    console.log(`ThinkSheet backend running on port ${PORT}`);
    console.log(`Streamline URL: ${process.env.STREAMLINE_URL}`);
  });
});
