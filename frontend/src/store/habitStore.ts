import { create } from "zustand";
import { habitsApi } from "../api/habits";

interface HabitStore {
  viewYear: number;
  viewMonth: number;
  // key = "habitId-day", value = true (logged) | false (unlogged) — optimistic overrides only
  localLogs: Record<string, boolean>;
  prevMonth: () => void;
  nextMonth: () => void;
  // serverLogs passed in so we can read the real current state before toggling
  toggleLog: (habitId: string, day: number, serverLogs: Record<string, number[]>) => Promise<void>;
  clearLocalLogs: () => void;
}

const now = new Date();

export const useHabitStore = create<HabitStore>((set, get) => ({
  viewYear: now.getFullYear(),
  viewMonth: now.getMonth(),
  localLogs: {},

  prevMonth: () =>
    set((state) => {
      const d = new Date(state.viewYear, state.viewMonth - 1, 1);
      return { viewYear: d.getFullYear(), viewMonth: d.getMonth(), localLogs: {} };
    }),

  nextMonth: () =>
    set((state) => {
      const d = new Date(state.viewYear, state.viewMonth + 1, 1);
      return { viewYear: d.getFullYear(), viewMonth: d.getMonth(), localLogs: {} };
    }),

  clearLocalLogs: () => set({ localLogs: {} }),

  toggleLog: async (habitId, day, serverLogs) => {
    const { viewYear, viewMonth } = get();
    const key = `${habitId}-${day}`;

    // Block future dates
    const today = new Date();
    const clickedDate = new Date(viewYear, viewMonth, day);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (clickedDate > todayMidnight) return;

    // Determine real current state: local override takes priority, else check server logs
    const localOverride = get().localLogs[key];
    const isCurrentlyLogged =
      localOverride !== undefined
        ? localOverride
        : (serverLogs[habitId] || []).includes(day);

    const newState = !isCurrentlyLogged;

    // Optimistic update
    set((state) => ({ localLogs: { ...state.localLogs, [key]: newState } }));

    try {
      const month = viewMonth + 1;
      const dateStr = `${viewYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      await habitsApi.toggleLog(habitId, dateStr);
    } catch (err) {
      // Revert on failure
      set((state) => ({ localLogs: { ...state.localLogs, [key]: isCurrentlyLogged } }));
      console.error("Toggle log failed:", err);
    }
  },
}));
