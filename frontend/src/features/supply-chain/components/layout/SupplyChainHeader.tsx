import type { CSSProperties } from "react";

import type { AdkTraceSnapshot, CodeFinding, GitHubScan, GitHubScanHistoryItem, SelectedProject } from "../../types";
import { formatDuration, formatTime, statusTone } from "../../lib/history";

function SnapshotMetric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--md-surface-container)" }}><div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>{label}</div><div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: tone || "var(--md-on-surface)", wordBreak: "break-word" }}>{value}</div></div>;
}

function StatCard({ label, value, detail, color }: { label: string; value: number; detail?: string; color: string }) {
  return <div className="card" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 4 }}><div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", fontWeight: 500 }}>{label}</div><div style={{ display: "flex", alignItems: "baseline", gap: 4 }}><span style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--md-font-mono)", color, lineHeight: 1 }}>{value}</span></div>{detail && <div style={{ fontSize: 12, color, marginTop: 2 }}>{detail}</div>}</div>;
}

function Spinner() {
  return <div style={{ width: 14, height: 14, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />;
}

const buttonStyle: CSSProperties = { padding: "10px 18px", borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, border: "none" };

interface Props {
  activeScan: GitHubScan | null;
  adkTrace: AdkTraceSnapshot | null;
  liveCodeFindings: CodeFinding[];
  scoreColor: string;
  scanning: boolean;
  selectedHistoryItem: GitHubScanHistoryItem | null;
  selectedProject: SelectedProject;
  totalVulns: number;
  activityPhaseLabel: string;
  hasTrace: boolean;
  vulnerabilitySummary: string;
  codeSummary: string;
  runScan: (mode: "fast" | "full") => Promise<void>;
}

export default function SupplyChainHeader({ activeScan, adkTrace, liveCodeFindings, scoreColor, scanning, selectedHistoryItem, selectedProject, totalVulns, activityPhaseLabel, hasTrace, vulnerabilitySummary, codeSummary, runScan }: Props) {
  const selectedStatus = statusTone(activeScan?.scan_status || selectedHistoryItem?.scan_status);
  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--md-on-surface)", margin: 0 }}>{selectedProject?.repo.name}</h2>
            <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, fontWeight: 700, background: selectedStatus.background, color: selectedStatus.color }}>{selectedStatus.label}</span>
            {(activeScan?.scan_mode || selectedHistoryItem?.scan_mode) && <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, fontWeight: 700, background: "var(--md-surface-container-high)", color: "var(--md-on-surface)" }}>{(activeScan?.scan_mode || selectedHistoryItem?.scan_mode) === "fast" ? "Fast Scan" : "Full Scan"}</span>}
            <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, fontWeight: 600, background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)" }}>{(activeScan?.scan_status || selectedHistoryItem?.scan_status) === "scanning" ? "Live scan" : "Stored result"}</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "var(--md-on-surface-variant)", fontFamily: "var(--md-font-mono)" }}>{selectedProject?.repo.full_name}</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => void runScan("fast")} disabled={scanning} style={{ ...buttonStyle, background: scanning ? "var(--md-surface-container-high)" : "var(--md-primary)", color: scanning ? "var(--md-on-surface-variant)" : "var(--md-on-primary)" }}>{scanning && <Spinner />}{scanning ? "Scanning..." : "Fast Scan"}</button>
          <button onClick={() => void runScan("full")} disabled={scanning} style={{ ...buttonStyle, background: "var(--md-surface-container)", color: scanning ? "var(--md-on-surface-variant)" : "var(--md-on-surface)", border: "1px solid var(--md-outline-variant)" }}>Full Scan</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <SnapshotMetric label="Started" value={formatTime(activeScan?.started_at || selectedHistoryItem?.started_at || activeScan?.scanned_at || selectedHistoryItem?.scanned_at)} />
        <SnapshotMetric label="Completed" value={formatTime(activeScan?.completed_at || selectedHistoryItem?.completed_at)} />
        <SnapshotMetric label="Duration" value={formatDuration(activeScan?.duration_ms || selectedHistoryItem?.duration_ms)} />
        <SnapshotMetric label="Security Score" value={`${activeScan?.security_score ?? selectedHistoryItem?.security_score ?? 0}/100`} tone={scoreColor} />
      </div>

      {activeScan && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <StatCard label="Dependencies" value={activeScan.total_deps} detail={`${activeScan.vulnerable_deps} vulnerable`} color={activeScan.vulnerable_deps > 0 ? "var(--md-error)" : "var(--md-safe)"} />
        <StatCard label="Vulnerabilities" value={totalVulns} detail={vulnerabilitySummary} color={totalVulns > 0 ? "var(--md-error)" : "var(--md-safe)"} />
        <StatCard label="Code Findings" value={liveCodeFindings.length} detail={codeSummary} color={liveCodeFindings.length > 0 ? "var(--md-warning)" : "var(--md-safe)"} />
        <StatCard label="Execution" value={hasTrace ? adkTrace?.events.length || 0 : 0} detail={activityPhaseLabel} color="var(--md-primary)" />
      </div>}

      {activeScan?.error_message && <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(198, 40, 40, 0.08)", color: "var(--md-error)", fontSize: 13, lineHeight: 1.6 }}>{activeScan.error_message}</div>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
