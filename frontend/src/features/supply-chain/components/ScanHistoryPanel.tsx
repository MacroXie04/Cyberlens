import type { GitHubScanHistoryItem } from "../types";

import { formatTime, statusTone } from "../lib/history";

function HistoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "8px 10px", borderRadius: 10, background: "var(--md-surface-container-high)" }}>
      <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)" }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 13, fontWeight: 700, color: "var(--md-on-surface)", fontFamily: "var(--md-font-mono)" }}>{value}</div>
    </div>
  );
}

interface Props {
  historyLoading: boolean;
  scanHistory: GitHubScanHistoryItem[];
  selectedScanId: number | null;
  onSelect: (item: GitHubScanHistoryItem) => Promise<void>;
}

export default function ScanHistoryPanel({ historyLoading, scanHistory, selectedScanId, onSelect }: Props) {
  return (
    <aside className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>Scan History</div>
        <div style={{ marginTop: 6, fontSize: 13, color: "var(--md-on-surface-variant)", lineHeight: 1.6 }}>Stored scans for the current repository. Selecting a result does not trigger a new scan.</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {historyLoading ? <div style={{ padding: 16, fontSize: 13, color: "var(--md-on-surface-variant)" }}>Loading scan history...</div> : scanHistory.length === 0 ? (
          <div style={{ padding: 16, borderRadius: 14, background: "var(--md-surface-container)", fontSize: 13, color: "var(--md-on-surface-variant)", lineHeight: 1.6 }}>No stored scans for this repository yet. Use <strong>Fast Scan</strong> or <strong>Full Scan</strong> to start one manually.</div>
        ) : scanHistory.map((item) => (
          <button key={item.id} type="button" onClick={() => void onSelect(item)} style={{ border: selectedScanId === item.id ? "1px solid var(--md-primary)" : "1px solid var(--md-outline-variant)", background: selectedScanId === item.id ? "rgba(2, 119, 189, 0.08)" : "var(--md-surface-container)", borderRadius: 14, padding: "14px 14px 12px", textAlign: "left", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--md-on-surface)" }}>{item.scan_mode === "fast" ? "Fast Scan" : "Full Scan"}</span>
              <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, background: statusTone(item.scan_status).background, color: statusTone(item.scan_status).color, fontWeight: 700 }}>{statusTone(item.scan_status).label}</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--md-on-surface-variant)" }}>{formatTime(item.scanned_at)}</div>
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              <HistoryMetric label="Score" value={String(item.security_score ?? 0)} />
              <HistoryMetric label="Vuln Deps" value={String(item.vulnerable_deps ?? 0)} />
              <HistoryMetric label="Code" value={String(item.code_findings_count ?? 0)} />
            </div>
            {item.error_message && <div style={{ marginTop: 10, fontSize: 11, color: "var(--md-error)", lineHeight: 1.5 }}>{item.error_message}</div>}
          </button>
        ))}
      </div>
    </aside>
  );
}
