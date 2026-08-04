import { create } from "zustand";

interface TaskStore {
  selectedTaskId: string | null;
  selectTask: (id: string | null) => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  selectedTaskId: null,
  selectTask: (id) => set({ selectedTaskId: id }),
}));
