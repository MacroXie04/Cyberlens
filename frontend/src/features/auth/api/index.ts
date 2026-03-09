import type { AuthUser } from "../types";
import { fetchJson, getLocalBaseUrl } from "../../../shared/api/client";

const LOCAL_BASE = getLocalBaseUrl();

export const register = (username: string, email: string, password: string) =>
  fetchJson<{ user: AuthUser }>(`${LOCAL_BASE}/auth/register/`, {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });

export const login = (username: string, password: string) =>
  fetchJson<{ user: AuthUser }>(`${LOCAL_BASE}/auth/login/`, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

export const logout = () =>
  fetchJson<{ status: string }>(`${LOCAL_BASE}/auth/logout/`, {
    method: "POST",
  });

export const getMe = () =>
  fetchJson<{ authenticated: boolean; user?: AuthUser }>(`${LOCAL_BASE}/auth/me/`);
