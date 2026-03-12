import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SupplyChainPage from "../../pages/SupplyChainPage";
import { getAdkTraceSnapshot, getAiReport, getCodeFindings, getScanHistory, getScanResults, triggerScan } from "../../features/supply-chain/api";
import type { GitHubScan, GitHubScanHistoryItem, SelectedProject } from "../../types";

vi.mock("../../hooks/useSocket", () => ({ useSocket: () => ({ connected: true, emit: vi.fn() }) }));
vi.mock("../../features/supply-chain/api", () => ({ triggerScan: vi.fn(), getScanHistory: vi.fn(), getScanResults: vi.fn(), getAiReport: vi.fn(), getCodeFindings: vi.fn(), getAdkTraceSnapshot: vi.fn() }));
vi.mock("../../components/SupplyChain/AdkPipelineView", () => ({ default: () => <div>ADK Pipeline Stub</div> }));
vi.mock("../../components/SupplyChain/agent-panel/AgentActivityPanel", () => ({ default: () => <div>Agent Activity Stub</div> }));
vi.mock("../../components/SupplyChain/agent-log/AgentRequestLog", () => ({ default: () => <div>Agent Request Log Stub</div> }));
vi.mock("../../components/SupplyChain/remediation/AiRemediationReport", () => ({ default: () => <div>AI Report Stub</div> }));
vi.mock("../../components/SupplyChain/code-scan/CodeScanLiveView", () => ({ default: () => <div>Code Scan Live Stub</div> }));
vi.mock("../../components/SupplyChain/code-findings/CodeSecurityFindings", () => ({ default: () => <div>Findings Stub</div> }));
vi.mock("../../components/SupplyChain/inventory/DependencyInventory", () => ({ default: () => <div>Dependency Inventory Stub</div> }));
vi.mock("../../components/SupplyChain/dependencies/DependencyList", () => ({ default: () => <div>Dependency List Stub</div> }));
vi.mock("../../components/SupplyChain/dependencies/DependencyTree", () => ({ default: () => <div>Dependency Tree Stub</div> }));
vi.mock("../../components/SupplyChain/ScanProgress", () => ({ default: () => <div>Scan Progress Stub</div> }));
vi.mock("../../components/SupplyChain/vulnerabilities/VulnerabilityList", () => ({ default: () => <div>Vulnerability List Stub</div> }));

const mockTriggerScan = vi.mocked(triggerScan);
const mockGetScanHistory = vi.mocked(getScanHistory);
const mockGetScanResults = vi.mocked(getScanResults);
const mockGetAiReport = vi.mocked(getAiReport);
const mockGetCodeFindings = vi.mocked(getCodeFindings);
const mockGetAdkTraceSnapshot = vi.mocked(getAdkTraceSnapshot);

function makeSelectedProject(): SelectedProject {
  return { mode: "github", repo: { full_name: "MacroXie04/numberBomb", name: "numberBomb", private: true, language: "TypeScript", updated_at: "2026-03-07T00:00:00Z", description: "repo", stargazers_count: 0, forks_count: 0, open_issues_count: 0, default_branch: "main", html_url: "https://github.com/MacroXie04/numberBomb" } };
}

function makeTriggeredScan(): GitHubScan {
  return { id: 42, repo_name: "MacroXie04/numberBomb", repo_url: "https://github.com/MacroXie04/numberBomb", scan_source: "github", scan_mode: "fast", scan_status: "scanning", total_deps: 0, vulnerable_deps: 0, security_score: 100, dependency_score: 100, code_security_score: 100, scanned_at: "2026-03-07T00:00:00Z", code_scan_input_tokens: 0, code_scan_output_tokens: 0, code_scan_total_tokens: 0, code_scan_files_scanned: 0, code_scan_files_total: 0, code_scan_phase: "", code_scan_stats_json: {}, error_message: "", started_at: "2026-03-07T00:00:00Z", completed_at: null, duration_ms: 0, code_findings_count: 0, dependencies: [], code_findings: [] };
}

function makeHistoryItem(status: GitHubScanHistoryItem["scan_status"] = "completed"): GitHubScanHistoryItem {
  return { id: 9, repo_name: "MacroXie04/numberBomb", repo_url: "https://github.com/MacroXie04/numberBomb", scan_source: "github", scan_mode: "fast", scan_status: status, total_deps: 12, vulnerable_deps: 2, security_score: 81, dependency_score: 76, code_security_score: 89, code_findings_count: 1, code_scan_phase: "", scanned_at: "2026-03-07T00:00:00Z", started_at: "2026-03-07T00:00:00Z", completed_at: status === "completed" ? "2026-03-07T00:02:00Z" : null, duration_ms: status === "completed" ? 120000 : 0, error_message: "" };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetScanHistory.mockResolvedValue([]);
  mockGetAiReport.mockResolvedValue(null as never);
  mockGetCodeFindings.mockResolvedValue([]);
  mockGetAdkTraceSnapshot.mockResolvedValue({ phases: [], events: [], artifacts: {} as never });
});

describe("SupplyChainPage scan start behavior", () => {
  it("does not auto-start a scan when a repo is selected", async () => {
    render(<SupplyChainPage selectedProject={makeSelectedProject()} />);
    expect(await screen.findByText("Scan is idle")).toBeInTheDocument();
    expect(mockTriggerScan).not.toHaveBeenCalled();
  });

  it("loads stored history automatically without starting a new scan", async () => {
    mockGetScanHistory.mockResolvedValue([makeHistoryItem()]);
    mockGetScanResults.mockResolvedValue({ ...makeTriggeredScan(), id: 9, scan_status: "completed", total_deps: 12, vulnerable_deps: 2, security_score: 81, dependency_score: 76, code_security_score: 89 });
    render(<SupplyChainPage selectedProject={makeSelectedProject()} />);
    expect(await screen.findAllByText("Stored result")).toHaveLength(1);
    expect(mockTriggerScan).not.toHaveBeenCalled();
  });

  it("starts scanning only after the Fast Scan button is clicked", async () => {
    const user = userEvent.setup();
    mockTriggerScan.mockResolvedValue(makeTriggeredScan());
    render(<SupplyChainPage selectedProject={makeSelectedProject()} />);
    await user.click(screen.getByRole("button", { name: "Fast Scan" }));
    expect(mockTriggerScan).toHaveBeenCalledWith("MacroXie04/numberBomb", "fast");
  });
});
