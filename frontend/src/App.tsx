import { Routes, Route, Navigate } from "react-router-dom";
import EmployeeTimesheetPage from "./pages/EmployeeTimesheetPage";
import ManagerTimesheetReviewPage from "./pages/ManagerTimesheetReviewPage";
import EmployeeManagerMappingPage from "./pages/EmployeeManagerMappingPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/timesheet/employee" replace />} />
      <Route path="/timesheet/employee" element={<EmployeeTimesheetPage />} />
      <Route path="/timesheet/manager" element={<ManagerTimesheetReviewPage />} />
      <Route path="/timesheet/mapping" element={<EmployeeManagerMappingPage />} />
    </Routes>
  );
}
