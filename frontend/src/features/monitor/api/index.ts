import { fetchJson, getLocalBaseUrl, getMonitorBaseUrl } from "../../../shared/api/client";
import type {
  Alert,
  CloudRunLogEntry,
  GeoData,
  GcpEstateSummary,
  GcpGeoThreatPoint,
  GcpHistoryStatus,
  GcpObservedService,
  GcpReplaySnapshot,
  GcpSecurityEvent,
  GcpSecurityIncident,
  GcpServiceHealth,
  GcpTimelineResponse,
  HttpRequest,
  StatsOverview,
  TimelinePoint,
} from "../types";

const LOCAL_BASE = getLocalBaseUrl();

function monitorUrl(path: string) {
  return `${getMonitorBaseUrl() ?? LOCAL_BASE}${path}`;
}

export const getRequests = (params?: string) =>
  fetchJson<{ results: HttpRequest[]; count: number }>(
    monitorUrl(`/requests/${params ? `?${params}` : ""}`)
  );

export const getRequestDetail = (id: number) =>
  fetchJson<HttpRequest>(monitorUrl(`/requests/${id}/`));

export const getStatsOverview = () => fetchJson<StatsOverview>(monitorUrl("/stats/overview/"));

export const getStatsTimeline = () => fetchJson<TimelinePoint[]>(monitorUrl("/stats/timeline/"));

export const getStatsGeo = () => fetchJson<GeoData[]>(monitorUrl("/stats/geo/"));

export const getAlerts = () =>
  fetchJson<{ results: Alert[]; count: number }>(monitorUrl("/alerts/"));

export const acknowledgeAlert = (id: number) =>
  fetchJson<{ status: string }>(monitorUrl(`/alerts/${id}/acknowledge/`), {
    method: "POST",
  });

export const getGcpEstateSummary = (minutes?: number) =>
  fetchJson<GcpEstateSummary>(
    `${LOCAL_BASE}/gcp-estate/summary/${minutes ? `?minutes=${minutes}` : ""}`
  );

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

export const getGcpEstateTimeseries = (params?: { minutes?: number; service?: string }) => {
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

export const getGcpSecurityIncidents = (status?: string) =>
  fetchJson<GcpSecurityIncident[]>(
    `${LOCAL_BASE}/gcp-security/incidents/${status ? `?status=${status}` : ""}`
  );

export const getGcpSecurityIncidentDetail = (id: number) =>
  fetchJson<GcpSecurityIncident>(`${LOCAL_BASE}/gcp-security/incidents/${id}/`);

export const ackGcpSecurityIncident = (id: number, status: string) =>
  fetchJson<GcpSecurityIncident>(`${LOCAL_BASE}/gcp-security/incidents/${id}/ack/`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });

export const getGcpSecurityMap = (minutes?: number) =>
  fetchJson<GcpGeoThreatPoint[]>(`${LOCAL_BASE}/gcp-security/map/${minutes ? `?minutes=${minutes}` : ""}`);

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
  fetchJson<{ status: string }>(`${LOCAL_BASE}/gcp-estate/refresh/`, { method: "POST" });

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
