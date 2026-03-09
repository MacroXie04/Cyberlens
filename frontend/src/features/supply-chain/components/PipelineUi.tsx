import type { ReactNode } from "react";

export function MetricPill({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div style={{ padding: "8px 10px", borderRadius: 10, background: alert ? "rgba(198, 40, 40, 0.08)" : "var(--md-surface-container-high)" }}>
      <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)" }}>{label}</div>
      <div style={{ fontSize: 13, marginTop: 2, fontWeight: 700, color: alert ? "var(--md-error)" : "var(--md-on-surface)", fontFamily: "var(--md-font-mono)" }}>
        {value}
      </div>
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, color: "var(--md-on-surface-variant)", fontWeight: 500 }}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={{ height: 40, borderRadius: 10, border: "1px solid var(--md-outline-variant)", background: "var(--md-surface-container)", color: "var(--md-on-surface)", padding: "0 12px", fontSize: 13 }}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--md-primary)", fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ padding: 14, borderRadius: 12, background: "var(--md-surface-container-high)" }}>{children}</div>
    </div>
  );
}

export function ArtifactCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--md-on-surface)" }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto" }}>{children}</div>
    </div>
  );
}

export function ArtifactRow({ title, meta, children, tone = "default", onClick }: { title: string; meta: string[]; children: ReactNode; tone?: "default" | "success" | "warning"; onClick?: () => void; }) {
  const toneColor = tone === "success" ? "var(--md-safe)" : tone === "warning" ? "var(--md-warning)" : "var(--md-primary)";
  const toneSurface = tone === "success" ? "rgba(46, 125, 50, 0.08)" : tone === "warning" ? "rgba(245, 124, 0, 0.08)" : "var(--md-surface-container-high)";

  return (
    <div role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={onClick ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onClick(); } } : undefined} style={{ padding: 12, borderRadius: 12, background: toneSurface, border: `1px solid ${toneColor}22`, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--md-on-surface)" }}>{title}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6, fontSize: 11, color: toneColor }}>{meta.filter(Boolean).map((item) => <span key={item}>{item}</span>)}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: "var(--md-on-surface-variant)", lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

export function EmptyArtifactState({ label }: { label: string }) {
  return <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)" }}>{label}</div>;
}
