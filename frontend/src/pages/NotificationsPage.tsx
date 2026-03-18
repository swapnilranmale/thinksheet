import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Bell,
  CheckCircle2,
  ThumbsUp,
  XCircle,
  Check,
  Loader2,
  Send,
  MessageSquare,
  RotateCcw,
} from "lucide-react";
import { clsx } from "clsx";
import { notificationService, AppNotification } from "@/services/timesheet";
import { withUndo } from "@/lib/withUndo";
import { useAuth } from "@/contexts/AuthContext";

function notifIcon(type: string) {
  if (type === "timesheet_submitted") return (
    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 ring-2 ring-blue-100">
      <CheckCircle2 className="w-5 h-5 text-blue-600" />
    </div>
  );
  if (type === "timesheet_approved") return (
    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 ring-2 ring-emerald-100">
      <ThumbsUp className="w-5 h-5 text-emerald-600" />
    </div>
  );
  if (type === "timesheet_rejected") return (
    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0 ring-2 ring-red-100">
      <XCircle className="w-5 h-5 text-red-500" />
    </div>
  );
  if (type === "project_submitted") return (
    <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center shrink-0 ring-2 ring-purple-100">
      <Send className="w-5 h-5 text-purple-600" />
    </div>
  );
  if (type === "correction_requested") return (
    <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0 ring-2 ring-amber-100">
      <MessageSquare className="w-5 h-5 text-amber-600" />
    </div>
  );
  if (type === "timesheet_reverted") return (
    <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0 ring-2 ring-orange-100">
      <RotateCcw className="w-5 h-5 text-orange-500" />
    </div>
  );
  if (type === "project_reverted") return (
    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0 ring-2 ring-red-100">
      <RotateCcw className="w-5 h-5 text-red-500" />
    </div>
  );
  return (
    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
      <Bell className="w-5 h-5 text-slate-400" />
    </div>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const [res, countRes] = await Promise.all([
        notificationService.getAll(p, 20),
        notificationService.getUnreadCount(),
      ]);
      setNotifications(res.data);
      setTotalPages(res.pagination.pages);
      setUnreadCount(countRes.unread);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  function markAllRead() {
    // Capture previous state for undo
    const prevNotifications = notifications.map(n => ({ ...n }));
    const prevUnreadCount = unreadCount;
    // Optimistically mark all as read
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    withUndo({
      label: "All notifications marked as read",
      duration: 4000,
      onUndo: () => {
        setNotifications(prevNotifications);
        setUnreadCount(prevUnreadCount);
      },
      action: () => notificationService.markAllRead(),
    });
  }

  function markRead(id: string) {
    const target = notifications.find(n => n._id === id);
    if (!target || target.is_read) return;
    // Optimistically mark as read
    setUnreadCount(prev => Math.max(0, prev - 1));
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, is_read: true } : n));
    withUndo({
      label: "Notification marked as read",
      duration: 4000,
      onUndo: () => {
        setUnreadCount(prev => prev + 1);
        setNotifications(prev => prev.map(n => n._id === id ? { ...n, is_read: false } : n));
      },
      action: () => notificationService.markRead(id),
    });
  }

  function handleClick(n: AppNotification) {
    if (!n.is_read) markRead(n._id);
    if (n.type === "timesheet_submitted" && n.metadata.employee_id) {
      // Manager: deep-link directly to that employee's timesheet
      navigate("/timesheet/manager", {
        state: {
          autoSelect: {
            employee_id: n.metadata.employee_id,
            project_id: n.metadata.project_id,
            month: n.metadata.month,   // 1-indexed
            year: n.metadata.year,
          },
        },
      });
    } else if (n.type === "timesheet_approved" || n.type === "timesheet_rejected") {
      if (user?.role === "EMPLOYEE") {
        // Employee: go directly to the relevant timesheet month/project
        const params = new URLSearchParams();
        if (n.metadata.project_id) params.set("projectId", n.metadata.project_id);
        if (n.metadata.project_name) params.set("projectName", n.metadata.project_name);
        if (n.metadata.month != null) params.set("month", String(n.metadata.month));
        if (n.metadata.year != null) params.set("year", String(n.metadata.year));
        navigate(`/timesheet/employee?${params.toString()}`);
      } else {
        navigate("/timesheet/manager");
      }
    } else if (n.type === "project_submitted") {
      navigate("/timesheet/manager");
    } else if (n.type === "correction_requested" && n.metadata.employee_id) {
      // Manager: deep-link to that employee's timesheet
      navigate("/timesheet/manager", {
        state: {
          autoSelect: {
            employee_id: n.metadata.employee_id,
            project_id: n.metadata.project_id,
            month: n.metadata.month,
            year: n.metadata.year,
          },
        },
      });
    } else if (n.type === "timesheet_reverted") {
      // Employee: go to the timesheet that was reverted
      const params = new URLSearchParams();
      if (n.metadata.project_id) params.set("projectId", n.metadata.project_id);
      if (n.metadata.project_name) params.set("projectName", n.metadata.project_name);
      if (n.metadata.month != null) params.set("month", String(n.metadata.month));
      if (n.metadata.year != null) params.set("year", String(n.metadata.year));
      navigate(`/timesheet/employee?${params.toString()}`);
    } else if (n.type === "project_reverted") {
      // Manager: go to their timesheet review page
      navigate("/timesheet/manager");
    }
  }

  return (
    <DashboardLayout>
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {unreadCount > 0
                ? <>{unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}</>
                : "You're all caught up"
              }
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              className="gap-1.5 text-[#217346] border-[#217346]/30 hover:bg-[#217346]/5"
            >
              <Check className="w-4 h-4" />
              Mark all as read
            </Button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /><span>Loading notifications...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Bell className="w-7 h-7 text-slate-300" />
            </div>
            <p className="font-semibold text-slate-600 text-lg">All caught up!</p>
            <p className="text-sm text-slate-400 mt-1">No notifications to show</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
              {notifications.map((n) => (
                <button
                  key={n._id}
                  onClick={() => handleClick(n)}
                  className={clsx(
                    "w-full flex items-start gap-4 px-5 py-4 transition-all duration-150 text-left group hover:bg-slate-50/80",
                    !n.is_read && "bg-blue-50/30"
                  )}
                >
                  {notifIcon(n.type)}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2">
                      <p className={clsx(
                        "text-sm leading-snug",
                        !n.is_read ? "font-semibold text-slate-900" : "font-medium text-slate-600"
                      )}>
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">{n.message}</p>
                    <p className="text-xs text-slate-400 mt-1.5 font-medium">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="shrink-0 border-t border-slate-100 px-5 py-3 flex items-center justify-between bg-white">
                <span className="text-xs text-slate-400">
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="h-7 text-xs"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="h-7 text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
