import axios from "axios";

const authApi = axios.create({
  baseURL: "/api/auth",
  headers: { "Content-Type": "application/json" },
});

const TOKEN_KEY = "streamline_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

authApi.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface AuthUser {
  _id: string;
  email: string;
  full_name: string;
  role: "EMPLOYEE" | "MANAGER" | "ADMINISTRATOR";
  tenant_id: string;
  must_change_password: boolean;
  designation?: string;
}

interface AuthResponse {
  success: boolean;
  token: string;
  user: AuthUser;
}

export const authService = {
  getSetupStatus: () =>
    authApi.get<{ needs_setup: boolean }>("/setup-status"),

  signup: (email: string, password: string, full_name: string) =>
    authApi.post<AuthResponse>("/signup", { email, password, full_name }),

  login: (email: string, password: string) =>
    authApi.post<AuthResponse>("/login", { email, password }),

  me: () =>
    authApi.get<{ success: boolean; user: AuthUser }>("/me"),

  changePassword: (new_password: string, current_password?: string) =>
    authApi.post<{ success: boolean; token: string; message: string }>(
      "/change-password",
      { new_password, current_password }
    ),

  createManager: (email: string, password: string, full_name: string, designation?: string, team_ids?: string[]) =>
    authApi.post<{ success: boolean; user: any }>("/create-manager", {
      email, password, full_name, designation, team_ids,
    }),

  createAdmin: (email: string, password: string, full_name: string, designation?: string) =>
    authApi.post<{ success: boolean; user: any }>("/create-admin", {
      email, password, full_name, designation,
    }),

  getAdmins: (params?: { page?: number; limit?: number; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page)   qs.set("page",   String(params.page));
    if (params?.limit)  qs.set("limit",  String(params.limit));
    if (params?.search) qs.set("search", params.search);
    const q = qs.toString();
    return authApi.get<{ success: boolean; data: any[]; pagination?: { total: number; page: number; limit: number; pages: number } }>(`/admins${q ? `?${q}` : ""}`);
  },

  getManagers: (params?: { page?: number; limit?: number; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page)   qs.set("page",   String(params.page));
    if (params?.limit)  qs.set("limit",  String(params.limit));
    if (params?.search) qs.set("search", params.search);
    const q = qs.toString();
    return authApi.get<{ success: boolean; data: any[]; pagination?: { total: number; page: number; limit: number; pages: number } }>(`/managers${q ? `?${q}` : ""}`);
  },

  updateManager: (id: string, data: { team_ids?: string[]; designation?: string; full_name?: string }) =>
    authApi.put<{ success: boolean; user: any }>(`/managers/${id}`, data),

  resetPassword: (user_id: string) =>
    authApi.post<{ success: boolean; message: string }>("/reset-password", { user_id }),

  resetPasswordByEmail: (employee_email: string) =>
    authApi.post<{ success: boolean; message: string }>("/reset-password", { employee_email }),

  updateProfile: (full_name: string, designation?: string) =>
    authApi.put<AuthResponse>("/profile", { full_name, designation }),
};
