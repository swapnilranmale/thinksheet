import { getErrorMessage } from "@/lib/api";
import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/lib/auth";
import { Loader2, Clock, Lock, ArrowRight, KeyRound } from "lucide-react";

export default function ChangePasswordPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isForced = user?.must_change_password;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await authService.changePassword(newPassword, isForced ? undefined : currentPassword);
      await refreshUser(res.data.token);
      if (user?.role === "ADMINISTRATOR") navigate("/timesheet/mapping", { replace: true });
      else if (user?.role === "MANAGER") navigate("/timesheet/manager", { replace: true });
      else navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to change password"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — Brand panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#217346] flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white translate-x-32 -translate-y-32" />
          <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-white -translate-x-24 translate-y-24" />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">ThinkSheet</p>
            <p className="text-white/60 text-xs">by Thinkitive</p>
          </div>
        </div>

        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-6">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            {isForced ? "Secure your\naccount." : "Update your\npassword."}
          </h2>
          <p className="text-white/70 text-base leading-relaxed">
            {isForced
              ? "You've been asked to set a new password before continuing."
              : "Keep your account secure by using a strong, unique password."}
          </p>
        </div>

        <p className="relative text-white/40 text-xs">© 2026 Thinkitive Technologies</p>
      </div>

      {/* Right — Form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-xl bg-[#217346] flex items-center justify-center">
            <Clock className="w-4 h-4 text-white" />
          </div>
          <p className="text-slate-900 font-bold text-lg">ThinkSheet</p>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            {isForced && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Action required
              </div>
            )}
            <h1 className="text-2xl font-bold text-slate-900">
              {isForced ? "Set new password" : "Change password"}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {isForced
                ? "Please create a new password to access your account"
                : "Update your current password"}
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <span className="mt-0.5">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isForced && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Current password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Your current password"
                    required
                    className="w-full h-11 rounded-xl border border-slate-300 pl-10 pr-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#217346] focus:border-transparent transition-shadow"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  autoFocus
                  className="w-full h-11 rounded-xl border border-slate-300 pl-10 pr-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#217346] focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm new password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  className="w-full h-11 rounded-xl border border-slate-300 pl-10 pr-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#217346] focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-[#217346] hover:bg-[#185c37] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {isForced ? "Set Password & Continue" : "Update Password"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
