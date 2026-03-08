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
  GitHubScanHistoryItem,
  AiReport,
  CodeFinding,
  AdkTraceSnapshot,
  CloudRunLogEntry,
  GcpSettings,
  GcpEstateSummary,
  GcpObservedService,
  GcpSecurityEvent,
  GcpSecurityIncident,
  GcpServiceHealth,
  GcpGeoThreatPoint,
  GcpHistoryStatus,
  GcpReplaySnapshot,
  GcpTimelineResponse,
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

let csrfBootstrapPromise: Promise<string> | null = null;

async function ensureCsrfToken(forceRefresh = false): Promise<string> {
  const existingToken = getCsrfToken();
  if (existingToken && !forceRefresh) {
    return existingToken;
  }

  if (!csrfBootstrapPromise || forceRefresh) {
    csrfBootstrapPromise = fetch(`${LOCAL_BASE}/auth/me/`, {
      credentials: "same-origin",
    })
      .catch(() => undefined)
      .then(() => getCsrfToken())
      .finally(() => {
        csrfBootstrapPromise = null;
      });
  }

  return csrfBootstrapPromise;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const isRemote = !url.startsWith("/");
  const method = init?.method?.toUpperCase() || "GET";
  const needsCsrf = !isRemote && ["POST", "PUT", "DELETE", "PATCH"].includes(method);

  const doFetch = async (forceCsrfRefresh = false) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
    };

    if (needsCsrf) {
      const csrfToken = await ensureCsrfToken(forceCsrfRefresh);
      if (csrfToken) {
        headers["X-CSRFToken"] = csrfToken;
      }
    }

    return fetch(url, {
      ...init,
      headers,
      credentials: isRemote ? "omit" : "same-origin",
    });
  };

  let res = await doFetch();
  if (!isRemote && needsCsrf && res.status === 403) {
    res = await doFetch(true);
  }

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

export const triggerScan = (repo: string, scanMode: "fast" | "full" = "fast") =>
  fetchJson<GitHubScan>(`${LOCAL_BASE}/github/scan/`, {
    method: "POST",
    body: JSON.stringify({ repo, scan_mode: scanMode }),
  });

export const getScanHistory = (repo: string) =>
  fetchJson<GitHubScanHistoryItem[]>(
    `${LOCAL_BASE}/github/scans/?repo=${encodeURIComponent(repo)}`
  );

export const getScanResults = (id: number) =>
  fetchJson<GitHubScan>(`${LOCAL_BASE}/github/scan/${id}/`);

export const getAiReport = (id: number) =>
  fetchJson<AiReport>(`${LOCAL_BASE}/github/scan/${id}/ai-report/`);

export const getCodeFindings = (id: number) =>
  fetchJson<CodeFinding[]>(`${LOCAL_BASE}/github/scan/${id}/code-findings/`);

export const getAdkTraceSnapshot = (id: number) =>
  fetchJson<AdkTraceSnapshot>(`${LOCAL_BASE}/github/scan/${id}/adk-trace/`);

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

// GCP Estate & Security (always local — backend aggregates from GCP)
export const getGcpEstateSummary = (minutes?: number) => {
  const qs = minutes ? `?minutes=${minutes}` : "";
  return fetchJson<GcpEstateSummary>(`${LOCAL_BASE}/gcp-estate/summary/${qs}`);
};

export const getGcpEstateServices = (params?: {
  cursor?: string;
  service?: string;
  region?: string;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.cursor) searchParams.set("cursor", params.cursor);
  if (params?.service) searchParams.set("service", params.service);
  if (params?.region) searchParams.set("region", params.region);
  const qs = searchParams.toString();
  return fetchJson<GcpObservedService[]>(
    `${LOCAL_BASE}/gcp-estate/services/${qs ? `?${qs}` : ""}`
  );
};

export const getGcpEstateTimeseries = (params?: {
  minutes?: number;
  service?: string;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.minutes) searchParams.set("minutes", String(params.minutes));
  if (params?.service) searchParams.set("service", params.service);
  const qs = searchParams.toString();
  return fetchJson<GcpServiceHealth[]>(
    `${LOCAL_BASE}/gcp-estate/timeseries/${qs ? `?${qs}` : ""}`
  );
};

export const getGcpSecurityEvents = (params?: {
  minutes?: number;
  severity?: string;
  category?: string;
  source?: string;
  service?: string;
  limit?: number;
  offset?: number;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.minutes) searchParams.set("minutes", String(params.minutes));
  if (params?.severity) searchParams.set("severity", params.severity);
  if (params?.category) searchParams.set("category", params.category);
  if (params?.source) searchParams.set("source", params.source);
  if (params?.service) searchParams.set("service", params.service);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  const qs = searchParams.toString();
  return fetchJson<{ count: number; results: GcpSecurityEvent[] }>(
    `${LOCAL_BASE}/gcp-security/events/${qs ? `?${qs}` : ""}`
  );
};

export const getGcpSecurityIncidents = (status?: string) => {
  const qs = status ? `?status=${status}` : "";
  return fetchJson<GcpSecurityIncident[]>(
    `${LOCAL_BASE}/gcp-security/incidents/${qs}`
  );
};

export const getGcpSecurityIncidentDetail = (id: number) =>
  fetchJson<GcpSecurityIncident>(
    `${LOCAL_BASE}/gcp-security/incidents/${id}/`
  );

export const ackGcpSecurityIncident = (id: number, status: string) =>
  fetchJson<GcpSecurityIncident>(
    `${LOCAL_BASE}/gcp-security/incidents/${id}/ack/`,
    { method: "POST", body: JSON.stringify({ status }) }
  );

export const getGcpSecurityMap = (minutes?: number) => {
  const qs = minutes ? `?minutes=${minutes}` : "";
  return fetchJson<GcpGeoThreatPoint[]>(
    `${LOCAL_BASE}/gcp-security/map/${qs}`
  );
};

export const getGcpEstateTimeline = (params: {
  start: string;
  end: string;
  bucket: string;
  service?: string;
  region?: string;
}) => {
  const searchParams = new URLSearchParams({
    start: params.start,
    end: params.end,
    bucket: params.bucket,
  });
  if (params.service) searchParams.set("service", params.service);
  if (params.region) searchParams.set("region", params.region);
  return fetchJson<GcpTimelineResponse>(
    `${LOCAL_BASE}/gcp-estate/timeline/?${searchParams.toString()}`
  );
};

export const getGcpEstateReplaySnapshot = (params: {
  cursor: string;
  window_minutes: number;
  start?: string;
  end?: string;
  service?: string;
  region?: string;
  source?: string;
  severity?: string;
}) => {
  const searchParams = new URLSearchParams({
    cursor: params.cursor,
    window_minutes: String(params.window_minutes),
  });
  if (params.start) searchParams.set("start", params.start);
  if (params.end) searchParams.set("end", params.end);
  if (params.service) searchParams.set("service", params.service);
  if (params.region) searchParams.set("region", params.region);
  if (params.source) searchParams.set("source", params.source);
  if (params.severity) searchParams.set("severity", params.severity);
  return fetchJson<GcpReplaySnapshot>(
    `${LOCAL_BASE}/gcp-estate/replay-snapshot/?${searchParams.toString()}`
  );
};

export const triggerGcpRefresh = () =>
  fetchJson<{ status: string }>(`${LOCAL_BASE}/gcp-estate/refresh/`, {
    method: "POST",
  });

export const ensureGcpCollection = () =>
  fetchJson<{ triggered: boolean }>(`${LOCAL_BASE}/gcp-estate/ensure-collection/`, {
    method: "POST",
  });

export const ensureGcpHistory = (days = 30) =>
  fetchJson<{ triggered: boolean; history_status: GcpHistoryStatus }>(
    `${LOCAL_BASE}/gcp-estate/ensure-history/`,
    {
      method: "POST",
      body: JSON.stringify({ days }),
    }
  );

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
