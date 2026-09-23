import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ADMIN_EMAIL = "admin@gmail.com";
const ADMIN_PASSWORD = "admin@123";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<"user" | "admin">("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      if (role === "admin") {
        // Admin: hard-coded credentials only
        if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
          setError("Invalid admin credentials.");
          setLoading(false);
          return;
        }
        await login(email, password); // sets "admin-token" in localStorage
        navigate("/admin", { replace: true });
      } else {
        // Regular user: call backend
        await login(email, password);
        navigate("/", { replace: true });
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail ?? "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🚨</div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text)' }}>Emergency Response</h1>
          <p className="mt-1" style={{ color: 'var(--text-muted)' }}>Hybrid Emergency Response Platform</p>
        </div>

        <div className="rounded-2xl shadow-xl p-8 space-y-5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          {/* Role Tabs */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => { setRole("user"); setError(""); }}
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                role === "user"
                  ? "bg-indigo-600 text-white"
                  : "hover:opacity-80"
              }`}
              style={role !== "user" ? { backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)' } : {}}
            >
              👤 Citizen / Responder
            </button>
            <button
              type="button"
              onClick={() => { setRole("admin"); setError(""); }}
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                role === "admin"
                  ? "bg-red-600 text-white"
                  : "hover:opacity-80"
              }`}
              style={role !== "admin" ? { backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)' } : {}}
            >
              🛡️ Admin
            </button>
          </div>

          <h2 className="text-xl font-bold text-center" style={{ color: 'var(--text)' }}>
            {role === "admin" ? "Admin Command Centre Login" : "Citizen Login"}
          </h2>

          {error && (
            <div className="border border-red-400/50 rounded-lg px-4 py-3 text-sm text-red-500" style={{ backgroundColor: 'color-mix(in srgb, #ef4444 8%, var(--bg))' }}>
              {error}
            </div>
          )}

          {role === "admin" && (
            <div className="border border-amber-400/50 rounded-lg px-4 py-3 text-sm text-amber-600 dark:text-amber-400" style={{ backgroundColor: 'color-mix(in srgb, #f59e0b 8%, var(--bg))' }}>
              ⚠️ Admin credentials are required. Contact your system administrator if you don't have access.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-lg px-3 py-2 pr-16 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-indigo-500 font-medium"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-all disabled:opacity-50 ${
                role === "admin"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {loading ? "Signing in…" : role === "admin" ? "🛡️ Sign in as Admin" : "Sign In"}
            </button>
          </form>

          {role === "user" && (
            <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No account?{" "}
              <Link to="/register" className="text-indigo-500 font-medium hover:underline">
                Register here
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
