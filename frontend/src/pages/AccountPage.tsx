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

interface EmployeeRecord {
  _id: string;
  employee_name: string;
  official_email: string;
  unique_id: string;
  designation: string;
  team_id: string;
  team_name: string;
}

const ROLE_CONFIG: Record<string, {
  label: string;
  badge: string;
  avatarBg: string;
}> = {
  ADMINISTRATOR: {
    label: "Administrator",
    badge: "bg-amber-100 text-amber-700 border border-amber-200",
    avatarBg: "from-amber-400 to-orange-500",
  },
  MANAGER: {
    label: "Manager",
    badge: "bg-blue-100 text-blue-700 border border-blue-200",
    avatarBg: "from-blue-500 to-indigo-500",
  },
  EMPLOYEE: {
    label: "Employee",
    badge: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    avatarBg: "from-[#217346] to-emerald-500",
  },
};

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

  return (
    <div className="group flex items-center gap-4 py-3.5 border-b border-slate-100 last:border-0">
      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
      <div className="w-36 shrink-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
      {editing ? (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-1">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            maxLength={100}
            disabled={saving}
            className="flex-1 text-sm text-slate-900 bg-white border border-[#217346] rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#217346]/20"
          />
          <button
            type="submit"
            disabled={saving || !draft.trim()}
            className="w-8 h-8 rounded-lg bg-[#217346] text-white flex items-center justify-center hover:bg-[#185c37] disabled:opacity-40 shrink-0"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => { setDraft(value); setEditing(false); }}
            disabled={saving}
            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </form>
      ) : (
        <div className="flex items-center justify-between flex-1 min-w-0">
          <p className="text-sm text-slate-800 font-medium truncate">
            {value || <span className="text-slate-400 italic font-normal">Not set</span>}
          </p>
          <button
            onClick={() => { setDraft(value); setEditing(true); }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#217346] opacity-0 group-hover:opacity-100 transition-all ml-3 shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

function ReadOnlyRow({
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
    <div className="flex items-center gap-4 py-3.5 border-b border-slate-100 last:border-0">
      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
      <div className="w-36 shrink-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
      <p className={clsx(
        "flex-1 text-sm text-slate-800 font-medium truncate",
        mono && "font-mono text-xs text-slate-600"
      )}>
        {value || "—"}
      </p>
      <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
    </div>
  );
}

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

  const role = user?.role || "";
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.EMPLOYEE;
  const initials = user?.full_name
    ?.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?";

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-8">

        {/* Page heading */}
        <div>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest mb-1">Account</p>
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        </div>

        {/* ── Profile summary row ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center gap-6">
          <div className={clsx(
            "w-20 h-20 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg shrink-0",
            cfg.avatarBg
          )}>
            <span className="text-2xl font-black text-white">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900">{user?.full_name}</h2>
              <span className={clsx("text-xs font-semibold px-2.5 py-1 rounded-full", cfg.badge)}>
                {cfg.label}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">{user?.email}</p>
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {user?.tenant_id}
              </span>
              {user?.designation && (
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" />
                  {user.designation}
                </span>
              )}
              {role === "EMPLOYEE" && empRecord?.team_name && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {empRecord.team_name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Two column layout ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Editable Information */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Editable Information</h3>
              <p className="text-xs text-slate-400 mt-0.5">Hover a field to edit</p>
            </div>
            <div className="px-6 py-2">
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

          {/* Account Information */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Account Information</h3>
              <p className="text-xs text-slate-400 mt-0.5">Managed by your organization</p>
            </div>
            <div className="px-6 py-2">
              <ReadOnlyRow icon={Mail} label="Email" value={user?.email || "—"} />
              <ReadOnlyRow icon={Shield} label="Role" value={cfg.label} />
              <ReadOnlyRow icon={Building2} label="Organization" value={user?.tenant_id || "—"} mono />
              {role === "MANAGER" && (
                <ReadOnlyRow
                  icon={Users}
                  label="Teams"
                  value={(user as any)?.team_ids?.length ? `${(user as any).team_ids.length} team(s)` : "No teams"}
                />
              )}
              {role === "EMPLOYEE" && (
                empLoading ? (
                  <div className="flex items-center gap-2 py-3.5 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Loading…</span>
                  </div>
                ) : empRecord ? (
                  <>
                    <ReadOnlyRow icon={Hash} label="Employee ID" value={empRecord.unique_id || "—"} mono />
                    <ReadOnlyRow icon={Briefcase} label="Designation" value={empRecord.designation || "—"} />
                    <ReadOnlyRow icon={Users} label="Team" value={empRecord.team_name || "—"} />
                  </>
                ) : null
              )}
            </div>
          </div>
        </div>

        {/* ── Security ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Security</h3>
          </div>
          <div className="p-4">
            <button
              onClick={() => navigate("/change-password")}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all group text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center shrink-0 transition-colors">
                <KeyRound className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">Change Password</p>
                <p className="text-xs text-slate-400 mt-0.5">Update your current password</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
