import { create } from "zustand";
import { habitsApi } from "../api/habits";

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface HabitStore {
  viewYear: number;
  viewMonth: number;
  localLogs: Record<string, boolean>;
  prevMonth: () => void;
  nextMonth: () => void;
  toggleLog: (habitId: string, day: number, serverLogs: Record<string, string[]>) => Promise<void>;
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
    const dateStr = isoDate(viewYear, viewMonth, day);
    const key = `${habitId}::${dateStr}`;

    const today = new Date();
    const clickedDate = new Date(viewYear, viewMonth, day);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (clickedDate > todayMidnight) return;

    const localOverride = get().localLogs[key];
    const isCurrentlyLogged =
      localOverride !== undefined
        ? localOverride
        : (serverLogs[habitId] || []).includes(dateStr);

    const newState = !isCurrentlyLogged;
    set((state) => ({ localLogs: { ...state.localLogs, [key]: newState } }));

    try {
      await habitsApi.toggleLog(habitId, dateStr);
    } catch (err) {
      set((state) => ({ localLogs: { ...state.localLogs, [key]: isCurrentlyLogged } }));
      console.error("Toggle log failed:", err);
    }
  },
}));
