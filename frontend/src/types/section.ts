import type { Task } from "./task";

export interface Section {
  id: string;
  name: string;
  position: number;
  created_at: string;
}

export interface SectionWithTasks extends Section {
  tasks: Task[];
}

export interface SectionCreate {
  name: string;
  position?: number;
}

export interface SectionUpdate {
  name?: string;
  position?: number;
}
