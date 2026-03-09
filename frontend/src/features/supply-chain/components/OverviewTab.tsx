import type { AiReport, CodeFinding, Dependency, GitHubScan } from "../types";

import AiRemediationReport from "../../../components/SupplyChain/AiRemediationReport";
import DependencyTree from "../../../components/SupplyChain/DependencyTree";
import { InlineScanNotice, MetricBox } from "./SupplyChainStates";

interface Props {
  activeScan: GitHubScan | null;
  codeSummary: string;
  dependencies: Dependency[];
  liveCodeFindings: CodeFinding[];
  report: AiReport | null;
  vulnerabilitySummary: string;
}

export default function OverviewTab({ activeScan, codeSummary, dependencies, liveCodeFindings, report, vulnerabilitySummary }: Props) {
  if (!activeScan) {
    return <InlineScanNotice message="Select a stored scan to inspect the analyst summary." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <MetricBox><div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>Dependency Severity</div><div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: "var(--md-on-surface)" }}>{vulnerabilitySummary}</div></MetricBox>
        <MetricBox><div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>Code Severity</div><div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: "var(--md-on-surface)" }}>{codeSummary}</div></MetricBox>
        <MetricBox><div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>Vulnerable Dependencies</div><div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: "var(--md-on-surface)" }}>{activeScan.vulnerable_deps}/{activeScan.total_deps}</div></MetricBox>
        <MetricBox><div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>Code Findings</div><div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: "var(--md-on-surface)" }}>{liveCodeFindings.length}</div></MetricBox>
      </div>
      <DependencyTree dependencies={dependencies} />
      {report ? <AiRemediationReport report={report} /> : <InlineScanNotice message="AI remediation summary is not available for this scan yet." />}
    </div>
  );
}
