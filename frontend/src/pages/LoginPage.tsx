import { getErrorMessage } from "@/lib/api";
import { useState, useEffect, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/lib/auth";
import { Loader2, Clock, Mail, Lock, ArrowRight, Shield, Users, BarChart3, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    authService.getSetupStatus()
      .then(res => setNeedsSetup(res.data.needs_setup))
      .catch(() => setNeedsSetup(false));
  }, []);

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
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white translate-x-32 -translate-y-32 animate-float-slow" />
          <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-white -translate-x-24 translate-y-24 animate-float-slower" />
          <div className="absolute top-1/2 left-1/2 w-48 h-48 rounded-full bg-white -translate-x-1/2 -translate-y-1/2 animate-float-slowest" />
        </div>

        {/* Logo with slide-in animation */}
        <div className="relative flex items-center gap-3 animate-slide-in-left">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors duration-300">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">ThinkSheet</p>
            <p className="text-white/60 text-xs">by Thinkitive</p>
          </div>
        </div>

        {/* Main copy with animations */}
        <div className="relative">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4 animate-text-fade">
            Track time.<br />
            Ship faster.<br />
            Stay aligned.
          </h2>
          <p className="text-white/70 text-base leading-relaxed mb-10 animate-text-fade" style={{ animationDelay: "0.1s" }}>
            Enterprise timesheet management built for modern engineering teams.
          </p>

          {/* Feature pills with stagger animation */}
          <div className="space-y-3 animate-stagger">
            {[
              { icon: Shield, text: "Role-based access for Admin, Manager & Employee" },
              { icon: BarChart3, text: "Real-time project hours tracking" },
              { icon: Users, text: "Team timesheet review & approval" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 opacity-0 animate-slide-up">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0 group-hover:bg-white/25 transition-colors duration-300">
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 relative">
        {/* Mobile logo with animation */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10 animate-slide-up">
          <div className="w-9 h-9 rounded-xl bg-[#217346] flex items-center justify-center hover:shadow-lg transition-shadow duration-300">
            <Clock className="w-4.5 h-4.5 text-white" />
          </div>
          <p className="text-slate-900 font-bold text-lg">ThinkSheet</p>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading with animations */}
          <div className="mb-8 animate-slide-up">
            <h1 className="text-2xl font-bold text-slate-900 animate-text-fade">Welcome back</h1>
            <p className="text-slate-500 text-sm mt-1 animate-text-fade" style={{ animationDelay: "0.1s" }}>
              Sign in to your account to continue
            </p>
          </div>

          {/* Role badges hint with individual animations */}
          <div className="flex gap-2 mb-6 flex-wrap justify-center lg:justify-start">
            {["Admin", "Manager", "Employee"].map((role, index) => (
              <span
                key={role}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-500 animate-badge-appear hover:border-slate-300 hover:bg-slate-50 transition-colors duration-300 cursor-default"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {role}
              </span>
            ))}
          </div>

          {/* Error message with animation and shake effect */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 animate-error-in animate-shake">
              <span className="mt-0.5 text-lg flex-shrink-0">⚠</span>
              <span className="flex-1">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            {/* Email field */}
            <div className="group">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${emailFocused ? "text-[#217346]" : "text-slate-400"}`} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  placeholder="you@company.com"
                  required
                  autoFocus
                  className={`w-full h-11 rounded-xl border pl-10 pr-3 text-sm bg-white transition-all duration-200 focus:outline-none ${
                    emailFocused
                      ? "border-[#217346] ring-2 ring-[#217346]/20 shadow-md"
                      : "border-slate-300 hover:border-slate-400"
                  }`}
                />
              </div>
            </div>

            {/* Password field */}
            <div className="group">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${passwordFocused ? "text-[#217346]" : "text-slate-400"}`} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder="••••••••"
                  required
                  className={`w-full h-11 rounded-xl border pl-10 pr-10 text-sm bg-white transition-all duration-200 focus:outline-none ${
                    passwordFocused
                      ? "border-[#217346] ring-2 ring-[#217346]/20 shadow-md"
                      : "border-slate-300 hover:border-slate-400"
                  }`}
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

            {/* Sign in button with enhanced animations */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-[#217346] text-white text-sm font-semibold flex items-center justify-center gap-2 mt-2 transition-all duration-200 hover:bg-[#185c37] hover:shadow-lg hover:shadow-[#217346]/30 disabled:opacity-60 disabled:hover:shadow-none active:scale-95"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin-smooth" />
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* CTA with animation — only shown on first-time setup */}
          {needsSetup && (
            <p className="text-center text-sm text-slate-500 mt-6 animate-slide-up" style={{ animationDelay: "0.3s" }}>
              First time setup?{" "}
              <Link
                to="/signup"
                className="text-[#217346] font-semibold hover:underline transition-all duration-200 relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#217346] after:transition-all after:duration-300 hover:after:w-full"
              >
                Create admin account
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
