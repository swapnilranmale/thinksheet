import axios from "axios";

/**
 * ThinkSheet API — own backend (port 5001)
 * Routes: /api/timesheets, /api/employee-manager-mappings
 */
export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

/**
 * Streamline API — think-book backend (port 5000)
 * Proxied via Vite: /api/invoicing/* → http://localhost:5000/api/invoicing/*
 * Used for: resources, projects
 */
export const streamlineApi = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

const attachToken = (config: any) => {
  const token = localStorage.getItem("streamline_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
};

api.interceptors.request.use(attachToken);
streamlineApi.interceptors.request.use(attachToken);

/** Extract a user-readable message from any caught error */
export function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err && typeof err === "object") {
    const e = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
    return e.response?.data?.error || e.response?.data?.message || e.message || fallback;
  }
  return fallback;
}
