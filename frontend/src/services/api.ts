import type {
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
  LocalProject,
} from "../types";

const LOCAL_BASE = "/api";
let monitorBase = "/api";

export function setMonitorBaseUrl(url: string | null) {
  monitorBase = url ? `${url.replace(/\/$/, "")}/api` : "/api";
}

export function getMonitorBaseUrl(): string | null {
  return monitorBase === "/api" ? null : monitorBase;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const isRemote = !url.startsWith("/");
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: isRemote ? "omit" : "same-origin",
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

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

// Local Scanner (always local)
export const getLocalProjects = (path?: string) =>
  fetchJson<LocalProject[]>(
    `${LOCAL_BASE}/github/local/projects/${path ? `?path=${encodeURIComponent(path)}` : ""}`
  );

export const triggerLocalScan = (path: string) =>
  fetchJson<GitHubScan>(`${LOCAL_BASE}/github/local/scan/`, {
    method: "POST",
    body: JSON.stringify({ path }),
  });

// Settings (always local)
export const getSettings = () =>
  fetchJson<{ google_api_key_set: boolean; google_api_key_preview: string }>(
    `${LOCAL_BASE}/settings/`
  );

export const updateSettings = (google_api_key: string) =>
  fetchJson<{ google_api_key_set: boolean; google_api_key_preview: string }>(
    `${LOCAL_BASE}/settings/`,
    { method: "PUT", body: JSON.stringify({ google_api_key }) }
  );

export const testApiKey = () =>
  fetchJson<{ success: boolean; models?: string[]; error?: string }>(
    `${LOCAL_BASE}/settings/test-key/`,
    { method: "POST" }
  );
