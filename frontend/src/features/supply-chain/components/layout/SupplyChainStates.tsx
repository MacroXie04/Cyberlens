import type { ReactNode } from "react";

export function NoProjectState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "calc(100vh - 80px)", gap: 16, color: "var(--md-on-surface-variant)" }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--md-surface-container-high)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "var(--md-outline)" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /></svg>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 500, color: "var(--md-on-surface)", marginBottom: 4 }}>No project selected</div>
        <div style={{ fontSize: 14 }}>Connect GitHub in <strong>Settings</strong> and select a repository to inspect.</div>
      </div>
    </div>
  );
}

export function InlineScanNotice({ message }: { message: string }) {
  return <div className="card" style={{ padding: 14, background: "var(--md-surface-container)", color: "var(--md-on-surface-variant)", fontSize: 13 }}>{message}</div>;
}

export function IdleState() {
  return (
    <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 8, border: "1px dashed var(--md-outline-variant)", background: "var(--md-surface-container)" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--md-on-surface)" }}>Scan is idle</div>
      <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", lineHeight: 1.6 }}>Opening this page or switching repositories only loads stored history. Start a new scan manually with <strong>Fast Scan</strong> or <strong>Full Scan</strong>.</div>
    </div>
  );
}

export function MetricBox({ children }: { children: ReactNode }) {
  return <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--md-surface-container)" }}>{children}</div>;
}
