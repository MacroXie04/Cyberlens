import type { ReactNode } from "react";

import { socColors } from "../../theme/theme";

export const priorityColors: Record<string, string> = {
  p1: socColors.critical,
  p2: socColors.high,
  p3: socColors.medium,
  p4: socColors.p4,
};

export const statusColors: Record<string, string> = {
  open: socColors.critical,
  investigating: socColors.high,
  mitigated: socColors.medium,
  resolved: socColors.safe,
  false_positive: socColors.textDim,
};

export function formatTime(ts: string | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: socColors.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
      {children}
    </div>
  );
}

export function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: socColors.textDim }}>{label}:</span>
      <br />
      <span style={{ color: socColors.text }}>{value}</span>
    </div>
  );
}

export function ActionButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        color,
        border: `1px solid ${color}`,
        borderRadius: 6,
        padding: "6px 14px",
        fontSize: 12,
        cursor: "pointer",
        fontWeight: 500,
      }}
    >
      {label}
    </button>
  );
}
