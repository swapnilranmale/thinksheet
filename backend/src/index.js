import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./db.js";
import timesheetRoutes from "./routes/timesheet.js";
import employeeMappingRoutes from "./routes/employeeMapping.js";

dotenv.config();

const app = express();

app.use(cors({ origin: "http://localhost:3001", credentials: true }));
app.use(express.json());

app.use("/api/timesheets", timesheetRoutes);
app.use("/api/employee-manager-mappings", employeeMappingRoutes);

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "thinksheet" }));

const PORT = process.env.PORT || 5001;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`ThinkSheet backend running on port ${PORT}`);
    console.log(`Streamline API: ${process.env.STREAMLINE_API_URL || "http://localhost:5000/api"}`);
  });
});
