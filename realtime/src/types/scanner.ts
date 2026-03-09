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
