import type {
  AuthUser,
  HttpRequest,
  Alert,
  StatsOverview,
  TimelinePoint,
  GeoData,
  GitHubUser,
  GitHubRepo,
  GitHubScan,
  AiReport,
  CodeFinding,
  CloudRunLogEntry,
  GcpSettings,
} from "../types";

const LOCAL_BASE = "/api";
let monitorBase = "/api";

export function setMonitorBaseUrl(url: string | null) {
  monitorBase = url ? `${url.replace(/\/$/, "")}/api` : "/api";
}

export function getMonitorBaseUrl(): string | null {
  return monitorBase === "/api" ? null : monitorBase;
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const isRemote = !url.startsWith("/");
  const method = init?.method?.toUpperCase() || "GET";
  const needsCsrf = !isRemote && ["POST", "PUT", "DELETE", "PATCH"].includes(method);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (needsCsrf) {
    headers["X-CSRFToken"] = getCsrfToken();
  }

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: isRemote ? "omit" : "same-origin",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Auth
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

// Module A: Monitor (uses monitorBase — may point to remote Cloud Run)
export const getRequests = (params?: string) =>
  fetchJson<{ results: HttpRequest[]; count: number }>(
    `${monitorBase}/requests/${params ? `?${params}` : ""}`
  );

export const getRequestDetail = (id: number) =>
  fetchJson<HttpRequest>(`${monitorBase}/requests/${id}/`);

export const getStatsOverview = () =>
  fetchJson<StatsOverview>(`${monitorBase}/stats/overview/`);

export const getStatsTimeline = () =>
  fetchJson<TimelinePoint[]>(`${monitorBase}/stats/timeline/`);

export const getStatsGeo = () =>
  fetchJson<GeoData[]>(`${monitorBase}/stats/geo/`);

export const getAlerts = () =>
  fetchJson<{ results: Alert[]; count: number }>(`${monitorBase}/alerts/`);

export const acknowledgeAlert = (id: number) =>
  fetchJson<{ status: string }>(`${monitorBase}/alerts/${id}/acknowledge/`, {
    method: "POST",
  });

// Module B: GitHub Scanner (always local)
export const getGitHubStatus = () =>
  fetchJson<{ connected: boolean; user?: GitHubUser }>(
    `${LOCAL_BASE}/github/status/`
  );

export const connectGitHub = (token: string) =>
  fetchJson<GitHubUser>(`${LOCAL_BASE}/github/connect/`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });

export const disconnectGitHub = () =>
  fetchJson<{ status: string }>(`${LOCAL_BASE}/github/disconnect/`, {
    method: "DELETE",
  });

export const getRepos = () =>
  fetchJson<GitHubRepo[]>(`${LOCAL_BASE}/github/repos/`);

export const triggerScan = (repo: string) =>
  fetchJson<GitHubScan>(`${LOCAL_BASE}/github/scan/`, {
    method: "POST",
    body: JSON.stringify({ repo }),
  });

export const getScanResults = (id: number) =>
  fetchJson<GitHubScan>(`${LOCAL_BASE}/github/scan/${id}/`);

export const getAiReport = (id: number) =>
  fetchJson<AiReport>(`${LOCAL_BASE}/github/scan/${id}/ai-report/`);

export const getCodeFindings = (id: number) =>
  fetchJson<CodeFinding[]>(`${LOCAL_BASE}/github/scan/${id}/code-findings/`);

// Settings (always local)
export const getSettings = () =>
  fetchJson<{ google_api_key_set: boolean; google_api_key_preview: string; gemini_model: string }>(
    `${LOCAL_BASE}/settings/`
  );

export const updateSettings = (data: { google_api_key?: string; gemini_model?: string }) =>
  fetchJson<{ google_api_key_set: boolean; google_api_key_preview: string; gemini_model: string }>(
    `${LOCAL_BASE}/settings/`,
    { method: "PUT", body: JSON.stringify(data) }
  );

export const getAvailableModels = () =>
  fetchJson<{ models: string[] }>(`${LOCAL_BASE}/settings/models/`);

export const testApiKey = () =>
  fetchJson<{ success: boolean; models?: string[]; error?: string }>(
    `${LOCAL_BASE}/settings/test-key/`,
    { method: "POST" }
  );

// GCP Cloud Logging settings (always local)
export const getGcpSettings = () =>
  fetchJson<GcpSettings>(`${LOCAL_BASE}/settings/gcp/`);

export const updateGcpSettings = (data: {
  gcp_project_id?: string;
  gcp_service_name?: string;
  gcp_region?: string;
  gcp_service_account_key?: string;
}) =>
  fetchJson<GcpSettings>(`${LOCAL_BASE}/settings/gcp/`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

// Cloud Run Logs (always local — backend fetches from GCP)
export const getCloudRunLogs = (params?: {
  limit?: number;
  hours?: number;
  severity?: string;
  q?: string;
  page_token?: string;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.hours) searchParams.set("hours", String(params.hours));
  if (params?.severity) searchParams.set("severity", params.severity);
  if (params?.q) searchParams.set("q", params.q);
  if (params?.page_token) searchParams.set("page_token", params.page_token);
  const qs = searchParams.toString();
  return fetchJson<{ entries: CloudRunLogEntry[]; next_page_token?: string }>(
    `${LOCAL_BASE}/cloud-run-logs/${qs ? `?${qs}` : ""}`
  );
};
