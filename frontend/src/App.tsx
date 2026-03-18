import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import EmployeeDashboardPage from "./pages/EmployeeDashboardPage";
import EmployeeProjectsPage from "./pages/EmployeeProjectsPage";
import EmployeeTimesheetPage from "./pages/EmployeeTimesheetPage";
import ManagerTimesheetReviewPage from "./pages/ManagerTimesheetReviewPage";
import EmployeeManagerMappingPage from "./pages/EmployeeManagerMappingPage";
import EmployeeManagementPage from "./pages/EmployeeManagementPage";
import ProjectDashboardPage from "./pages/ProjectDashboardPage";
import AdminProjectsDashboardPage from "./pages/AdminProjectsDashboardPage";
import AccountPage from "./pages/AccountPage";
import NotificationsPage from "./pages/NotificationsPage";

function RoleRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "ADMINISTRATOR") return <Navigate to="/timesheet/mapping" replace />;
  if (user.role === "MANAGER") return <Navigate to="/workspace?tab=projects" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />

      {/* Employee: dashboard → projects → timesheet */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute roles={["EMPLOYEE"]}>
            <EmployeeDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/projects"
        element={
          <ProtectedRoute roles={["EMPLOYEE"]}>
            <EmployeeProjectsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/timesheet/employee"
        element={
          <ProtectedRoute roles={["EMPLOYEE"]}>
            <EmployeeTimesheetPage />
          </ProtectedRoute>
        }
      />

      {/* Manager */}
      <Route
        path="/workspace"
        element={
          <ProtectedRoute roles={["MANAGER"]}>
            <EmployeeManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/timesheet/manager"
        element={
          <ProtectedRoute roles={["MANAGER"]}>
            <ManagerTimesheetReviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId"
        element={
          <ProtectedRoute roles={["MANAGER"]}>
            <ProjectDashboardPage />
          </ProtectedRoute>
        }
      />
      {/* Legacy redirects */}
      <Route path="/projects" element={<Navigate to="/workspace?tab=projects" replace />} />
      <Route path="/employees/manage" element={<Navigate to="/workspace?tab=employees" replace />} />

      {/* Admin */}
      <Route
        path="/timesheet/mapping"
        element={
          <ProtectedRoute roles={["ADMINISTRATOR"]}>
            <EmployeeManagerMappingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/projects"
        element={
          <ProtectedRoute roles={["ADMINISTRATOR"]}>
            <AdminProjectsDashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Notifications — Employee & Manager */}
      <Route
        path="/notifications"
        element={
          <ProtectedRoute roles={["EMPLOYEE", "MANAGER"]}>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />

      {/* Account — all roles */}
      <Route
        path="/account"
        element={
          <ProtectedRoute roles={["EMPLOYEE", "MANAGER", "ADMINISTRATOR"]}>
            <AccountPage />
          </ProtectedRoute>
        }
      />

      {/* Unauthorized */}
      <Route
        path="/unauthorized"
        element={
          <div className="min-h-screen flex items-center justify-center text-center p-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
              <p className="text-slate-500 mb-4">You don't have permission to view this page.</p>
              <a href="/login" className="text-[#217346] underline text-sm">Go to login</a>
            </div>
          </div>
        }
      />

      {/* Default: redirect based on role */}
      <Route path="*" element={<RoleRedirect />} />
    </Routes>
  );
}
