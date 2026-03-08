export interface AuthUser {
  id: number;
  username: string;
  email: string;
}

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

export interface HttpRequest {
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

export interface StatsOverview {
  total_requests: number;
  ai_analyzed: number;
  threats_detected: number;
  malicious_count: number;
}

export interface TimelinePoint {
  hour: string;
  total: number;
  threats: number;
}

export interface GeoData {
  geo_country: string;
  geo_lat: number;
  geo_lng: number;
  count: number;
  threats: number;
}

export interface GitHubScan {
  id: number;
  repo_name: string;
  repo_url: string;
  scan_source: "github" | "local";
  scan_status: "pending" | "scanning" | "completed" | "failed";
  total_deps: number;
  vulnerable_deps: number;
  security_score: number;
  scanned_at: string;
  code_scan_input_tokens: number;
  code_scan_output_tokens: number;
  code_scan_total_tokens: number;
  code_scan_files_scanned: number;
  code_scan_files_total: number;
  code_scan_phase?: string;
  code_scan_stats_json?: Record<string, unknown>;
  dependencies?: Dependency[];
  code_findings?: CodeFinding[];
}

export interface Dependency {
  id: number;
  name: string;
  version: string;
  ecosystem: string;
  is_vulnerable: boolean;
  vulnerabilities?: Vulnerability[];
}

export interface Vulnerability {
  id: number;
  cve_id: string;
  cvss_score: number;
  severity: string;
  summary: string;
  fixed_version: string;
  osv_id: string;
}

export interface AiReport {
  id: number;
  executive_summary: string;
  priority_ranking: Array<{
    package: string;
    cve: string;
    severity: string;
    action: string;
  }>;
  remediation_json: {
    immediate?: string[];
    short_term?: string[];
    long_term?: string[];
  };
  generated_at: string;
}

export interface CodeFinding {
  id: number;
  file_path: string;
  line_number: number;
  severity: string;
  category: string;
  title: string;
  description: string;
  code_snippet: string;
  recommendation: string;
  explanation: string;
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string;
}

export interface GitHubRepo {
  full_name: string;
  name: string;
  private: boolean;
  language: string | null;
  updated_at: string;
  description: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  html_url: string;
}

export interface CodeScanStreamEvent {
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

export type AdkTracePhase =
  | "dependency_input"
  | "dependency_adk_report"
  | "code_inventory"
  | "chunk_summary"
  | "candidate_generation"
  | "evidence_expansion"
  | "verification"
  | "repo_synthesis";

export type AdkTraceKind =
  | "stage_started"
  | "stage_completed"
  | "llm_partial"
  | "llm_completed"
  | "artifact_created"
  | "metric"
  | "warning"
  | "error";

export interface AdkTraceEvent {
  id: number;
  scan_id: number;
  sequence: number;
  phase: AdkTracePhase;
  kind: AdkTraceKind;
  status: string;
  label: string;
  parent_key: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  duration_ms: number;
  text_preview: string;
  payload_json: Record<string, unknown> | unknown[];
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string | null;
}

export interface AdkTracePhaseSummary {
  phase: AdkTracePhase;
  status: "pending" | "running" | "success" | "warning" | "error";
  label: string;
  started_at?: string | null;
  ended_at?: string | null;
  duration_ms: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  event_count: number;
  artifact_count: number;
  error_count: number;
}

export interface AdkArtifactSummary {
  candidates: Array<{
    candidate_id: number;
    category: string;
    label: string;
    score: number;
    severity_hint: string;
    status: string;
    chunk_refs: string[];
    rationale: string;
    verified_finding_id: number | null;
  }>;
  evidence_packs: Array<Record<string, unknown>>;
  verified_findings: Array<{
    finding_id: number;
    title: string;
    category: string;
    severity: string;
    file_path: string;
    line_number: number;
    candidate_ids: number[];
  }>;
  dependency_report_batches: Array<Record<string, unknown>>;
}

export interface AdkTraceSnapshot {
  phases: AdkTracePhaseSummary[];
  events: AdkTraceEvent[];
  artifacts: AdkArtifactSummary;
}

// ---------------------------------------------------------------------------
// GCP Estate & Security Types
// ---------------------------------------------------------------------------

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
  events?: GcpSecurityEvent[];
}

export interface GcpIncidentNarrative {
  narrative: string;
  likely_cause: string;
  next_steps: string[];
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

export interface GcpGeoThreatPoint {
  country: string;
  geo_lat: number | null;
  geo_lng: number | null;
  count: number;
  critical: number;
  high: number;
}

export interface CloudRunLogEntry {
  timestamp: string | null;
  severity: string;
  message: string;
  log_name: string;
  trace: string;
  labels: Record<string, string>;
}

export interface GcpSettings {
  gcp_project_id: string;
  gcp_service_name: string;
  gcp_region: string;
  gcp_service_account_key_set: boolean;
  gcp_regions: string[];
  gcp_service_filters: string[];
  gcp_enabled_sources: string[];
}

export type SelectedProject =
  | { mode: "github"; repo: GitHubRepo }
  | null;
