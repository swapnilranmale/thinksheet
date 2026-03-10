import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./db.js";
import timesheetRoutes from "./routes/timesheet.js";
import employeeMappingRoutes from "./routes/employeeMapping.js";
import authRoutes from "./routes/auth.js";
import seedRoutes from "./routes/seed.js";
import streamlineRoutes from "./routes/streamline.js";

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const app = express();

app.use(cors({ origin: ["http://localhost:3001", "http://localhost:3002"], credentials: true }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/timesheet", timesheetRoutes);
app.use("/api/employee-mapping", employeeMappingRoutes);
app.use("/api/seed", seedRoutes);
app.use("/api/streamline", streamlineRoutes);

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "thinksheet" }));

const PORT = process.env.PORT || 5001;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`ThinkSheet backend running on port ${PORT}`);
    console.log(`Streamline URL: ${process.env.STREAMLINE_URL}`);
  });
});
