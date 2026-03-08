export type ThreatLevel = "safe" | "suspicious" | "malicious";

export type ThreatType =
  | "none"
  | "sql_injection"
  | "xss"
  | "path_traversal"
  | "brute_force"
  | "bot_scraping"
  | "ddos"
  | "unknown";

export interface AnalysisResult {
  id: number;
  threat_level: ThreatLevel;
  threat_type: ThreatType;
  confidence: number;
  reason: string;
  recommendation: string;
  analyzed_at: string;
}

export interface RequestData {
  id: number;
  timestamp: string;
  ip: string;
  method: string;
  path: string;
  status: number;
  user_agent: string;
  geo_country: string;
  geo_lat: number | null;
  geo_lng: number | null;
  analysis: AnalysisResult | null;
}

export interface Alert {
  id: number;
  request: number;
  severity: "info" | "warning" | "critical";
  message: string;
  acknowledged: boolean;
  created_at: string;
}

export interface StatsUpdate {
  total_requests: number;
  ai_analyzed: number;
  threats_detected: number;
  malicious_count: number;
}

export interface ScanProgress {
  scan_id: number;
  step: string;
  message: string;
}

export interface ScanComplete {
  scan_id: number;
  status: string;
  message: string;
}

export interface CodeScanStream {
  scan_id: number;
  type:
    | "scan_start"
    | "file_start"
    | "chunk"
    | "file_complete"
    | "file_error"
    | "token_update"
    | "scan_summary"
    | "warning";
  total_files?: number;
  file_path?: string;
  file_index?: number;
  text?: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  files_scanned?: number;
  findings_count?: number;
  total_findings?: number;
  error?: string;
  message?: string;
}

// GCP Estate & Security types

export interface GcpEstateSnapshot {
  project_id: string;
  active_incidents: number;
  services_under_attack: number;
  total_services: number;
  services: GcpObservedService[];
}

export interface GcpObservedService {
  service_name: string;
  region: string;
  latest_revision: string;
  instance_count: number;
  url: string;
  risk_score: number;
  risk_tags: string[];
  request_rate: number;
  error_rate: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
}

export type GcpEventSource =
  | "cloud_run_logs"
  | "cloud_monitoring"
  | "load_balancer"
  | "cloud_armor"
  | "iam_audit"
  | "iap";

export type GcpEventSeverity = "info" | "low" | "medium" | "high" | "critical";

export type GcpEventCategory =
  | "sql_injection"
  | "xss"
  | "path_traversal"
  | "bot_probing"
  | "credential_abuse"
  | "armor_block"
  | "iap_auth_failure"
  | "iam_drift"
  | "error_surge"
  | "latency_surge"
  | "revision_regression"
  | "cold_start_surge"
  | "rate_limit"
  | "other";

export interface GcpSecurityEvent {
  id: number;
  source: GcpEventSource;
  timestamp: string;
  project_id: string;
  region: string;
  service: string;
  revision: string;
  severity: GcpEventSeverity;
  category: GcpEventCategory;
  source_ip: string | null;
  principal: string;
  path: string;
  method: string;
  status_code: number | null;
  trace_id: string;
  request_id: string;
  country: string;
  geo_lat: number | null;
  geo_lng: number | null;
  evidence_refs: unknown[];
  raw_payload_preview: string;
  fact_fields: Record<string, unknown>;
  inference_fields: Record<string, unknown>;
  incident_id: number | null;
}

export type GcpIncidentPriority = "p1" | "p2" | "p3" | "p4";

export type GcpIncidentStatus =
  | "open"
  | "investigating"
  | "mitigated"
  | "resolved"
  | "false_positive";

export interface GcpSecurityIncident {
  id: number;
  project_id: string;
  incident_type: string;
  priority: GcpIncidentPriority;
  status: GcpIncidentStatus;
  confidence: number;
  evidence_count: number;
  services_affected: string[];
  regions_affected: string[];
  title: string;
  narrative: string;
  likely_cause: string;
  next_steps: string[];
  ai_inference: Record<string, unknown>;
  first_seen: string;
  last_seen: string;
  acknowledged_by: string;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
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
  bucket_start: string;
  bucket_end: string;
}

export interface AdkTraceStreamEvent {
  id: number;
  scan_id: number;
  sequence: number;
  phase:
    | "dependency_input"
    | "dependency_adk_report"
    | "code_inventory"
    | "chunk_summary"
    | "candidate_generation"
    | "evidence_expansion"
    | "verification"
    | "repo_synthesis";
  kind:
    | "stage_started"
    | "stage_completed"
    | "llm_partial"
    | "llm_completed"
    | "artifact_created"
    | "metric"
    | "warning"
    | "error";
  status: string;
  label: string;
  parent_key: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  duration_ms: number;
  text_preview: string;
  payload_json: Record<string, unknown> | Array<unknown>;
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string | null;
}
