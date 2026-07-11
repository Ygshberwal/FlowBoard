import apiClient from "./client";
import type {
  Section,
  SectionWithTasks,
  SectionCreate,
  SectionUpdate,
} from "../types/section";

export const sectionsApi = {
  list: async (): Promise<Section[]> => {
    const { data } = await apiClient.get<Section[]>("/api/sections");
    return data;
  },

  board: async (): Promise<SectionWithTasks[]> => {
    const { data } = await apiClient.get<SectionWithTasks[]>("/api/sections/board");
    return data;
  },

  create: async (payload: SectionCreate): Promise<Section> => {
    const { data } = await apiClient.post<Section>("/api/sections", payload);
    return data;
  },

  update: async (id: string, payload: SectionUpdate): Promise<Section> => {
    const { data } = await apiClient.patch<Section>(`/api/sections/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/sections/${id}`);
  },

  reorder: async (orderedIds: string[]): Promise<Section[]> => {
    const { data } = await apiClient.patch<Section[]>("/api/sections/reorder", {
      ordered_ids: orderedIds,
    });
    return data;
  },
};
