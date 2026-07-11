import apiClient from "./client";
import type { Task, TaskCreate, TaskUpdate, TaskCounts, TaskComment } from "../types/task";

export const tasksApi = {
  list: async (view: string): Promise<Task[]> => {
    const { data } = await apiClient.get<Task[]>(`/api/tasks?view=${view}`);
    return data;
  },

  counts: async (): Promise<TaskCounts> => {
    const { data } = await apiClient.get<TaskCounts>("/api/tasks/counts");
    return data;
  },

  get: async (id: string): Promise<Task> => {
    const { data } = await apiClient.get<Task>(`/api/tasks/${id}`);
    return data;
  },

  create: async (payload: TaskCreate): Promise<Task> => {
    const { data } = await apiClient.post<Task>("/api/tasks", payload);
    return data;
  },

  update: async (id: string, payload: TaskUpdate): Promise<Task> => {
    const { data } = await apiClient.patch<Task>(`/api/tasks/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/tasks/${id}`);
  },

  toggle: async (id: string): Promise<Task> => {
    const { data } = await apiClient.patch<Task>(`/api/tasks/${id}/toggle`);
    return data;
  },

  addComment: async (
    taskId: string,
    body: string,
    authorName = "You"
  ): Promise<TaskComment> => {
    const { data } = await apiClient.post<TaskComment>(
      `/api/tasks/${taskId}/comments`,
      { body, author_name: authorName }
    );
    return data;
  },
};
