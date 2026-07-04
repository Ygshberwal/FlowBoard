import apiClient from "./client";
import type {
  Habit,
  HabitCreate,
  HabitUpdate,
  HabitStreak,
  HabitLogsResponse,
  HabitAnalyticsResponse,
} from "../types/habit";

export const habitsApi = {
  list: async (): Promise<Habit[]> => {
    const { data } = await apiClient.get<Habit[]>("/api/habits");
    return data;
  },

  create: async (payload: HabitCreate): Promise<Habit> => {
    const { data } = await apiClient.post<Habit>("/api/habits", payload);
    return data;
  },

  update: async (id: string, payload: HabitUpdate): Promise<Habit> => {
    const { data } = await apiClient.patch<Habit>(`/api/habits/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/habits/${id}`);
  },

  toggleLog: async (habitId: string, date: string): Promise<{ logged: boolean; date: string }> => {
    const { data } = await apiClient.post(`/api/habits/${habitId}/logs`, { date });
    return data;
  },

  getLogs: async (year: number, month: number): Promise<HabitLogsResponse> => {
    const { data } = await apiClient.get<HabitLogsResponse>(
      `/api/habits/logs?year=${year}&month=${month}`
    );
    return data;
  },

  getStreaks: async (): Promise<HabitStreak[]> => {
    const { data } = await apiClient.get<HabitStreak[]>("/api/habits/streaks");
    return data;
  },

  getLogsYear: async (year: number): Promise<HabitLogsResponse> => {
    const { data } = await apiClient.get<HabitLogsResponse>(`/api/habits/logs/year?year=${year}`);
    return data;
  },

  getAnalytics: async (year: number, month: number): Promise<HabitAnalyticsResponse> => {
    const { data } = await apiClient.get<HabitAnalyticsResponse>(
      `/api/analytics/habits?year=${year}&month=${month}`
    );
    return data;
  },
};
