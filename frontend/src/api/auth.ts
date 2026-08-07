import apiClient from "./client";
import type {
  AvatarUploadResponse,
  DeleteAccountRequest,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  TokenPair,
  User,
  UserUpdate,
  UserUpdateResponse,
} from "../types/auth";

export const authApi = {
  register: async (payload: RegisterRequest): Promise<RegisterResponse> => {
    const { data } = await apiClient.post<RegisterResponse>(
      "/api/auth/register",
      payload
    );
    return data;
  },

  login: async (payload: LoginRequest): Promise<RegisterResponse> => {
    const { data } = await apiClient.post<RegisterResponse>(
      "/api/auth/login",
      payload
    );
    return data;
  },

  refresh: async (refreshToken: string): Promise<TokenPair> => {
    const { data } = await apiClient.post<TokenPair>("/api/auth/refresh", {
      refresh_token: refreshToken,
    });
    return data;
  },

  logout: async (refreshToken: string): Promise<void> => {
    await apiClient.post("/api/auth/logout", { refresh_token: refreshToken });
  },

  me: async (): Promise<User> => {
    const { data } = await apiClient.get<User>("/api/auth/me");
    return data;
  },

  updateMe: async (payload: UserUpdate): Promise<UserUpdateResponse> => {
    const { data } = await apiClient.patch<UserUpdateResponse>(
      "/api/auth/me",
      payload
    );
    return data;
  },

  uploadAvatar: async (file: File): Promise<AvatarUploadResponse> => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post<AvatarUploadResponse>(
      "/api/auth/me/avatar",
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return data;
  },

  deleteAvatar: async (): Promise<User> => {
    const { data } = await apiClient.delete<User>("/api/auth/me/avatar");
    return data;
  },

  deleteAccount: async (payload: DeleteAccountRequest): Promise<void> => {
    await apiClient.delete("/api/auth/me", { data: payload });
  },
};
