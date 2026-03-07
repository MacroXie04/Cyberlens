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
  scan_status: "pending" | "scanning" | "completed" | "failed";
  total_deps: number;
  vulnerable_deps: number;
  security_score: number;
  scanned_at: string;
  dependencies?: Dependency[];
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
}
