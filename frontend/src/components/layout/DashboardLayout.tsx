import { useState, useEffect, useCallback, ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
  Layers,
  Settings,
  ChevronDown,
  ChevronLeft,
  Bell,
} from "lucide-react";
import { clsx } from "clsx";
import { notificationService } from "@/services/timesheet";

// ── Sidebar nav link ──────────────────────────────────────────────────────────

function SidebarLink({
  to,
  icon: Icon,
  label,
  onClick,
  exact,
  collapsed = false,
  badge,
  extraPaths = [],
}: {
  to: string;
  icon: React.FC<{ className?: string }>;
  label: string;
  onClick?: () => void;
  exact?: boolean;
  collapsed?: boolean;
  badge?: number;
  extraPaths?: string[];
}) {
  const location = useLocation();
  // Match by pathname + optional search param
  const [path, search] = to.split("?");
  const baseActive = exact
    ? location.pathname === path && (!search || location.search.includes(search))
    : location.pathname.startsWith(path) && (!search || location.search.includes(search));
  const isActive = baseActive || extraPaths.some(ep => {
    const [epath, esearch] = ep.split("?");
    return location.pathname.startsWith(epath) && (!esearch || location.search.includes(esearch));
  });

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
          {badge !== undefined && badge > 0 && (
            <span className="min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-sm">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
          {isActive && !badge && <ChevronRight className="w-3.5 h-3.5 opacity-80 animate-slide-in-left" />}
        </>
      )}
      {collapsed && badge !== undefined && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

// ── Main Layout ───────────────────────────────────────────────────────────────

interface DashboardLayoutProps {
  children: ReactNode;
}

const TAB_LABELS: Record<string, string> = {
  admins: "Admins",
  managers: "Managers",
  employees: "Employees",
  projects: "Clients & Projects",
  "project-master": "Project Master",
  logs: "Activity Logs",
};

function getPageTitle(pathname: string, searchParams: URLSearchParams): { title: string; crumbs: string[] } {
  const tab = searchParams.get("tab");

  if (pathname === "/dashboard") return { title: "Dashboard", crumbs: [] };
  if (pathname === "/dashboard/projects") return { title: "My Projects", crumbs: ["My Workspace"] };
  if (pathname === "/timesheet/employee") return { title: "Timesheet", crumbs: ["My Workspace", "My Projects"] };
  if (pathname === "/notifications") return { title: "Notifications", crumbs: [] };
  if (pathname === "/account") return { title: "My Account", crumbs: [] };
  if (pathname === "/workspace") {
    if (tab === "employees") return { title: "My Employees", crumbs: ["Operations"] };
    return { title: "My Projects", crumbs: ["Operations"] };
  }
  if (pathname === "/timesheet/manager") return { title: "Timesheets", crumbs: ["Operations"] };
  if (pathname.startsWith("/projects/")) return { title: "Project Dashboard", crumbs: ["Operations", "My Projects"] };
  if (pathname === "/timesheet/mapping") {
    const label = tab ? (TAB_LABELS[tab] || tab) : "Administration";
    return { title: label, crumbs: ["Administration"] };
  }
  if (pathname === "/admin/projects") {
    const fromParam = searchParams.get("from");
    const parentLabel = fromParam === "project-master" ? "Project Master" : "Clients & Projects";
    return { title: "Project Timesheets", crumbs: ["Administration", parentLabel] };
  }
  return { title: "ThinkSheet", crumbs: [] };
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const pageInfo = getPageTitle(location.pathname, searchParams);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  // Poll unread notification count every 30s
  const fetchUnread = useCallback(async () => {
    try {
      const res = await notificationService.getUnreadCount();
      setUnreadNotifs(res.unread);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (user?.role === "EMPLOYEE" || user?.role === "MANAGER") {
      fetchUnread();
      const interval = setInterval(fetchUnread, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.role, fetchUnread]);

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
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#217346] via-emerald-300 to-emerald-600/20 animate-pulse" />
      <div className="absolute top-0 left-0 w-1/2 h-[3px] bg-gradient-to-r from-emerald-300/60 to-transparent animate-pulse [animation-delay:1.1s]" />

      {/* Logo with animation */}
      <div className={clsx(
        "flex items-center gap-3 px-5 py-5 animate-slide-in-left transition-all duration-300",
        collapsed && "justify-center"
      )}>
        {/* Icon with heartbeat rings */}
        <div className="relative shrink-0 flex items-center justify-center">
          {/* Ripple ring 1 */}
          <div className="absolute inset-0 rounded-xl bg-emerald-500/30 animate-logo-ring-pulse" />
          {/* Ripple ring 2 (delayed) */}
          <div className="absolute inset-0 rounded-xl bg-emerald-400/20 animate-logo-ring-pulse [animation-delay:1.1s]" />
          {/* Icon box */}
          <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-[#217346] via-emerald-600 to-emerald-500 flex items-center justify-center shadow-xl shadow-[#217346]/50 hover:shadow-2xl hover:shadow-[#217346]/70 transition-all duration-300 group animate-logo-heartbeat z-10">
            <Clock className="w-5 h-5 text-white group-hover:rotate-12 transition-transform duration-300 drop-shadow" />
          </div>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight tracking-wide">ThinkSheet</p>
            <p className="text-[11px] text-emerald-400/60 leading-tight truncate">{user?.tenant_id || "default"}</p>
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
              to="/notifications"
              icon={Bell}
              label="Notifications"
              onClick={() => handleNavClick("/notifications")}
              exact
              collapsed={collapsed}
              badge={unreadNotifs}
            />
            <SidebarLink
              to="/dashboard/projects"
              icon={FolderOpen}
              label="My Projects"
              onClick={() => handleNavClick("/dashboard/projects")}
              exact
              collapsed={collapsed}
              extraPaths={["/timesheet/employee"]}
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
              to="/dashboard"
              icon={LayoutDashboard}
              label="Dashboard"
              onClick={() => handleNavClick("/dashboard")}
              exact
              collapsed={collapsed}
            />
            <SidebarLink
              to="/notifications"
              icon={Bell}
              label="Notifications"
              onClick={() => handleNavClick("/notifications")}
              exact
              collapsed={collapsed}
              badge={unreadNotifs}
            />
            <SidebarLink
              to="/workspace?tab=projects"
              icon={FolderOpen}
              label="My Projects"
              onClick={() => handleNavClick("/workspace?tab=projects")}
              exact={false}
              collapsed={collapsed}
              extraPaths={["/projects/"]}
            />
            <SidebarLink
              to="/workspace?tab=employees"
              icon={Users}
              label="My Employees"
              onClick={() => handleNavClick("/workspace?tab=employees")}
              exact={false}
              collapsed={collapsed}
            />
            <SidebarLink
              to="/timesheet/manager"
              icon={Clock}
              label="Timesheets"
              onClick={() => handleNavClick("/timesheet/manager")}
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
              to="/dashboard"
              icon={LayoutDashboard}
              label="Dashboard"
              onClick={() => handleNavClick("/dashboard")}
              exact
              collapsed={collapsed}
            />
            <SidebarLink
              to="/timesheet/mapping?tab=admins"
              icon={Shield}
              label="Admins"
              onClick={() => handleNavClick("/timesheet/mapping?tab=admins")}
              collapsed={collapsed}
            />
            <SidebarLink
              to="/timesheet/mapping?tab=managers"
              icon={Users}
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
              extraPaths={["/admin/projects?from=projects"]}
            />
            <SidebarLink
              to="/timesheet/mapping?tab=project-master"
              icon={Layers}
              label="Project Master"
              onClick={() => handleNavClick("/timesheet/mapping?tab=project-master")}
              collapsed={collapsed}
              extraPaths={["/admin/projects?from=project-master"]}
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

      {/* User card + collapse button */}
      <div className="mx-3 mb-3 mt-auto pt-3 border-t border-white/5 flex flex-col gap-2 animate-slide-up" style={{ animationDelay: "0.1s" }}>

        {collapsed ? (
          /* ── Collapsed: avatar + logout icon stacked ── */
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={() => navigate("/account")}
              title={user?.full_name}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-[#217346] to-emerald-600 flex items-center justify-center shadow-md hover:shadow-lg hover:scale-110 transition-all duration-300"
            >
              <span className="text-xs font-bold text-white">
                {user?.full_name?.charAt(0).toUpperCase()}
              </span>
            </button>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/15 transition-all duration-300"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          /* ── Expanded: full user card with dropdown ── */
          <div className="bg-gradient-to-br from-white/8 to-white/4 rounded-xl border border-white/10 hover:border-white/20 transition-colors duration-300 overflow-hidden">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-2.5 p-3 group hover:bg-white/5 transition-colors duration-300"
            >
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

            {userMenuOpen && (
              <div className="border-t border-white/10 bg-white/5 animate-slide-up space-y-0" style={{ animationDuration: "200ms" }}>
                <button
                  onClick={() => { navigate("/account"); setUserMenuOpen(false); }}
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
        )}

        {/* Collapse / expand toggle */}
        <button
          onClick={() => { setSidebarCollapsed(!sidebarCollapsed); setUserMenuOpen(false); }}
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
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[#0f1923] border-b border-white/10">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          >
            <Menu className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 rounded-lg bg-[#217346] flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            {pageInfo.crumbs.length > 0 && (
              <p className="text-[10px] text-white/40 leading-none truncate">
                {pageInfo.crumbs[pageInfo.crumbs.length - 1]}
              </p>
            )}
            <p className="text-sm font-semibold text-white leading-tight truncate">{pageInfo.title}</p>
          </div>
        </div>


        {/* Desktop top bar */}
        <div className="hidden md:flex items-center gap-3 px-6 py-3 bg-white border-b border-slate-200/80 shrink-0">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {pageInfo.crumbs.length > 0 && (
              <>
                {pageInfo.crumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-2 text-xs text-slate-400">
                    {i > 0 && <ChevronRight className="w-3 h-3 shrink-0" />}
                    {crumb}
                  </span>
                ))}
                <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
              </>
            )}
            <span className="text-xs font-semibold text-slate-700">{pageInfo.title}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-slate-400 font-medium">Live</span>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6 flex flex-col min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
