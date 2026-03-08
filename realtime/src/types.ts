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
