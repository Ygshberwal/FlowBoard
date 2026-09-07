import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { authApi } from "../api/auth";
import { useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";
import { initialsFor, resolveAvatarUrl } from "../lib/avatar";
import PasswordInput from "../components/ui/PasswordInput";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import type { UserUpdate } from "../types/auth";

const USERNAME_RE = /^[a-zA-Z0-9_.-]+$/;
const MOBILE_RE = /^\+[1-9]\d{6,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_AVATAR_MIME = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const setSession = useAuthStore((s) => s.setSession);
  const clear = useAuthStore((s) => s.clear);

  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [mobile, setMobile] = useState(user?.mobile_number ?? "");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [savedAvatarFailed, setSavedAvatarFailed] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  useEffect(() => {
    setSavedAvatarFailed(false);
  }, [user?.avatar_url]);

  if (!user) {
    return (
      <div className="min-h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Not signed in.
      </div>
    );
  }

  const savedAvatar = resolveAvatarUrl(user.avatar_url);
  const usernameChanged = username.trim() !== user.username;
  const emailChanged = email.trim() !== user.email;
  const mobileChanged = mobile.trim() !== user.mobile_number;
  const passwordChanging = password.length > 0;
  const requiresCurrent = passwordChanging || emailChanged;
  const anyFieldChange =
    usernameChanged || emailChanged || mobileChanged || passwordChanging;

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

  async function handleUploadAvatarNow() {
    if (!avatarFile) return;
    setUploadingAvatar(true);
    try {
      const uploaded = await authApi.uploadAvatar(avatarFile);
      setUser({ ...user!, avatar_url: uploaded.avatar_url });
      setAvatarFile(null);
      const el = document.getElementById("profile-avatar") as HTMLInputElement | null;
      if (el) el.value = "";
      toast.success("Profile picture updated.");
    } catch {
      toast.error("Could not upload the new picture. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleRemoveAvatar() {
    if (!user!.avatar_url) return;
    setRemovingAvatar(true);
    try {
      const updated = await authApi.deleteAvatar();
      setUser(updated);
      toast.success("Profile picture removed.");
    } catch {
      toast.error("Could not remove the picture. Please try again.");
    } finally {
      setRemovingAvatar(false);
    }
  }

  async function handleSaveFields(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!anyFieldChange) {
      toast.info("No changes to save.");
      return;
    }

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    const trimmedMobile = mobile.trim();

    if (
      trimmedUsername.length < 3 ||
      trimmedUsername.length > 32 ||
      !USERNAME_RE.test(trimmedUsername)
    ) {
      setError("Invalid username (3-32 chars, letters/digits/_.-).");
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!MOBILE_RE.test(trimmedMobile)) {
      setError("Mobile must be in E.164 format like +911234567890.");
      return;
    }
    if (passwordChanging && password.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (requiresCurrent && !currentPassword) {
      setError("Please enter your current password to confirm this change.");
      return;
    }

    setSaving(true);
    try {
      const patch: UserUpdate = {};
      if (usernameChanged) patch.username = trimmedUsername;
      if (emailChanged) patch.email = trimmedEmail;
      if (mobileChanged) patch.mobile_number = trimmedMobile;
      if (passwordChanging) patch.password = password;
      if (requiresCurrent) patch.current_password = currentPassword;

      const res = await authApi.updateMe(patch);
      if (res.access_token && res.refresh_token) {
        setSession({
          user: res.user,
          accessToken: res.access_token,
          refreshToken: res.refresh_token,
        });
      } else {
        setUser(res.user);
      }
      setPassword("");
      setCurrentPassword("");
      toast.success(
        passwordChanging
          ? "Profile updated. Other sessions signed out."
          : "Profile updated."
      );
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        const status = err.response.status;
        if (status === 409) {
          setError("Username or email is already taken.");
        } else if (status === 400) {
          const detail = (err.response.data as { detail?: string })?.detail;
          setError(detail || "Please check your input and try again.");
        } else if (status === 422) {
          setError("Some fields are invalid. Please review them.");
        } else {
          setError("Could not save changes. Please try again.");
        }
      } else {
        setError("Network error. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteError(null);
    if (!deletePassword) {
      setDeleteError("Please confirm your current password.");
      return;
    }
    setDeleteBusy(true);
    try {
      await authApi.deleteAccount({ current_password: deletePassword });
      clear();
      toast.info("Your account was deleted.");
      navigate("/login", { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        if (err.response.status === 400) {
          setDeleteError("That password isn't right.");
        } else {
          setDeleteError("Could not delete the account. Please try again.");
        }
      } else {
        setDeleteError("Network error. Please try again.");
      }
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-8">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Profile settings
          </h1>
          <Link
            to="/planner"
            className="text-sm text-indigo-600 dark:text-indigo-300 hover:underline"
          >
            Back to planner
          </Link>
        </div>

        {/* Identity + avatar */}
        <div className="rounded-2xl glass shadow-card ring-1 ring-slate-200/70 dark:ring-white/10 p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-lg font-bold shadow-md shadow-indigo-500/30 overflow-hidden ring-2 ring-white dark:ring-slate-800">
              {avatarPreview ? (
                <img src={avatarPreview} alt="new" className="w-full h-full object-cover" />
              ) : savedAvatar && !savedAvatarFailed ? (
                <img
                  src={savedAvatar}
                  alt={user.username}
                  className="w-full h-full object-cover"
                  onError={() => setSavedAvatarFailed(true)}
                />
              ) : (
                <span>{initialsFor(user.username)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {user.username}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {user.email}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <label
                  htmlFor="profile-avatar"
                  className="cursor-pointer text-xs font-semibold rounded-lg px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-500/30"
                >
                  Choose picture…
                </label>
                <input
                  id="profile-avatar"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                {avatarFile && (
                  <>
                    <button
                      type="button"
                      onClick={handleUploadAvatarNow}
                      disabled={uploadingAvatar}
                      className="text-xs font-semibold rounded-lg px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm disabled:opacity-60"
                    >
                      {uploadingAvatar ? "Uploading…" : "Save picture"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarFile(null);
                        setAvatarError(null);
                        const el = document.getElementById("profile-avatar") as HTMLInputElement | null;
                        if (el) el.value = "";
                      }}
                      disabled={uploadingAvatar}
                      className="text-xs font-semibold rounded-lg px-2.5 py-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {!avatarFile && user.avatar_url && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={removingAvatar}
                    className="text-xs font-semibold rounded-lg px-2.5 py-1 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-60"
                  >
                    {removingAvatar ? "Removing…" : "Remove picture"}
                  </button>
                )}
              </div>
              {avatarError && (
                <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {avatarError}
                </div>
              )}
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                PNG, JPEG, or WebP. Up to 2&nbsp;MB.
              </p>
            </div>
          </div>
        </div>

        {/* Account fields */}
        <form
          onSubmit={handleSaveFields}
          className="rounded-2xl glass shadow-card ring-1 ring-slate-200/70 dark:ring-white/10 p-6 space-y-4"
        >
          <div>
            <label htmlFor="profile-username" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Username
            </label>
            <input
              id="profile-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              required
            />
          </div>
          <div>
            <label htmlFor="profile-email" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Email
              {emailChanged && (
                <span className="ml-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  · requires current password
                </span>
              )}
            </label>
            <input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              required
            />
          </div>
          <div>
            <label htmlFor="profile-mobile" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Mobile number
            </label>
            <input
              id="profile-mobile"
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              required
            />
          </div>
          <div>
            <label htmlFor="profile-new-password" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              New password
              <span className="ml-1 text-[10px] text-slate-400">(leave blank to keep current)</span>
            </label>
            <PasswordInput
              id="profile-new-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              showStrength
            />
          </div>

          {requiresCurrent && (
            <div>
              <label htmlFor="profile-current-password" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Current password
                <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                  required
                </span>
              </label>
              <PasswordInput
                id="profile-current-password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Confirm it's you"
                required={requiresCurrent}
              />
            </div>
          )}

          {error && (
            <div role="alert" className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !anyFieldChange}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 text-sm shadow-md shadow-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {!anyFieldChange && !error && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
              No changes to save yet.
            </p>
          )}
        </form>

        {/* Danger zone */}
        <div className="rounded-2xl ring-1 ring-red-200/70 dark:ring-red-500/20 bg-red-50/60 dark:bg-red-500/5 shadow-card p-6">
          <h2 className="text-sm font-bold text-red-700 dark:text-red-300">
            Danger zone
          </h2>
          <p className="text-xs text-red-600/80 dark:text-red-300/80 mt-1 leading-snug">
            Deleting your account permanently removes your sections, tasks,
            habits, comments, and streaks. This can&apos;t be undone.
          </p>
          <button
            type="button"
            onClick={() => {
              setDeletePassword("");
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            className="mt-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-3.5 py-1.5 shadow-md shadow-red-500/20"
          >
            Delete account…
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete your account?"
        tone="danger"
        confirmLabel="Yes, delete forever"
        cancelLabel="Keep account"
        busy={deleteBusy}
        onCancel={() => {
          if (deleteBusy) return;
          setDeleteOpen(false);
        }}
        onConfirm={handleDeleteAccount}
        description={
          <>
            <span className="font-semibold text-red-700 dark:text-red-300">
              This is permanent.
            </span>{" "}
            All your data will be removed. Type your password below to confirm.
          </>
        }
      >
        <PasswordInput
          autoComplete="current-password"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
          placeholder="Your current password"
          autoFocus
        />
        {deleteError && (
          <div className="mt-2 text-xs text-red-700 dark:text-red-300">
            {deleteError}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
