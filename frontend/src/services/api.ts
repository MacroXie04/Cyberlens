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
} from "../types";

const BASE = "/api";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Module A: Monitor
export const getRequests = (params?: string) =>
  fetchJson<{ results: HttpRequest[]; count: number }>(
    `${BASE}/requests/${params ? `?${params}` : ""}`
  );

export const getRequestDetail = (id: number) =>
  fetchJson<HttpRequest>(`${BASE}/requests/${id}/`);

export const getStatsOverview = () =>
  fetchJson<StatsOverview>(`${BASE}/stats/overview/`);

export const getStatsTimeline = () =>
  fetchJson<TimelinePoint[]>(`${BASE}/stats/timeline/`);

export const getStatsGeo = () =>
  fetchJson<GeoData[]>(`${BASE}/stats/geo/`);

export const getAlerts = () =>
  fetchJson<{ results: Alert[]; count: number }>(`${BASE}/alerts/`);

export const acknowledgeAlert = (id: number) =>
  fetchJson<{ status: string }>(`${BASE}/alerts/${id}/acknowledge/`, {
    method: "POST",
  });

// Module B: GitHub Scanner
export const connectGitHub = (token: string) =>
  fetchJson<GitHubUser>(`${BASE}/github/connect/`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });

export const disconnectGitHub = () =>
  fetchJson<{ status: string }>(`${BASE}/github/disconnect/`, {
    method: "DELETE",
  });

export const getRepos = () =>
  fetchJson<GitHubRepo[]>(`${BASE}/github/repos/`);

export const triggerScan = (repo: string) =>
  fetchJson<GitHubScan>(`${BASE}/github/scan/`, {
    method: "POST",
    body: JSON.stringify({ repo }),
  });

export const getScanResults = (id: number) =>
  fetchJson<GitHubScan>(`${BASE}/github/scan/${id}/`);

export const getAiReport = (id: number) =>
  fetchJson<AiReport>(`${BASE}/github/scan/${id}/ai-report/`);
