import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import SupplyChainPage from "../pages/SupplyChainPage";
import type { GitHubScan, GitHubScanHistoryItem, SelectedProject } from "../types";

const triggerScan = vi.fn();
const getScanHistory = vi.fn();
const getScanResults = vi.fn();
const getAiReport = vi.fn();
const getCodeFindings = vi.fn();
const getAdkTraceSnapshot = vi.fn();

vi.mock("../hooks/useSocket", () => ({
  useSocket: () => ({ connected: true, emit: vi.fn() }),
}));

vi.mock("../services/api", () => ({
  triggerScan: (...args: unknown[]) => triggerScan(...args),
  getScanHistory: (...args: unknown[]) => getScanHistory(...args),
  getScanResults: (...args: unknown[]) => getScanResults(...args),
  getAiReport: (...args: unknown[]) => getAiReport(...args),
  getCodeFindings: (...args: unknown[]) => getCodeFindings(...args),
  getAdkTraceSnapshot: (...args: unknown[]) => getAdkTraceSnapshot(...args),
}));

vi.mock("../components/SupplyChain/AdkPipelineView", () => ({
  default: () => <div>ADK Pipeline Stub</div>,
}));
vi.mock("../components/SupplyChain/AgentActivityPanel", () => ({
  default: () => <div>Agent Activity Stub</div>,
}));
vi.mock("../components/SupplyChain/AgentRequestLog", () => ({
  default: () => <div>Agent Request Log Stub</div>,
}));
vi.mock("../components/SupplyChain/AiRemediationReport", () => ({
  default: () => <div>AI Report Stub</div>,
}));
vi.mock("../components/SupplyChain/CodeScanLiveView", () => ({
  default: () => <div>Code Scan Live Stub</div>,
}));
vi.mock("../components/SupplyChain/CodeSecurityFindings", () => ({
  default: () => <div>Findings Stub</div>,
}));
vi.mock("../components/SupplyChain/DependencyInventory", () => ({
  default: () => <div>Dependency Inventory Stub</div>,
}));
vi.mock("../components/SupplyChain/DependencyTree", () => ({
  default: () => <div>Dependency Tree Stub</div>,
}));
vi.mock("../components/SupplyChain/ScanProgress", () => ({
  default: () => <div>Scan Progress Stub</div>,
}));
vi.mock("../components/SupplyChain/VulnerabilityList", () => ({
  default: () => <div>Vulnerability List Stub</div>,
}));

function makeSelectedProject(): SelectedProject {
  return {
    mode: "github",
    repo: {
      full_name: "MacroXie04/numberBomb",
      name: "numberBomb",
      private: true,
      language: "TypeScript",
      updated_at: "2026-03-07T00:00:00Z",
      description: "repo",
      stargazers_count: 0,
      forks_count: 0,
      open_issues_count: 0,
      default_branch: "main",
      html_url: "https://github.com/MacroXie04/numberBomb",
    },
  };
}

function makeTriggeredScan(): GitHubScan {
  return {
    id: 42,
    repo_name: "MacroXie04/numberBomb",
    repo_url: "https://github.com/MacroXie04/numberBomb",
    scan_source: "github",
    scan_mode: "fast",
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
    started_at: "2026-03-07T00:00:00Z",
    completed_at: null,
    duration_ms: 0,
    code_findings_count: 0,
    dependencies: [],
    code_findings: [],
  };
}

function makeHistoryItem(status: GitHubScanHistoryItem["scan_status"] = "completed"): GitHubScanHistoryItem {
  return {
    id: 9,
    repo_name: "MacroXie04/numberBomb",
    repo_url: "https://github.com/MacroXie04/numberBomb",
    scan_source: "github",
    scan_mode: "fast",
    scan_status: status,
    total_deps: 12,
    vulnerable_deps: 2,
    security_score: 81,
    dependency_score: 76,
    code_security_score: 89,
    code_findings_count: 1,
    code_scan_phase: "",
    scanned_at: "2026-03-07T00:00:00Z",
    started_at: "2026-03-07T00:00:00Z",
    completed_at: status === "completed" ? "2026-03-07T00:02:00Z" : null,
    duration_ms: status === "completed" ? 120000 : 0,
    error_message: "",
  };
}

describe("SupplyChainPage scan start behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getScanHistory.mockResolvedValue([]);
    getAdkTraceSnapshot.mockResolvedValue({ phases: [], events: [], artifacts: {} });
  });

  it("does not auto-start a scan when a repo is selected", async () => {
    render(<SupplyChainPage selectedProject={makeSelectedProject()} />);

    expect(await screen.findByText("Scan is idle")).toBeInTheDocument();
    expect(triggerScan).not.toHaveBeenCalled();
  });

  it("loads stored history automatically without starting a new scan", async () => {
    getScanHistory.mockResolvedValue([makeHistoryItem()]);
    getScanResults.mockResolvedValue({
      ...makeTriggeredScan(),
      id: 9,
      scan_status: "completed",
      total_deps: 12,
      vulnerable_deps: 2,
      security_score: 81,
      dependency_score: 76,
      code_security_score: 89,
    });

    render(<SupplyChainPage selectedProject={makeSelectedProject()} />);

    expect(await screen.findAllByText("Stored result")).toHaveLength(1);
    expect(triggerScan).not.toHaveBeenCalled();
  });

  it("starts scanning only after the Fast Scan button is clicked", async () => {
    const user = userEvent.setup();
    triggerScan.mockResolvedValue(makeTriggeredScan());

    render(<SupplyChainPage selectedProject={makeSelectedProject()} />);

    await user.click(screen.getByRole("button", { name: "Fast Scan" }));

    expect(triggerScan).toHaveBeenCalledTimes(1);
    expect(triggerScan).toHaveBeenCalledWith("MacroXie04/numberBomb", "fast");
  });
});
