import type { GitHubScan } from "../types";

export type ScanProgressStep =
  | ""
  | "starting"
  | "fetching"
  | "parsing"
  | "scanning"
  | "analyzing"
  | "code_scan"
  | "completed"
  | "failed";

export interface DerivedScanProgress {
  step: ScanProgressStep;
  message: string;
  codeScanActive: boolean;
}

function formatFileProgress(scan: GitHubScan): string {
  const completed = scan.code_scan_files_scanned ?? 0;
  const total = scan.code_scan_files_total ?? 0;
  return total > 0 ? ` (${completed}/${total} files)` : "";
}

export function deriveScanProgress(scan: GitHubScan | null): DerivedScanProgress {
  if (!scan) {
    return { step: "", message: "", codeScanActive: false };
  }

  if (scan.scan_status === "failed") {
    return {
      step: "failed",
      message: scan.error_message || "Scan failed",
      codeScanActive: Boolean(scan.code_scan_phase),
    };
  }

  if (scan.scan_status === "completed") {
    return {
      step: "completed",
      message: "Scan complete",
      codeScanActive: Boolean(scan.code_scan_phase || scan.code_scan_files_total),
    };
  }

  const progressSuffix = formatFileProgress(scan);
  switch (scan.code_scan_phase) {
    case "dependency_input":
      return {
        step: "analyzing",
        message: "Preparing dependency context for AI analysis...",
        codeScanActive: false,
      };
    case "dependency_adk_report":
      return {
        step: "analyzing",
        message: "Generating AI risk assessment...",
        codeScanActive: false,
      };
    case "code_inventory":
      return {
        step: "code_scan",
        message: `Indexing source files${progressSuffix}...`,
        codeScanActive: true,
      };
    case "chunk_summary":
      return {
        step: "code_scan",
        message: `Summarizing code chunks${progressSuffix}...`,
        codeScanActive: true,
      };
    case "candidate_generation":
      return {
        step: "code_scan",
        message: `Generating security candidates${progressSuffix}...`,
        codeScanActive: true,
      };
    case "evidence_expansion":
      return {
        step: "code_scan",
        message: `Gathering evidence for findings${progressSuffix}...`,
        codeScanActive: true,
      };
    case "verification":
      return {
        step: "code_scan",
        message: `Verifying findings${progressSuffix}...`,
        codeScanActive: true,
      };
    case "repo_synthesis":
      return {
        step: "code_scan",
        message: `Synthesizing repository risk summary${progressSuffix}...`,
        codeScanActive: true,
      };
    default:
      break;
  }

  if (scan.total_deps > 0 || scan.vulnerable_deps > 0) {
    return {
      step: "scanning",
      message: `Analyzing ${scan.total_deps} dependencies...`,
      codeScanActive: false,
    };
  }

  return {
    step: "fetching",
    message: "Fetching repository files...",
    codeScanActive: false,
  };
}
