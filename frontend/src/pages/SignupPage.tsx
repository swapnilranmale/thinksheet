import { getErrorMessage } from "@/lib/api";
import { useState, useEffect, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authService } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Clock, Mail, Lock, User, ArrowRight, CheckCircle2, Eye, EyeOff } from "lucide-react";

export default function SignupPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [checking, setChecking] = useState(true);

  // Redirect to login if an admin already exists (setup already done)
  useEffect(() => {
    authService.getSetupStatus()
      .then(res => {
        if (!res.data.needs_setup) navigate("/login", { replace: true });
      })
      .catch(() => {/* allow through on error */})
      .finally(() => setChecking(false));
  }, [navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await authService.signup(email.trim(), password, fullName.trim());
      await refreshUser(res.data.token);
      navigate("/timesheet/mapping", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Signup failed"));
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;

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
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Set up your<br />
            workspace in<br />
            minutes.
          </h2>
          <p className="text-white/70 text-base leading-relaxed mb-10">
            Create your admin account and start managing your team's timesheets today.
          </p>

          <div className="space-y-3">
            {[
              "Create & manage manager accounts",
              "Map employees to projects",
              "Review and approve timesheets",
            ].map((text) => (
              <div key={text} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-white/70 shrink-0" />
                <p className="text-white/80 text-sm">{text}</p>
              </div>
            ))}
          </div>
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
            <h1 className="text-2xl font-bold text-slate-900">Create admin account</h1>
            <p className="text-slate-500 text-sm mt-1">Set up your ThinkSheet workspace</p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <span className="mt-0.5">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Smith"
                  required
                  autoFocus
                  className="w-full h-11 rounded-xl border border-slate-300 pl-10 pr-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#217346] focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@company.com"
                  required
                  className="w-full h-11 rounded-xl border border-slate-300 pl-10 pr-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#217346] focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  className="w-full h-11 rounded-xl border border-slate-300 pl-10 pr-10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#217346] focus:border-transparent transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors duration-200"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  required
                  className="w-full h-11 rounded-xl border border-slate-300 pl-10 pr-10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#217346] focus:border-transparent transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors duration-200"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
                  Create Account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-[#217346] font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
