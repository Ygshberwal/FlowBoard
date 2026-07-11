import { create } from "zustand";
import type { TaskStatus } from "../types/task";

interface TaskStore {
  currentView: TaskStatus;
  selectedTaskId: string | null;
  setView: (view: TaskStatus) => void;
  selectTask: (id: string | null) => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  currentView: "today",
  selectedTaskId: null,
  setView: (view) => set({ currentView: view, selectedTaskId: null }),
  selectTask: (id) => set({ selectedTaskId: id }),
}));
