import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SupplyChainPage from "../pages/SupplyChainPage";
import { getAdkTraceSnapshot, getScanHistory, getScanResults } from "../features/supply-chain/api";

vi.mock("../hooks/useSocket", () => ({ useSocket: () => ({ connected: true, emit: vi.fn() }) }));
vi.mock("../features/supply-chain/api", () => ({ triggerScan: vi.fn(), getScanHistory: vi.fn(), getScanResults: vi.fn(), getAiReport: vi.fn(), getCodeFindings: vi.fn(), getAdkTraceSnapshot: vi.fn() }));
vi.mock("../components/SupplyChain/AdkPipelineView", () => ({ default: () => <div>ADK Pipeline Stub</div> }));
vi.mock("../components/SupplyChain/AgentActivityPanel", () => ({ default: () => <div>Agent Activity Stub</div> }));
vi.mock("../components/SupplyChain/AgentRequestLog", () => ({ default: () => <div>Agent Request Log Stub</div> }));
vi.mock("../components/SupplyChain/AiRemediationReport", () => ({ default: () => <div>AI Report Stub</div> }));
vi.mock("../components/SupplyChain/CodeScanLiveView", () => ({ default: () => <div>Code Scan Live Stub</div> }));
vi.mock("../components/SupplyChain/CodeSecurityFindings", () => ({ default: () => <div>Findings Stub</div> }));
vi.mock("../components/SupplyChain/DependencyInventory", () => ({ default: () => <div>Dependency Inventory Stub</div> }));
vi.mock("../components/SupplyChain/DependencyList", () => ({ default: () => <div>Dependency List Stub</div> }));
vi.mock("../components/SupplyChain/DependencyTree", () => ({ default: () => <div>Dependency Tree Stub</div> }));
vi.mock("../components/SupplyChain/ScanProgress", () => ({ default: () => <div>Scan Progress Stub</div> }));
vi.mock("../components/SupplyChain/VulnerabilityList", () => ({ default: () => <div>Vulnerability List Stub</div> }));

const mockGetScanHistory = vi.mocked(getScanHistory);
const mockGetScanResults = vi.mocked(getScanResults);
const mockGetAdkTraceSnapshot = vi.mocked(getAdkTraceSnapshot);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAdkTraceSnapshot.mockResolvedValue({ phases: [], events: [], artifacts: {} as never });
  mockGetScanHistory.mockResolvedValue([{ id: 9, repo_name: "MacroXie04/numberBomb", repo_url: "https://github.com/MacroXie04/numberBomb", scan_source: "github", scan_mode: "fast", scan_status: "completed", total_deps: 12, vulnerable_deps: 2, security_score: 81, dependency_score: 76, code_security_score: 89, code_findings_count: 1, code_scan_phase: "", scanned_at: "2026-03-07T00:00:00Z", started_at: "2026-03-07T00:00:00Z", completed_at: "2026-03-07T00:02:00Z", duration_ms: 120000, error_message: "" }]);
  mockGetScanResults.mockResolvedValue({ id: 9, repo_name: "MacroXie04/numberBomb", repo_url: "https://github.com/MacroXie04/numberBomb", scan_source: "github", scan_mode: "fast", scan_status: "completed", total_deps: 12, vulnerable_deps: 2, security_score: 81, dependency_score: 76, code_security_score: 89, scanned_at: "2026-03-07T00:00:00Z", code_scan_input_tokens: 0, code_scan_output_tokens: 0, code_scan_total_tokens: 0, code_scan_files_scanned: 0, code_scan_files_total: 0, code_scan_phase: "", code_scan_stats_json: {}, error_message: "", started_at: "2026-03-07T00:00:00Z", completed_at: "2026-03-07T00:02:00Z", duration_ms: 120000, code_findings_count: 0, dependencies: [], code_findings: [] });
});

describe("SupplyChainPage tabs", () => {
  it("shows overview content by default", async () => {
    render(<SupplyChainPage selectedProject={{ mode: "github", repo: { full_name: "MacroXie04/numberBomb", name: "numberBomb", private: true, language: "TypeScript", updated_at: "2026-03-07T00:00:00Z", description: "repo", stargazers_count: 0, forks_count: 0, open_issues_count: 0, default_branch: "main", html_url: "https://github.com/MacroXie04/numberBomb" } }} />);
    await screen.findAllByText("Stored result");
    expect(screen.getByText("Dependency Tree Stub")).toBeInTheDocument();
    expect(screen.queryByText("Dependency List Stub")).not.toBeInTheDocument();
  });

  it("shows dependency inventory, tree, and list when Dependencies tab is selected", async () => {
    const user = userEvent.setup();
    render(<SupplyChainPage selectedProject={{ mode: "github", repo: { full_name: "MacroXie04/numberBomb", name: "numberBomb", private: true, language: "TypeScript", updated_at: "2026-03-07T00:00:00Z", description: "repo", stargazers_count: 0, forks_count: 0, open_issues_count: 0, default_branch: "main", html_url: "https://github.com/MacroXie04/numberBomb" } }} />);
    await screen.findAllByText("Stored result");
    await user.click(screen.getByRole("button", { name: /^Dependencies/i }));
    expect(screen.getByText("Dependency Inventory Stub")).toBeInTheDocument();
    expect(screen.getByText("Dependency Tree Stub")).toBeInTheDocument();
    expect(screen.getByText("Dependency List Stub")).toBeInTheDocument();
  });
});
