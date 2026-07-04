import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "";

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error(`API Error ${error.response.status}:`, error.response.data);
    } else if (error.request) {
      console.error("Network error — no response received");
    }
    return Promise.reject(error);
  }
);

export default apiClient;
