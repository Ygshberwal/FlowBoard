import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/authStore";

const BASE_URL = import.meta.env.VITE_API_URL || "";

const AUTH_SKIP_PATHS = [
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/refresh",
];

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const url = config.url || "";
  const shouldSkip = AUTH_SKIP_PATHS.some((path) => url.endsWith(path));
  if (!shouldSkip) {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
  }
  return config;
});

let refreshInFlight: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post<{ access_token: string; refresh_token: string }>(
      `${BASE_URL}/api/auth/refresh`,
      { refresh_token: refreshToken },
      { headers: { "Content-Type": "application/json" }, timeout: 15000 }
    );
    useAuthStore.getState().setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

function bounceToLogin(): void {
  useAuthStore.getState().clear();
  if (
    typeof window !== "undefined" &&
    window.location.pathname !== "/login" &&
    window.location.pathname !== "/register"
  ) {
    window.location.href = "/login";
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (AxiosRequestConfig & { _retriedForAuth?: boolean })
      | undefined;

    if (error.response) {
      const status = error.response.status;
      const url = originalRequest?.url || "";
      const isAuthEndpoint = AUTH_SKIP_PATHS.some((path) => url.endsWith(path));

      if (status === 401 && originalRequest && !originalRequest._retriedForAuth && !isAuthEndpoint) {
        originalRequest._retriedForAuth = true;
        if (!refreshInFlight) {
          refreshInFlight = performRefresh().finally(() => {
            refreshInFlight = null;
          });
        }
        const newToken = await refreshInFlight;
        if (newToken) {
          originalRequest.headers = originalRequest.headers ?? {};
          (originalRequest.headers as Record<string, string>)["Authorization"] =
            `Bearer ${newToken}`;
          return apiClient.request(originalRequest);
        }
        bounceToLogin();
      } else if (status === 401 && url.endsWith("/api/auth/refresh")) {
        bounceToLogin();
      }

      if (status !== 401 || !isAuthEndpoint) {
        console.error(`API Error ${status}:`, error.response.data);
      }
    } else if (error.request) {
      console.error("Network error — no response received");
    }
    return Promise.reject(error);
  }
);

export default apiClient;
