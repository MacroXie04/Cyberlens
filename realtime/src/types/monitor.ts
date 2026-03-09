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
