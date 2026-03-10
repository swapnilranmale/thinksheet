import { getErrorMessage } from "@/lib/api";
import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Clock, Mail, Lock, ArrowRight, Shield, Users, BarChart3 } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      if (user.must_change_password) {
        navigate("/change-password", { replace: true });
        return;
      }
      if (user.role === "ADMINISTRATOR") navigate("/timesheet/mapping", { replace: true });
      else if (user.role === "MANAGER") navigate("/timesheet/manager", { replace: true });
      else navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Invalid email or password"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — Brand panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#217346] flex-col justify-between p-12 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white translate-x-32 -translate-y-32" />
          <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-white -translate-x-24 translate-y-24" />
          <div className="absolute top-1/2 left-1/2 w-48 h-48 rounded-full bg-white -translate-x-1/2 -translate-y-1/2" />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">ThinkSheet</p>
            <p className="text-white/60 text-xs">by Thinkitive</p>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Track time.<br />
            Ship faster.<br />
            Stay aligned.
          </h2>
          <p className="text-white/70 text-base leading-relaxed mb-10">
            Enterprise timesheet management built for modern engineering teams.
          </p>

          {/* Feature pills */}
          <div className="space-y-3">
            {[
              { icon: Shield, text: "Role-based access for Admin, Manager & Employee" },
              { icon: BarChart3, text: "Real-time project hours tracking" },
              { icon: Users, text: "Team timesheet review & approval" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-white/80 text-sm">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative text-white/40 text-xs">© 2026 Thinkitive Technologies</p>
      </div>

      {/* Right — Form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-xl bg-[#217346] flex items-center justify-center">
            <Clock className="w-4.5 h-4.5 text-white" />
          </div>
          <p className="text-slate-900 font-bold text-lg">ThinkSheet</p>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
            <p className="text-slate-500 text-sm mt-1">Sign in to your account to continue</p>
          </div>

          {/* Role badges hint */}
          <div className="flex gap-2 mb-6">
            {["Admin", "Manager", "Employee"].map((role) => (
              <span
                key={role}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-500"
              >
                {role}
              </span>
            ))}
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <span className="mt-0.5">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoFocus
                  className="w-full h-11 rounded-xl border border-slate-300 pl-10 pr-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#217346] focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            First time setup?{" "}
            <Link to="/signup" className="text-[#217346] font-semibold hover:underline">
              Create admin account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
