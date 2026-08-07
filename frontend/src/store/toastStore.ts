import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastStore {
  toasts: Toast[];
  push: (kind: ToastKind, message: string, ttlMs?: number) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 1;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (kind, message, ttlMs = 4000) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    if (ttlMs > 0) {
      setTimeout(() => get().dismiss(id), ttlMs);
    }
    return id;
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

export const toast = {
  success: (msg: string, ttlMs?: number) =>
    useToastStore.getState().push("success", msg, ttlMs),
  error: (msg: string, ttlMs?: number) =>
    useToastStore.getState().push("error", msg, ttlMs),
  info: (msg: string, ttlMs?: number) =>
    useToastStore.getState().push("info", msg, ttlMs),
};
