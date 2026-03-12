import { describe, expect, it } from "vitest";

import { deriveAgentActivity } from "../../components/SupplyChain/activity/activity";
import type { AdkTraceSnapshot, GitHubScan } from "../../types";

function makeScan(): GitHubScan {
  return {
    id: 1,
    repo_name: "owner/repo",
    repo_url: "https://github.com/owner/repo",
    scan_source: "github",
    scan_mode: "fast",
    scan_status: "scanning",
    total_deps: 0,
    vulnerable_deps: 0,
    security_score: 100,
    dependency_score: 100,
    code_security_score: 100,
    scanned_at: "2026-03-07T00:00:00Z",
    started_at: "2026-03-07T00:00:00Z",
    completed_at: null,
    duration_ms: 0,
    code_findings_count: 0,
    code_scan_input_tokens: 0,
    code_scan_output_tokens: 0,
    code_scan_total_tokens: 0,
    code_scan_files_scanned: 0,
    code_scan_files_total: 0,
    code_scan_phase: "chunk_summary",
    code_scan_stats_json: {},
    error_message: "",
    dependencies: [],
    code_findings: [],
  };
}

function makeSnapshot(payload: Record<string, unknown>, phase: "chunk_summary" | "candidate_generation" | "verification"): AdkTraceSnapshot {
  return {
    phases: [
      {
        phase,
        status: "running",
        label: phase,
        started_at: "2026-03-07T00:00:00Z",
        ended_at: null,
        duration_ms: 0,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        event_count: 2,
        artifact_count: 0,
        error_count: 0,
      },
    ],
    events: [
      {
        id: 1,
        scan_id: 1,
        sequence: 1,
        phase,
        kind: "stage_started",
        status: "running",
        label: "Started",
        parent_key: "",
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        duration_ms: 0,
        text_preview: "",
        payload_json: {},
        created_at: "2026-03-07T00:00:00Z",
      },
      {
        id: 2,
        scan_id: 1,
        sequence: 2,
        phase,
        kind: "metric",
        status: "running",
        label: "Metric",
        parent_key: "",
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        duration_ms: 0,
        text_preview: "",
        payload_json: payload,
        created_at: "2026-03-07T00:00:10Z",
      },
    ],
    artifacts: {
      candidates: [],
      evidence_packs: [],
      verified_findings: [],
      dependency_report_batches: [],
    },
  };
}

describe("deriveAgentActivity", () => {
  it("renders chunk summary progress with the current file", () => {
    const activity = deriveAgentActivity(
      makeSnapshot(
        {
          current_file: "src/auth/login.ts",
          completed_chunks: 3,
          total_chunks: 8,
        },
        "chunk_summary"
      ),
      makeScan()
    );

    expect(activity.title).toBe("Summarizing src/auth/login.ts");
    expect(activity.progress_text).toContain("3/8");
  });

  it("renders candidate generation progress with risk category and batch", () => {
    const activity = deriveAgentActivity(
      makeSnapshot(
        {
          risk_category: "injection",
          batch_index: 2,
          batches_in_category: 6,
          selected_candidates: 5,
        },
        "candidate_generation"
      ),
      { ...makeScan(), code_scan_phase: "candidate_generation" }
    );

    expect(activity.title).toBe("Generating injection candidates");
    expect(activity.subject).toBe("Batch 2/6");
  });

  it("renders verification progress with candidate counts", () => {
    const activity = deriveAgentActivity(
      makeSnapshot(
        {
          candidate_id: 14,
          reviewed_candidates: 5,
          total_candidates: 12,
        },
        "verification"
      ),
      { ...makeScan(), code_scan_phase: "verification" }
    );

    expect(activity.title).toBe("Verifying candidate #14");
    expect(activity.progress_text).toContain("5/12");
  });
});
