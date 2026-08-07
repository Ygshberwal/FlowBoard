import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { authApi } from "../api/auth";
import { useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";
import ThemeToggle from "../components/layout/ThemeToggle";
import PasswordInput from "../components/ui/PasswordInput";
import { initialsFor } from "../lib/avatar";

const USERNAME_RE = /^[a-zA-Z0-9_.-]+$/;
const MOBILE_RE = /^\+[1-9]\d{6,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_AVATAR_MIME = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function validateForm({
  username,
  email,
  password,
  mobile,
}: {
  username: string;
  email: string;
  password: string;
  mobile: string;
}): string | null {
  if (username.length < 3 || username.length > 32) {
    return "Username must be 3-32 characters.";
  }
  if (!USERNAME_RE.test(username)) {
    return "Username may only contain letters, digits, '_', '.', '-'.";
  }
  if (!EMAIL_RE.test(email)) {
    return "Please enter a valid email address.";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!MOBILE_RE.test(mobile)) {
    return "Mobile must be in E.164 format like +911234567890.";
  }
  return null;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const setUser = useAuthStore((s) => s.setUser);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setAvatarError(null);
    if (!file) {
      setAvatarFile(null);
      return;
    }
    if (!ALLOWED_AVATAR_MIME.includes(file.type)) {
      setAvatarError("Avatar must be PNG, JPEG, or WebP.");
      setAvatarFile(null);
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Avatar must be 2 MB or smaller.");
      setAvatarFile(null);
      return;
    }
    setAvatarFile(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validateForm({ username, email, password, mobile });
    if (validationError) {
      setError(validationError);
      return;
    }
    if (avatarError) {
      setError(avatarError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await authApi.register({
        username: username.trim(),
        email: email.trim(),
        password,
        mobile_number: mobile.trim(),
      });
      setSession({
        user: res.user,
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
      });

      let landedUser = res.user;
      if (avatarFile) {
        try {
          const uploaded = await authApi.uploadAvatar(avatarFile);
          landedUser = { ...res.user, avatar_url: uploaded.avatar_url };
          setUser(landedUser);
        } catch {
          toast.error(
            "Account created, but the display picture couldn't be uploaded. Try again from Profile."
          );
        }
      }

      toast.success(`Welcome, ${landedUser.username}!`);
      navigate("/planner", { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        if (err.response.status === 409) {
          setError("Username or email is already taken.");
        } else if (err.response.status === 422) {
          setError("Some fields are invalid. Please review and try again.");
        } else {
          setError("Something went wrong. Please try again.");
        }
      } else {
        setError("Network error. Please try again.");
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
          Create your account
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-1">
          It only takes a minute.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="reg-username" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Username
            </label>
            <input
              id="reg-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              placeholder="3-32 chars, letters/digits/_.-"
              required
            />
          </div>
          <div>
            <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Password
            </label>
            <PasswordInput
              id="reg-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              showStrength
            />
          </div>
          <div>
            <label htmlFor="reg-mobile" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Mobile number
            </label>
            <input
              id="reg-mobile"
              type="tel"
              autoComplete="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              placeholder="+911234567890"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Display picture (optional)
            </label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-indigo-500/30 overflow-hidden ring-2 ring-white dark:ring-slate-800 flex-shrink-0">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <span>{initialsFor(username || "?")}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <input
                  id="reg-avatar"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarChange}
                  className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-500/20 dark:file:text-indigo-200"
                />
                {avatarFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarError(null);
                      const el = document.getElementById("reg-avatar") as HTMLInputElement | null;
                      if (el) el.value = "";
                    }}
                    className="mt-1 text-[11px] font-semibold text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-300"
                  >
                    Clear selection
                  </button>
                )}
              </div>
            </div>
            {avatarError && (
              <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                {avatarError}
              </div>
            )}
          </div>

          {error && (
            <div role="alert" className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 text-sm shadow-md shadow-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-indigo-600 dark:text-indigo-300 hover:underline font-semibold"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
