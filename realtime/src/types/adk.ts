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
