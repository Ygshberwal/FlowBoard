import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { authApi } from "../../api/auth";
import { initialsFor, resolveAvatarUrl } from "../../lib/avatar";

export default function UserMenu() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clear = useAuthStore((s) => s.clear);

  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  if (!user) return null;

  const avatarSrc = resolveAvatarUrl(user.avatar_url);
  const initials = initialsFor(user.username);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      if (refreshToken) {
        try {
          await authApi.logout(refreshToken);
        } catch {
          /* Ignore server-side logout errors; local session is cleared below. */
        }
      }
    } finally {
      clear();
      setLoggingOut(false);
      setOpen(false);
      navigate("/login", { replace: true });
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={user.username}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-indigo-500/30 ring-2 ring-white dark:ring-slate-800 overflow-hidden"
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={user.username}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-xl glass shadow-card ring-1 ring-slate-200/70 dark:ring-white/10 overflow-hidden z-30"
        >
          <div className="px-4 py-3 border-b border-slate-200/70 dark:border-white/10">
            <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {user.username}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {user.email}
            </div>
          </div>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate("/profile");
            }}
            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-white/10"
          >
            Profile settings
          </button>
          <button
            role="menuitem"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-white/70 dark:hover:bg-white/10 disabled:opacity-60"
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}
