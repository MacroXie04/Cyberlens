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

export interface DerivedAgentActivity {
  status: "idle" | "pending" | "running" | "success" | "warning" | "error";
  phase: AdkTracePhase | null;
  phase_label: string;
  title: string;
  subject: string;
  progress_text: string;
  updated_at: string | null;
  warning_message?: string;
  error_message?: string;
  recent_events: AdkTraceEvent[];
}
