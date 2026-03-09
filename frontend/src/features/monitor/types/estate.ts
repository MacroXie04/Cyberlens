import type { GcpGeoThreatPoint, GcpSecurityEvent, GcpSecurityIncident } from "./security";

export interface GcpEstateSummary {
  project_id: string;
  active_incidents: number;
  services_under_attack: number;
  armor_blocks_recent: number;
  auth_failures_recent: number;
  error_events_recent: number;
  total_events_recent: number;
  total_services: number;
  unhealthy_revisions: number;
  coverage_start: string | null;
  coverage_end: string | null;
  history_ready: boolean;
  backfill_status: GcpBackfillStatus | null;
  collection_errors?: Record<string, string>;
}

export type LiveMonitorMode = "history" | "live";

export interface GcpBackfillStatus {
  status?: "idle" | "running" | "complete" | "failed";
  days?: number;
  started_at?: string | null;
  updated_at?: string | null;
  error?: string | null;
  coverage_start?: string | null;
  coverage_end?: string | null;
}

export interface GcpHistoryStatus {
  coverage_start: string | null;
  coverage_end: string | null;
  history_ready: boolean;
  backfill_status: GcpBackfillStatus | null;
}

export interface GcpObservedService {
  id: number;
  project_id: string;
  service_name: string;
  region: string;
  latest_revision: string;
  instance_count: number;
  url: string;
  last_deployed_at: string | null;
  risk_score: number;
  risk_tags: string[];
  request_rate: number;
  error_rate: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  updated_at: string;
  sample_missing?: boolean;
}

export interface GcpServiceHealth {
  id: number;
  project_id: string;
  service_name: string;
  region: string;
  request_count: number;
  error_count: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  latency_p99_ms: number;
  instance_count: number;
  max_concurrency: number;
  cpu_utilization: number;
  memory_utilization: number;
  unhealthy_revision_count: number;
  bucket_start: string;
  bucket_end: string;
}

export interface GcpThreatTimeseriesPoint {
  timestamp: string;
  service: string;
  value: number;
}

export interface GcpTimelinePoint {
  ts: string;
  requests: number;
  errors: number;
  incident_count: number;
}

export interface GcpTimelineMarker {
  id: string;
  kind: "incident" | "event";
  ts: string;
  severity: string;
  title: string;
}

export interface GcpTimelineResponse extends GcpHistoryStatus {
  start: string;
  end: string;
  bucket: string;
  points: GcpTimelinePoint[];
  markers: GcpTimelineMarker[];
}

export interface GcpReplaySnapshot {
  cursor: string;
  window_start: string;
  window_end: string;
  summary: GcpEstateSummary;
  services: GcpObservedService[];
  map: GcpGeoThreatPoint[];
  perimeter: Record<string, number>;
  events: GcpSecurityEvent[];
  incidents: GcpSecurityIncident[];
  history_status: GcpHistoryStatus;
}
