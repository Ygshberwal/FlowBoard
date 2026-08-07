const API_BASE = import.meta.env.VITE_API_URL || "";

export function resolveAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl;
  return `${API_BASE}${avatarUrl}`;
}

export function initialsFor(name: string | null | undefined): string {
  if (!name) return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return trimmed[0]!.toUpperCase();
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[1]![0]).toUpperCase();
}

export function displayName(name: string | null | undefined): string {
  if (!name) return "there";
  const first = name.trim().split(/[\s._-]+/)[0];
  if (!first) return "there";
  return first.charAt(0).toUpperCase() + first.slice(1);
}
