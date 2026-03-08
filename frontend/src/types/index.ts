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
  scan_source: "github";
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
}

export type SelectedProject =
  | { mode: "github"; repo: GitHubRepo }
  | null;
