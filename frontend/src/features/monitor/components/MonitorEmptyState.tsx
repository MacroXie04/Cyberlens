import { socColors, typography } from "../../../theme/theme";

export function LoadingMonitorState({ historyMode }: { historyMode: boolean }) {
  return (
    <div style={{ background: socColors.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "min(720px, 100%)", background: socColors.bgCard, border: `1px solid ${socColors.border}`, borderRadius: 36, padding: 32, boxShadow: socColors.shadow }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: socColors.text, fontFamily: typography.fontDisplay }}>{historyMode ? "Loading 30-day historical posture" : "Connecting live monitoring"}</div>
        <div style={{ marginTop: 10, fontSize: 14, color: socColors.textDim, lineHeight: 1.6 }}>{historyMode ? "Preparing timeline coverage, replay snapshots, and backfill status." : "Syncing the latest 15-minute window from GCP security telemetry."}</div>
        <div style={{ marginTop: 24, height: 12, borderRadius: 999, background: socColors.bgPanel, overflow: "hidden" }}><div style={{ width: "32%", height: "100%", borderRadius: 999, background: socColors.accent, animation: "liveMonitorLoading 1.2s ease-in-out infinite alternate" }} /></div>
        <style>{`@keyframes liveMonitorLoading { from { transform: translateX(0); } to { transform: translateX(180%); } }`}</style>
      </div>
    </div>
  );
}

export function ConfigMonitorState({ message }: { message: string }) {
  return (
    <div style={{ background: socColors.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "min(640px, 100%)", background: socColors.bgCard, border: `1px solid ${socColors.border}`, borderRadius: 36, padding: 32, boxShadow: socColors.shadow }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: socColors.text, fontFamily: typography.fontDisplay }}>GCP Live Monitor needs configuration</div>
        <div style={{ marginTop: 12, fontSize: 15, color: socColors.textDim, lineHeight: 1.7 }}>{message}</div>
      </div>
    </div>
  );
}

export function CollectionIssuesBanner({ errors }: { errors: Record<string, string> }) {
  if (Object.keys(errors).length === 0) return null;
  return (
    <div style={{ background: "linear-gradient(180deg, rgba(255,244,229,0.95) 0%, rgba(255,249,240,0.95) 100%)", border: "1px solid rgba(194, 100, 1, 0.28)", borderRadius: 28, padding: 18, color: socColors.high, boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)" }}>
      <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>Data collection issues</div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {Object.entries(errors).map(([source, message]) => <div key={source} style={{ fontSize: 13, lineHeight: 1.6, color: socColors.text }}><strong style={{ color: socColors.high }}>{source}:</strong> {message}</div>)}
      </div>
    </div>
  );
}
