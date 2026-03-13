export type ScanMode = "fast" | "full";

export interface GitHubScan {
  id: number;
  repo_name: string;
  repo_url: string;
  scan_source: "github" | "local";
  scan_mode: ScanMode;
  scan_status: "pending" | "scanning" | "completed" | "failed";
  total_deps: number;
  vulnerable_deps: number;
  security_score: number;
  dependency_score: number;
  code_security_score: number;
  scanned_at: string;
  started_at?: string;
  completed_at?: string | null;
  duration_ms?: number;
  code_findings_count?: number;
  code_scan_input_tokens: number;
  code_scan_output_tokens: number;
  code_scan_total_tokens: number;
  code_scan_files_scanned: number;
  code_scan_files_total: number;
  code_scan_phase?: string;
  code_scan_stats_json?: Record<string, unknown>;
  error_message?: string;
  dependencies?: Dependency[];
  code_findings?: CodeFinding[];
}

export interface GitHubScanHistoryItem {
  id: number;
  repo_name: string;
  repo_url: string;
  scan_source: "github" | "local";
  scan_mode: ScanMode;
  scan_status: "pending" | "scanning" | "completed" | "failed";
  total_deps: number;
  vulnerable_deps: number;
  security_score: number;
  dependency_score: number;
  code_security_score: number;
  code_findings_count: number;
  code_scan_phase?: string;
  scanned_at: string;
  started_at?: string;
  completed_at?: string | null;
  duration_ms?: number;
  error_message?: string;
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

export interface CodeMapNode {
  id: number;
  node_id: string;
  node_type: "endpoint" | "view" | "service" | "model" | "component" | "frontend_route" | "middleware" | "utility";
  label: string;
  file_path: string;
  line_number: number;
  http_methods: string[];
  metadata_json: Record<string, unknown>;
}

export interface CodeMapEdge {
  id: number;
  source_node_id: string;
  target_node_id: string;
  edge_type: "routes_to" | "calls" | "imports" | "renders";
  label: string;
}

export interface CodeMapData {
  nodes: CodeMapNode[];
  edges: CodeMapEdge[];
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
