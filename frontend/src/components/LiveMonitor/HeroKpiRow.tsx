import type { GcpEstateSummary, LiveMonitorMode } from "../../types";
import { socColors, typography } from "../../theme/theme";

interface Props {
  summary: GcpEstateSummary | null;
  mode: LiveMonitorMode;
  replayWindowLabel: string;
}

interface KpiCard {
  label: string;
  value: number;
  tone: "critical" | "high" | "medium" | "safe";
  supporting: string;
}

export default function HeroKpiRow({ summary, mode, replayWindowLabel }: Props) {
  const cards: KpiCard[] = [
    {
      label: "Active Incidents",
      value: summary?.active_incidents ?? 0,
      tone: "critical",
      supporting:
        mode === "live"
          ? "Open or investigating now"
          : `Visible in ${replayWindowLabel}`,
    },
    {
      label: "Services Under Attack",
      value: summary?.services_under_attack ?? 0,
      tone: "high",
      supporting: "Distinct services with high or critical events",
    },
    {
      label: "Armor Blocks",
      value: summary?.armor_blocks_recent ?? 0,
      tone: "medium",
      supporting: "Cloud Armor prevented requests in the replay window",
    },
    {
      label: "Auth Failures",
      value: summary?.auth_failures_recent ?? 0,
      tone: "high",
      supporting: "IAP and credential abuse indicators",
    },
    {
      label: "Error Surges",
      value: summary?.error_events_recent ?? 0,
      tone: "critical",
      supporting: "Error burst detections in logs and metrics",
    },
    {
      label: "Unhealthy Revisions",
      value: summary?.unhealthy_revisions ?? 0,
      tone: "safe",
      supporting: "Services over the error threshold",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
        gap: 14,
      }}
    >
      {cards.map((card) => {
        const styles = toneStyles(card.tone);
        return (
          <div
            key={card.label}
            style={{
              background: socColors.bgCard,
              border: `1px solid ${socColors.border}`,
              borderRadius: 28,
              padding: 18,
              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: socColors.textMuted,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {card.label}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 36,
                    lineHeight: 1,
                    fontWeight: 700,
                    color: styles.text,
                    fontFamily: typography.fontDisplay,
                  }}
                >
                  {card.value}
                </div>
              </div>

              <span
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: styles.background,
                  color: styles.text,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {card.value === 0 ? "Stable" : "Active"}
              </span>
            </div>

            <div style={{ fontSize: 13, color: socColors.textDim, lineHeight: 1.5 }}>
              {card.supporting}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function toneStyles(tone: KpiCard["tone"]) {
  switch (tone) {
    case "critical":
      return { text: socColors.critical, background: socColors.criticalBg };
    case "high":
      return { text: socColors.high, background: socColors.highBg };
    case "medium":
      return { text: socColors.medium, background: socColors.mediumBg };
    default:
      return { text: socColors.safe, background: socColors.safeBg };
  }
}
