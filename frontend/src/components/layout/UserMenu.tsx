import { useEffect, useId, useRef, useState } from "react";
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
  const [avatarFailed, setAvatarFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const openAtEnd = useRef(false);

  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]");
    if (items?.length) items[openAtEnd.current ? items.length - 1 : 0].focus();
    function onDocClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
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
    <div ref={containerRef} className="relative" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
    }}>
      <button
        ref={triggerRef}
        onClick={() => { openAtEnd.current = false; setOpen((v) => !v); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openAtEnd.current = event.key === "ArrowUp";
            setOpen(true);
          }
        }}
        title={user.username}
        aria-label={`Account menu for ${user.username}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shadow-sm ring-2 ring-white dark:ring-slate-800 overflow-hidden"
      >
        {avatarSrc && !avatarFailed ? (
          <img
            src={avatarSrc}
            alt={user.username}
            className="w-full h-full object-cover"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <span>{initials}</span>
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Account"
          onKeyDown={(event) => {
            const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)"));
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            let next: number;
            if (event.key === "ArrowDown") next = (index + 1) % items.length;
            else if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = items.length - 1;
            else return;
            event.preventDefault();
            items[next]?.focus();
          }}
          className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl bg-white shadow-column ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-white/10 overflow-hidden z-30"
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
            className="min-h-11 w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10"
          >
            Profile settings
          </button>
          <button
            role="menuitem"
            onClick={handleLogout}
            disabled={loggingOut}
            className="min-h-11 w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-60"
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}
