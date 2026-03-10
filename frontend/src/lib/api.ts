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
 * Used ONLY for Resource Master:
 *   GET /invoicing/resources          → paginated list
 *   GET /invoicing/resources?limit=-1 → all resources
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
