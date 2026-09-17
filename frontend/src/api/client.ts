import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      // Network error — backend unreachable
      return Promise.reject(new Error("Unable to connect to the emergency server. Please check your connection and try again."));
    }

    const { status, data } = error.response;

    if (status === 401) {
      // Expired or invalid token — clear session and redirect
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("role");
      // Only redirect if not already on login page
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login?reason=session_expired";
      }
      return Promise.reject(new Error("Your session has expired. Please log in again."));
    }

    if (status === 403) {
      return Promise.reject(new Error("You do not have permission to perform this action."));
    }

    if (status === 404) {
      return Promise.reject(new Error("The requested resource was not found."));
    }

    if (status === 422) {
      // FastAPI validation error — extract first message
      const detail = data?.detail;
      if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0];
        const field = first.loc?.slice(-1)[0] ?? "field";
        return Promise.reject(new Error(`Validation error: ${field} — ${first.msg}`));
      }
      return Promise.reject(new Error("Please check your input and try again."));
    }

    if (status >= 500) {
      return Promise.reject(new Error("An unexpected server error occurred. Please try again later."));
    }

    // Fallback: use backend detail message if available
    const msg = data?.detail ?? "An error occurred.";
    return Promise.reject(new Error(typeof msg === "string" ? msg : JSON.stringify(msg)));
  }
);
