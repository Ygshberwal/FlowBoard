export interface Habit {
  id: string;
  name: string;
  color: string;
  category: string | null;
  sort_order: number;
  archived: boolean;
  created_at: string;
}

export interface HabitCreate {
  name: string;
  color?: string;
  category?: string;
  sort_order?: number;
}

export interface HabitUpdate {
  name?: string;
  color?: string;
  category?: string;
  sort_order?: number;
}

export interface HabitStreak {
  habit_id: string;
  current_streak: number;
  longest_streak: number;
  last_logged: string | null;
  updated_at: string;
}

export interface HabitLogsResponse {
  logs: Record<string, string[]>;
}

export interface HabitAnalyticsItem {
  habit_id: string;
  name: string;
  color: string;
  completion_pct: number;
  logged_days: number;
  total_days: number;
}

export interface HabitAnalyticsResponse {
  overall_pct: number;
  habits: HabitAnalyticsItem[];
}
