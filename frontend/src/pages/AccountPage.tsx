import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/lib/auth";
import { api, getErrorMessage } from "@/lib/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  User,
  Mail,
  Shield,
  Building2,
  KeyRound,
  Pencil,
  Check,
  X,
  Loader2,
  ChevronRight,
  Briefcase,
  Users,
  Hash,
  Lock,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface EmployeeRecord {
  _id: string;
  employee_name: string;
  official_email: string;
  unique_id: string;
  designation: string;
  team_id: string;
  team_name: string;
}

// ── Role config ────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, {
  label: string;
  badge: string;
  avatarBg: string;
  bannerFrom: string;
  bannerTo: string;
}> = {
  ADMINISTRATOR: {
    label: "Administrator",
    badge: "bg-amber-100 text-amber-700 border border-amber-200",
    avatarBg: "from-amber-500 to-orange-500",
    bannerFrom: "from-amber-900/40",
    bannerTo: "to-slate-900",
  },
  MANAGER: {
    label: "Manager",
    badge: "bg-blue-100 text-blue-700 border border-blue-200",
    avatarBg: "from-blue-500 to-indigo-500",
    bannerFrom: "from-blue-900/40",
    bannerTo: "to-slate-900",
  },
  EMPLOYEE: {
    label: "Employee",
    badge: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    avatarBg: "from-[#217346] to-emerald-500",
    bannerFrom: "from-emerald-900/40",
    bannerTo: "to-slate-900",
  },
};

// ── Inline editable field ──────────────────────────────────────────────────────

function EditableField({
  label,
  icon: Icon,
  value,
  placeholder,
  onSave,
  saving,
}: {
  label: string;
  icon: React.FC<{ className?: string }>;
  value: string;
  placeholder?: string;
  onSave: (v: string) => Promise<void>;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch {
      setDraft(value);
      setEditing(false);
    }
  }

  function handleCancel() {
    setDraft(value);
    setEditing(false);
  }

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors group">
      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
          <span className="text-[10px] font-medium text-[#217346] bg-[#217346]/10 px-1.5 py-0.5 rounded-full">
            Editable
          </span>
        </div>
        {editing ? (
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              maxLength={100}
              disabled={saving}
              className="flex-1 min-w-0 text-sm font-medium text-slate-900 bg-white border border-[#217346] rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#217346]/20 transition-shadow"
            />
            <button
              type="submit"
              disabled={saving || !draft.trim()}
              className="w-8 h-8 rounded-lg bg-[#217346] text-white flex items-center justify-center hover:bg-[#185c37] transition-colors disabled:opacity-40 shrink-0"
              title="Save"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="w-8 h-8 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-300 transition-colors shrink-0"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {value || <span className="text-slate-400 font-normal italic">Not set</span>}
            </p>
            <button
              onClick={() => { setDraft(value); setEditing(true); }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#217346] transition-colors shrink-0 opacity-0 group-hover:opacity-100"
              title={`Edit ${label}`}
            >
              <Pencil className="w-3 h-3" />
              <span>Edit</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Read-only info field ───────────────────────────────────────────────────────

function ReadOnlyField({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
        <p className={clsx(
          "text-sm font-semibold text-slate-700 truncate",
          mono && "font-mono text-xs tracking-wide"
        )}>
          {value || "—"}
        </p>
      </div>
      <Lock className="w-3 h-3 text-slate-300 mt-1.5 shrink-0" />
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const [empRecord, setEmpRecord] = useState<EmployeeRecord | null>(null);
  const [empLoading, setEmpLoading] = useState(false);

  useEffect(() => {
    if (user?.role !== "EMPLOYEE") return;
    setEmpLoading(true);
    api.get<{ success: boolean; data: EmployeeRecord | null }>("/employees/me")
      .then((res) => setEmpRecord(res.data.data))
      .catch(() => {})
      .finally(() => setEmpLoading(false));
  }, [user?.role]);

  // ── Save handlers ────────────────────────────────────────────────────────────

  async function saveName(name: string) {
    setSaving(true);
    try {
      const res = await authService.updateProfile(name, user?.designation);
      await refreshUser(res.data.token);
      toast.success("Name updated successfully");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update name"));
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function saveDesignation(designation: string) {
    setSaving(true);
    try {
      const res = await authService.updateProfile(user?.full_name || "", designation);
      await refreshUser(res.data.token);
      toast.success("Designation updated successfully");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update designation"));
      throw err;
    } finally {
      setSaving(false);
    }
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const role = user?.role || "";
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.EMPLOYEE;
  const initials = user?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Page heading */}
        <div>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest mb-1">Account</p>
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            View and manage your personal information.
          </p>
        </div>

        {/* ── Hero card ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Banner */}
          <div className={clsx(
            "h-28 bg-gradient-to-r relative overflow-hidden",
            cfg.bannerFrom, cfg.bannerTo, "via-slate-900"
          )}>
            {/* Decorative circles */}
            <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
            <div className="absolute -bottom-12 -right-4 w-28 h-28 rounded-full bg-white/5" />
            <div className="absolute top-4 right-16 w-10 h-10 rounded-full bg-white/5" />
          </div>

          {/* Avatar + identity */}
          <div className="px-6 pb-5">
            {/* Avatar overlapping the banner */}
            <div className="flex items-end justify-between -mt-8 mb-4">
              <div className={clsx(
                "w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-xl ring-4 ring-white shrink-0",
                cfg.avatarBg
              )}>
                <span className="text-xl font-bold text-white">{initials}</span>
              </div>
              <span className={clsx(
                "text-xs font-semibold px-3 py-1 rounded-full mb-1",
                cfg.badge
              )}>
                {cfg.label}
              </span>
            </div>

            <h2 className="text-xl font-bold text-slate-900 leading-tight">{user?.full_name}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{user?.email}</p>

            {/* Quick info chips */}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                <Building2 className="w-3 h-3" />
                {user?.tenant_id}
              </span>
              {(role === "MANAGER" || role === "ADMINISTRATOR") && user?.designation && (
                <span className={clsx(
                  "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
                  role === "ADMINISTRATOR" ? "text-amber-600 bg-amber-50" : "text-blue-600 bg-blue-50"
                )}>
                  <Briefcase className="w-3 h-3" />
                  {user.designation}
                </span>
              )}
              {role === "EMPLOYEE" && empRecord?.team_name && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  <Users className="w-3 h-3" />
                  {empRecord.team_name}
                </span>
              )}
              {role === "EMPLOYEE" && empRecord?.unique_id && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                  <Hash className="w-3 h-3" />
                  {empRecord.unique_id}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Editable section ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-[#217346]" />
            <h3 className="text-sm font-bold text-slate-900">Editable Information</h3>
            <span className="text-xs text-slate-400 ml-1">— hover a field to edit</span>
          </div>
          <div className="px-5 pb-5 space-y-3">
            <EditableField
              label="Full Name"
              icon={User}
              value={user?.full_name || ""}
              placeholder="Your full name"
              onSave={saveName}
              saving={saving}
            />
            {(role === "MANAGER" || role === "ADMINISTRATOR") && (
              <EditableField
                label="Designation"
                icon={Briefcase}
                value={user?.designation || ""}
                placeholder={role === "ADMINISTRATOR" ? "e.g. System Administrator" : "e.g. Senior Manager"}
                onSave={saveDesignation}
                saving={saving}
              />
            )}
          </div>
        </div>

        {/* ── Account info (read-only) ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-slate-300" />
            <h3 className="text-sm font-bold text-slate-900">Account Information</h3>
            <span className="text-xs text-slate-400 ml-1">— managed by your organization</span>
          </div>
          <div className="px-5 pb-5 space-y-3">
            <ReadOnlyField icon={Mail} label="Email Address" value={user?.email || "—"} />
            <ReadOnlyField icon={Shield} label="Role" value={cfg.label} />
            <ReadOnlyField icon={Building2} label="Organization" value={user?.tenant_id || "—"} mono />

            {/* Manager — teams */}
            {role === "MANAGER" && (
              <ReadOnlyField
                icon={Users}
                label="Assigned Teams"
                value={
                  (user as any)?.team_ids?.length
                    ? `${(user as any).team_ids.length} team(s) assigned`
                    : "No teams assigned"
                }
              />
            )}

            {/* Employee — Streamline synced fields */}
            {role === "EMPLOYEE" && (
              empLoading ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                  <span className="text-xs text-slate-400">Loading employee data…</span>
                </div>
              ) : empRecord ? (
                <>
                  <ReadOnlyField icon={Hash} label="Employee ID" value={empRecord.unique_id || "—"} mono />
                  <ReadOnlyField icon={Briefcase} label="Designation" value={empRecord.designation || "—"} />
                  <ReadOnlyField icon={Users} label="Team" value={empRecord.team_name || "—"} />
                </>
              ) : null
            )}
          </div>
        </div>

        {/* ── Security card ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-red-400" />
            <h3 className="text-sm font-bold text-slate-900">Security</h3>
          </div>
          <div className="px-5 pb-5">
            <button
              onClick={() => navigate("/change-password")}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-[#217346]/40 hover:bg-[#217346]/5 transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-[#217346]/10 flex items-center justify-center shrink-0 transition-colors">
                <KeyRound className="w-4 h-4 text-slate-500 group-hover:text-[#217346] transition-colors" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-slate-800">Change Password</p>
                <p className="text-xs text-slate-400 mt-0.5">Update your current password to a new one</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#217346] group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
