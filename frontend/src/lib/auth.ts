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
}

interface AuthResponse {
  success: boolean;
  token: string;
  user: AuthUser;
}

export const authService = {
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

  createManager: (email: string, password: string, full_name: string, designation?: string) =>
    authApi.post<{ success: boolean; user: any }>("/create-manager", {
      email, password, full_name, designation,
    }),

  getManagers: () =>
    authApi.get<{ success: boolean; data: any[] }>("/managers"),
};
