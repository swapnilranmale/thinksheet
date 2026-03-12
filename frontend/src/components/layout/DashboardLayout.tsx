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
  Settings,
  ChevronDown,
  ChevronLeft,
} from "lucide-react";
import { clsx } from "clsx";

// ── Sidebar nav link ──────────────────────────────────────────────────────────

function SidebarLink({
  to,
  icon: Icon,
  label,
  onClick,
  exact,
  collapsed = false,
}: {
  to: string;
  icon: React.FC<{ className?: string }>;
  label: string;
  onClick?: () => void;
  exact?: boolean;
  collapsed?: boolean;
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
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden",
        collapsed ? "justify-center w-14" : "w-full",
        isActive
          ? "bg-[#217346]/25 text-white shadow-lg shadow-[#217346]/20"
          : "text-white/60 hover:bg-white/8 hover:text-white/90"
      )}
      title={collapsed ? label : undefined}
    >
      {/* Active indicator bar */}
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#217346] shadow-lg shadow-[#217346]/50 animate-slide-up" />
      )}

      <div
        className={clsx(
          "rounded-lg flex items-center justify-center shrink-0 transition-all duration-200",
          collapsed ? "w-6 h-6" : "w-7 h-7",
          isActive ? "bg-[#217346]/40 scale-110" : "bg-white/8 group-hover:bg-white/15 group-hover:scale-105"
        )}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      {!collapsed && (
        <>
          <span className="flex-1 text-left">{label}</span>
          {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-80 animate-slide-in-left" />}
        </>
      )}
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  const Sidebar = ({ collapsed = false }: { collapsed?: boolean }) => (
    <aside className={clsx(
      "flex flex-col h-full bg-[#0f1923] relative overflow-hidden transition-all duration-300",
      collapsed ? "w-20" : "w-64"
    )}>
      {/* Animated top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#217346] via-emerald-400 to-transparent animate-pulse" />

      {/* Logo with animation */}
      <div className={clsx(
        "flex items-center gap-3 px-5 py-5 animate-slide-in-left transition-all duration-300",
        collapsed && "justify-center"
      )}>
        <div className="w-9 h-9 rounded-xl bg-[#217346] flex items-center justify-center shrink-0 shadow-lg shadow-[#217346]/30 hover:shadow-xl hover:shadow-[#217346]/50 transition-all duration-300 group">
          <Clock className="w-4 h-4 text-white group-hover:rotate-12 transition-transform duration-300" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight">ThinkSheet</p>
            <p className="text-[11px] text-white/40 leading-tight truncate">{user?.tenant_id || "default"}</p>
          </div>
        )}
      </div>

      {/* Divider with fade animation */}
      {!collapsed && <div className="mx-4 h-px bg-gradient-to-r from-white/0 via-white/8 to-white/0 mb-3" />}

      {/* Nav with stagger animation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {user?.role === "EMPLOYEE" && (
          <div className="space-y-0.5">
            {!collapsed && (
              <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold px-3 pt-2 pb-1.5">
                My Workspace
              </p>
            )}
            <SidebarLink
              to="/dashboard"
              icon={LayoutDashboard}
              label="Dashboard"
              onClick={() => handleNavClick("/dashboard")}
              exact
              collapsed={collapsed}
            />
            <SidebarLink
              to="/dashboard/projects"
              icon={FolderOpen}
              label="My Projects"
              onClick={() => handleNavClick("/dashboard/projects")}
              exact
              collapsed={collapsed}
            />
          </div>
        )}

        {user?.role === "MANAGER" && (
          <div className="space-y-0.5">
            {!collapsed && (
              <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold px-3 pt-2 pb-1.5">
                Operations
              </p>
            )}
            <SidebarLink
              to="/workspace?tab=projects"
              icon={FolderOpen}
              label="My Projects"
              onClick={() => handleNavClick("/workspace?tab=projects")}
              exact={false}
              collapsed={collapsed}
            />
            <SidebarLink
              to="/workspace?tab=employees"
              icon={Users}
              label="My Employees"
              onClick={() => handleNavClick("/workspace?tab=employees")}
              exact={false}
              collapsed={collapsed}
            />
          </div>
        )}

        {user?.role === "ADMINISTRATOR" && (
          <div className="space-y-0.5">
            {!collapsed && (
              <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold px-3 pt-2 pb-1.5">
                Administration
              </p>
            )}
            <SidebarLink
              to="/timesheet/mapping?tab=managers"
              icon={Shield}
              label="Managers"
              onClick={() => handleNavClick("/timesheet/mapping?tab=managers")}
              collapsed={collapsed}
            />
            <SidebarLink
              to="/timesheet/mapping?tab=employees"
              icon={Users}
              label="Employees"
              onClick={() => handleNavClick("/timesheet/mapping?tab=employees")}
              collapsed={collapsed}
            />
            <SidebarLink
              to="/timesheet/mapping?tab=projects"
              icon={FolderOpen}
              label="Clients & Projects"
              onClick={() => handleNavClick("/timesheet/mapping?tab=projects")}
              collapsed={collapsed}
            />
            <SidebarLink
              to="/timesheet/mapping?tab=logs"
              icon={ScrollText}
              label="Activity Logs"
              onClick={() => handleNavClick("/timesheet/mapping?tab=logs")}
              collapsed={collapsed}
            />
          </div>
        )}
      </nav>

      {/* User card with expandable menu + collapse button */}
      <div className="mx-3 mb-3 mt-auto pt-3 space-y-3 animate-slide-up border-t border-white/5 flex flex-col" style={{ animationDelay: "0.1s" }}>
        {/* User card with expandable menu */}
        <div className="bg-gradient-to-br from-white/8 to-white/4 rounded-xl border border-white/10 hover:border-white/20 transition-colors duration-300 overflow-hidden">
          {/* User info button - clickable to expand */}
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-full flex items-center gap-2.5 p-3 group hover:bg-white/5 transition-colors duration-300"
          >
            {/* Avatar with animation */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#217346] to-emerald-600 flex items-center justify-center shrink-0 shadow-md group-hover:shadow-lg transition-all duration-300 group-hover:scale-110">
              <span className="text-xs font-bold text-white">
                {user?.full_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-xs font-semibold text-white truncate leading-tight">{user?.full_name}</p>
              <span
                className={clsx(
                  "inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 transition-all duration-300",
                  roleBg[user?.role || ""] || "bg-white/10 text-white/50"
                )}
              >
                {roleLabel[user?.role || ""] || user?.role}
              </span>
            </div>
            <ChevronDown
              className={clsx(
                "w-4 h-4 text-white/40 shrink-0 transition-transform duration-300",
                userMenuOpen && "rotate-180"
              )}
            />
          </button>

          {/* Expandable menu - Profile + Sign out */}
          {userMenuOpen && (
            <div className="border-t border-white/10 bg-white/5 animate-slide-up space-y-0" style={{ animationDuration: "200ms" }}>
              <button
                onClick={() => {
                  navigate("/account");
                  setUserMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300 group border-b border-white/5"
              >
                <Settings className="w-3.5 h-3.5 text-white/40 group-hover:text-[#217346] transition-colors duration-300" />
                <span>Profile</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-white/50 hover:bg-red-500/15 hover:text-red-400 transition-all duration-300 group"
              >
                <LogOut className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-300" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>

        {/* Collapse sidebar button - at the very bottom */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={clsx(
            "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-300 group font-medium",
            collapsed
              ? "justify-center border border-[#217346] text-[#217346] hover:bg-[#217346]/10"
              : "text-white/50 hover:text-white/70 hover:bg-white/8"
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-col md:shrink-0">
        <Sidebar collapsed={sidebarCollapsed} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50 flex flex-col w-64">
            <Sidebar collapsed={sidebarCollapsed} />
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0f1923] border-b border-white/10">
          <div className="flex items-center gap-3">
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
        </div>


        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
