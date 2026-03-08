import { describe, expect, it } from "vitest";

import type { GitHubScan } from "../types";
import { deriveScanProgress } from "../pages/supplyChainScanProgress";

function makeScan(overrides: Partial<GitHubScan> = {}): GitHubScan {
  return {
    id: 1,
    repo_name: "org/repo",
    repo_url: "https://github.com/org/repo",
    scan_source: "github",
    scan_status: "scanning",
    total_deps: 0,
    vulnerable_deps: 0,
    security_score: 100,
    dependency_score: 100,
    code_security_score: 100,
    scanned_at: "2026-03-07T00:00:00Z",
    code_scan_input_tokens: 0,
    code_scan_output_tokens: 0,
    code_scan_total_tokens: 0,
    code_scan_files_scanned: 0,
    code_scan_files_total: 0,
    code_scan_phase: "",
    code_scan_stats_json: {},
    error_message: "",
    dependencies: [],
    code_findings: [],
    ...overrides,
  };
}

describe("deriveScanProgress", () => {
  it("falls back to fetching state before detailed progress is available", () => {
    expect(deriveScanProgress(makeScan())).toEqual({
      step: "fetching",
      message: "Fetching repository files...",
      codeScanActive: false,
    });
  });

  it("maps dependency inventory to scanning progress", () => {
    expect(deriveScanProgress(makeScan({ total_deps: 27 }))).toEqual({
      step: "scanning",
      message: "Analyzing 27 dependencies...",
      codeScanActive: false,
    });
  });

  it("maps code scan phases to code security progress", () => {
    expect(
      deriveScanProgress(
        makeScan({
          code_scan_phase: "verification",
          code_scan_files_scanned: 3,
          code_scan_files_total: 12,
        })
      )
    ).toEqual({
      step: "code_scan",
      message: "Verifying findings (3/12 files)...",
      codeScanActive: true,
    });
  });

  it("surfaces failure messages", () => {
    expect(
      deriveScanProgress(
        makeScan({
          scan_status: "failed",
          error_message: "Gemini request timed out",
        })
      )
    ).toEqual({
      step: "failed",
      message: "Gemini request timed out",
      codeScanActive: false,
    });
  });
});
