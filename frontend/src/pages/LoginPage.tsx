import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { authApi } from "../api/auth";
import { useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";
import ThemeToggle from "../components/layout/ThemeToggle";
import PasswordInput from "../components/ui/PasswordInput";

interface LocationState {
  from?: { pathname?: string };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from =
    (location.state as LocationState | null)?.from?.pathname || "/planner";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!identifier.trim() || !password) {
      setError("Please enter your username/email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authApi.login({
        identifier: identifier.trim(),
        password,
      });
      setSession({
        user: res.user,
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
      });
      toast.success(`Welcome back, ${res.user.username}`);
      navigate(from, { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError("Invalid username/email or password.");
      } else if (axios.isAxiosError(err) && !err.response) {
        setError("Can't reach the server. Please try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10 relative">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md rounded-2xl glass shadow-card ring-1 ring-slate-200/70 dark:ring-white/10 p-8">
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/30">
            <span className="text-white text-sm font-extrabold">F</span>
          </div>
          <span className="font-extrabold text-slate-800 dark:text-white text-lg tracking-tight">
            FlowBoard
          </span>
        </div>

        <h1 className="text-xl font-bold text-slate-900 dark:text-white text-center">
          Welcome back
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-1">
          Sign in with your username or email.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="login-identifier"
              className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Username or email
            </label>
            <input
              id="login-identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              placeholder="you or you@example.com"
              required
              autoFocus
            />
          </div>
          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Password
            </label>
            <PasswordInput
              id="login-password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 text-sm shadow-md shadow-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            className="text-indigo-600 dark:text-indigo-300 hover:underline font-semibold"
          >
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
