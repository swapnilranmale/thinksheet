import { useState, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Clock,
  Users,
  LogOut,
  Menu,
  LayoutDashboard,
  Shield,
  ChevronRight,
  X,
  ScrollText,
  FolderOpen,
} from "lucide-react";
import { clsx } from "clsx";

// ── Sidebar nav link ──────────────────────────────────────────────────────────

function SidebarLink({
  to,
  icon: Icon,
  label,
  onClick,
  exact,
}: {
  to: string;
  icon: React.FC<{ className?: string }>;
  label: string;
  onClick?: () => void;
  exact?: boolean;
}) {
  const location = useLocation();
  // Match by pathname + optional search param
  const [path, search] = to.split("?");
  const isActive = exact
    ? location.pathname === path && (!search || location.search.includes(search))
    : location.pathname.startsWith(path) && (!search || location.search.includes(search));

  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
        isActive
          ? "bg-white/15 text-white"
          : "text-white/60 hover:bg-white/8 hover:text-white/90"
      )}
    >
      <div
        className={clsx(
          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
          isActive ? "bg-white/20" : "bg-white/8 group-hover:bg-white/15"
        )}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      <span className="flex-1 text-left">{label}</span>
      {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
    </button>
  );
}

// ── Main Layout ───────────────────────────────────────────────────────────────

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const roleLabel: Record<string, string> = {
    ADMINISTRATOR: "Administrator",
    MANAGER: "Manager",
    EMPLOYEE: "Employee",
  };

  const roleBg: Record<string, string> = {
    ADMINISTRATOR: "bg-amber-500/20 text-amber-300",
    MANAGER: "bg-blue-500/20 text-blue-300",
    EMPLOYEE: "bg-emerald-500/20 text-emerald-300",
  };

  function handleNavClick(to: string) {
    const [path, search] = to.split("?");
    navigate(search ? `${path}?${search}` : path);
    setMobileOpen(false);
  }

  const Sidebar = () => (
    <aside className="w-64 flex flex-col h-full bg-[#0f1923] relative">
      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#217346] via-emerald-400 to-transparent" />

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="w-9 h-9 rounded-xl bg-[#217346] flex items-center justify-center shrink-0 shadow-lg shadow-[#217346]/30">
          <Clock className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white leading-tight">ThinkSheet</p>
          <p className="text-[11px] text-white/40 leading-tight truncate">{user?.tenant_id || "default"}</p>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-white/8 mb-3" />

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {user?.role === "EMPLOYEE" && (
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold px-3 pt-2 pb-1.5">
              My Workspace
            </p>
            <SidebarLink
              to="/dashboard"
              icon={LayoutDashboard}
              label="My Projects"
              onClick={() => handleNavClick("/dashboard")}
              exact
            />
            <SidebarLink
              to="/timesheet/employee"
              icon={Clock}
              label="Timesheet"
              onClick={() => handleNavClick("/timesheet/employee")}
            />
          </div>
        )}

        {user?.role === "MANAGER" && (
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold px-3 pt-2 pb-1.5">
              Operations
            </p>
            <SidebarLink
              to="/projects"
              icon={FolderOpen}
              label="My Projects"
              onClick={() => handleNavClick("/projects")}
              exact={false}
            />
            <SidebarLink
              to="/employees/manage"
              icon={Users}
              label="My Employees"
              onClick={() => handleNavClick("/employees/manage")}
            />
          </div>
        )}

        {user?.role === "ADMINISTRATOR" && (
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold px-3 pt-2 pb-1.5">
              Administration
            </p>
            <SidebarLink
              to="/timesheet/mapping?tab=managers"
              icon={Shield}
              label="Managers"
              onClick={() => handleNavClick("/timesheet/mapping?tab=managers")}
            />
            <SidebarLink
              to="/timesheet/mapping?tab=employees"
              icon={Users}
              label="Employees"
              onClick={() => handleNavClick("/timesheet/mapping?tab=employees")}
            />
            <SidebarLink
              to="/timesheet/mapping?tab=logs"
              icon={ScrollText}
              label="Activity Logs"
              onClick={() => handleNavClick("/timesheet/mapping?tab=logs")}
            />
          </div>
        )}
      </nav>

      {/* User card + logout */}
      <div className="mx-3 mb-3 mt-2">
        <div className="bg-white/6 rounded-xl p-3">
          <div className="flex items-center gap-2.5 mb-3">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-[#217346] flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-xs font-bold text-white">
                {user?.full_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate leading-tight">{user?.full_name}</p>
              <span
                className={clsx(
                  "inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5",
                  roleBg[user?.role || ""] || "bg-white/10 text-white/50"
                )}
              >
                {roleLabel[user?.role || ""] || user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-xs text-white/50 hover:bg-red-500/15 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-col md:shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50 flex flex-col w-64">
            <Sidebar />
            <button
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white"
              onClick={() => setMobileOpen(false)}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[#0f1923] border-b border-white/10">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Menu className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#217346] flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm text-white">ThinkSheet</span>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
