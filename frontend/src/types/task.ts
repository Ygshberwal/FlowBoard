export type TaskPriority = "low" | "medium" | "high";

export interface TaskComment {
  id: string;
  task_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  section_id: string | null;
  priority: TaskPriority;
  category: string | null;
  estimated_mins: number | null;
  deadline: string | null;
  scheduled_for: string | null;
  done: boolean;
  created_at: string;
  updated_at: string;
  comments: TaskComment[];
}

export interface TaskCreate {
  title: string;
  description?: string;
  section_id?: string | null;
  priority?: TaskPriority;
  category?: string;
  estimated_mins?: number;
  deadline?: string;
  scheduled_for?: string;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  section_id?: string | null;
  priority?: TaskPriority;
  category?: string;
  estimated_mins?: number;
  deadline?: string;
  scheduled_for?: string;
  done?: boolean;
}

export interface TaskCounts {
  today: number;
  week: number;
}
