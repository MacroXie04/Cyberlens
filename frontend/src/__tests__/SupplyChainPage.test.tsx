import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import SupplyChainPage from "../pages/SupplyChainPage";
import type { GitHubScan, SelectedProject } from "../types";

const triggerScan = vi.fn();
const getScanResults = vi.fn();
const getAiReport = vi.fn();
const getCodeFindings = vi.fn();
const getAdkTraceSnapshot = vi.fn();

vi.mock("../hooks/useSocket", () => ({
  useSocket: () => ({ connected: true, emit: vi.fn() }),
}));

vi.mock("../services/api", () => ({
  triggerScan: (...args: unknown[]) => triggerScan(...args),
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
  };
}

describe("SupplyChainPage scan start behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    getAdkTraceSnapshot.mockResolvedValue({ phases: [], events: [], artifacts: {} });
  });

  it("does not auto-start a scan when a repo is selected", () => {
    render(<SupplyChainPage selectedProject={makeSelectedProject()} />);

    expect(triggerScan).not.toHaveBeenCalled();
    expect(screen.getByText("Scan is idle")).toBeInTheDocument();
  });

  it("starts scanning only after the button is clicked", async () => {
    const user = userEvent.setup();
    triggerScan.mockResolvedValue(makeTriggeredScan());

    render(<SupplyChainPage selectedProject={makeSelectedProject()} />);

    await user.click(screen.getByRole("button", { name: "Scan" }));

    expect(triggerScan).toHaveBeenCalledTimes(1);
    expect(triggerScan).toHaveBeenCalledWith("MacroXie04/numberBomb");
  });
});
