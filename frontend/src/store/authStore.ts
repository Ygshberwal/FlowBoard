import { create } from "zustand";
import type { User } from "../types/auth";

// SECURITY: tokens live in localStorage per nextsteps.md §2 — any XSS on
// our origin can steal them. Do NOT swap for cookies without also adding
// CSRF + rotation as listed in §10.
const STORAGE_KEY = "flowboard-auth";

interface PersistedAuth {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

function readPersisted(): PersistedAuth {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, accessToken: null, refreshToken: null };
    const parsed = JSON.parse(raw) as Partial<PersistedAuth>;
    return {
      user: parsed.user ?? null,
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
    };
  } catch {
    return { user: null, accessToken: null, refreshToken: null };
  }
}

function writePersisted(state: PersistedAuth): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* localStorage may be unavailable in private mode; skip persisting. */
  }
}

interface AuthStore extends PersistedAuth {
  setSession: (session: {
    user: User;
    accessToken: string;
    refreshToken: string;
  }) => void;
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clear: () => void;
  hydrate: () => void;
}

const initial = readPersisted();

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: initial.user,
  accessToken: initial.accessToken,
  refreshToken: initial.refreshToken,

  setSession: ({ user, accessToken, refreshToken }) => {
    const next = { user, accessToken, refreshToken };
    writePersisted(next);
    set(next);
  },

  setUser: (user) => {
    const { accessToken, refreshToken } = get();
    const next = { user, accessToken, refreshToken };
    writePersisted(next);
    set({ user });
  },

  setTokens: (accessToken, refreshToken) => {
    const { user } = get();
    writePersisted({ user, accessToken, refreshToken });
    set({ accessToken, refreshToken });
  },

  clear: () => {
    writePersisted({ user: null, accessToken: null, refreshToken: null });
    set({ user: null, accessToken: null, refreshToken: null });
  },

  hydrate: () => {
    const next = readPersisted();
    set(next);
  },
}));

export function getAuthSnapshot(): PersistedAuth {
  return {
    user: useAuthStore.getState().user,
    accessToken: useAuthStore.getState().accessToken,
    refreshToken: useAuthStore.getState().refreshToken,
  };
}
