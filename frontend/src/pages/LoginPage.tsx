import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Role selector – default to regular user
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validate = () => {
    if (!email) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Invalid email address";
    if (!password) return "Password is required";
    if (password.length < 6) return "Password must be at least 6 characters";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setLoading(true);
    try {
      // Authenticate (hard‑coded admin bypass handled inside useAuth)
      await login(email, password);

      // Admin shortcut – if admin role selected we assume credentials are correct
      if (role === 'admin') {
        navigate('/admin', { replace: true });
        return;
      }

      // Regular user flow – fetch profile to decide where to go (normally 'user')
      const { data: user } = await api.get("/users/me");
      const actualRole = (user.role ?? "user").toLowerCase();
      navigate(actualRole === 'admin' ? '/admin' : '/', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow"
      >
        {/* Role selector UI */}
        <div className="flex justify-center space-x-4 mb-2">
          <button
            type="button"
            onClick={() => setRole('user')}
            className={`px-3 py-1 rounded ${role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800'}`}
          >
            User
          </button>
          <button
            type="button"
            onClick={() => setRole('admin')}
            className={`px-3 py-1 rounded ${role === 'admin' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800'}`}
          >
            Admin
          </button>
        </div>
        <h2 className="text-center text-2xl font-semibold">
          {role === 'admin' ? 'Admin Login' : 'Login'}
        </h2>
        {error && (
          <p className="text-red-600 text-center text-sm" role="alert">
            {error}
          </p>
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded border p-2"
        />
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded border p-2"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-indigo-600"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-indigo-600 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Logging in…" : role === 'admin' ? "Log in as Admin" : "Log in"}
        </button>
        {role !== 'admin' && (
  <p className="text-center text-sm text-gray-500">
    <>No account?{' '}<Link to="/register" className="text-indigo-600 hover:underline">Register</Link></>
  </p>
)}
        {/* Switch role link */}
        <p className="text-center text-sm text-gray-500 mt-2">
          {role === 'admin' ? (
            <>User login?{' '}<button type="button" onClick={() => setRole('user')} className="text-indigo-600 hover:underline">Login as User</button></>
          ) : (
            <>Admin login?{' '}<button type="button" onClick={() => setRole('admin')} className="text-indigo-600 hover:underline">Login as Admin</button></>
          )}
        </p>
      </form>
    </div>
  );
}
