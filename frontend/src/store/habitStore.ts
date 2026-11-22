import { create } from "zustand";
import { habitsApi } from "../api/habits";
import { toast } from "./toastStore";

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface HabitStore {
  viewYear: number;
  viewMonth: number;
  localLogs: Record<string, boolean>;
  pendingLogs: Record<string, boolean>;
  prevMonth: () => void;
  nextMonth: () => void;
  setViewDate: (year: number, month: number) => void;
  toggleLog: (habitId: string, day: number, serverLogs: Record<string, string[]>) => Promise<boolean>;
  reconcileLogs: (serverLogs: Record<string, string[]>) => void;
  clearLocalLogs: () => void;
}

const now = new Date();

export const useHabitStore = create<HabitStore>((set, get) => ({
  viewYear: now.getFullYear(),
  viewMonth: now.getMonth(),
  localLogs: {},
  pendingLogs: {},

  setViewDate: (viewYear, viewMonth) => set({ viewYear, viewMonth }),

  prevMonth: () =>
    set((state) => {
      const d = new Date(state.viewYear, state.viewMonth - 1, 1);
      return { viewYear: d.getFullYear(), viewMonth: d.getMonth() };
    }),

  nextMonth: () =>
    set((state) => {
      const d = new Date(state.viewYear, state.viewMonth + 1, 1);
      return { viewYear: d.getFullYear(), viewMonth: d.getMonth() };
    }),

  clearLocalLogs: () => set({ localLogs: {} }),

  reconcileLogs: (serverLogs) => set((state) => {
    const localLogs = { ...state.localLogs };
    const prefix = `${state.viewYear}-${String(state.viewMonth + 1).padStart(2, "0")}-`;
    Object.entries(localLogs).forEach(([key, done]) => {
      const [habitId, date] = key.split("::");
      if (date.startsWith(prefix) && !state.pendingLogs[key] && (serverLogs[habitId] || []).includes(date) === done) delete localLogs[key];
    });
    return { localLogs };
  }),

  toggleLog: async (habitId, day, serverLogs) => {
    const { viewYear, viewMonth } = get();
    const dateStr = isoDate(viewYear, viewMonth, day);
    const key = `${habitId}::${dateStr}`;
    if (get().pendingLogs[key]) return false;

    const today = new Date();
    const clickedDate = new Date(viewYear, viewMonth, day);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (clickedDate > todayMidnight) return false;

    const localOverride = get().localLogs[key];
    const isCurrentlyLogged =
      localOverride !== undefined
        ? localOverride
        : (serverLogs[habitId] || []).includes(dateStr);

    const newState = !isCurrentlyLogged;
    set((state) => ({ localLogs: { ...state.localLogs, [key]: newState }, pendingLogs: { ...state.pendingLogs, [key]: true } }));

    try {
      const { logged } = await habitsApi.toggleLog(habitId, dateStr);
      set((state) => ({ localLogs: { ...state.localLogs, [key]: logged } }));
      return true;
    } catch (err) {
      set((state) => ({ localLogs: { ...state.localLogs, [key]: isCurrentlyLogged } }));
      toast.error("Could not save your check-in. Please try again.");
      return false;
    } finally {
      set((state) => {
        const pendingLogs = { ...state.pendingLogs };
        delete pendingLogs[key];
        return { pendingLogs };
      });
    }
  },
}));
