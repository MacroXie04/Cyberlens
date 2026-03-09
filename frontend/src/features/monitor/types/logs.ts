export interface CloudRunLogEntry {
  timestamp: string | null;
  severity: string;
  message: string;
  log_name: string;
  trace: string;
  labels: Record<string, string>;
}
