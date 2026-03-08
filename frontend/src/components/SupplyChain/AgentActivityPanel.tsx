import { useState } from "react";
import type { AdkTracePhase, AdkTracePhaseSummary, AdkTraceSnapshot } from "../../types";

interface Props {
  adkTrace: AdkTraceSnapshot;
  tokens: { input: number; output: number; total: number };
  filesScanned: number;
  totalFiles: number;
  currentActivity: string;
  warningMessage?: string;
}

const PHASE_ORDER: AdkTracePhase[] = [
  "dependency_input",
  "dependency_adk_report",
  "code_inventory",
  "chunk_summary",
  "candidate_generation",
  "evidence_expansion",
  "verification",
  "repo_synthesis",
];

const PHASE_SHORT_LABELS: Record<AdkTracePhase, string> = {
  dependency_input: "Deps In",
  dependency_adk_report: "Deps ADK",
  code_inventory: "Inventory",
  chunk_summary: "Chunks",
  candidate_generation: "Candidates",
  evidence_expansion: "Evidence",
  verification: "Verify",
  repo_synthesis: "Synthesis",
};

const PHASE_COLORS: Record<AdkTracePhase, string> = {
  dependency_input: "#5c6bc0",
  dependency_adk_report: "#7e57c2",
  code_inventory: "#26a69a",
  chunk_summary: "#42a5f5",
  candidate_generation: "#ffa726",
  evidence_expansion: "#ab47bc",
  verification: "#66bb6a",
  repo_synthesis: "#ef5350",
};

function phaseStatusColor(status: AdkTracePhaseSummary["status"]): string {
  switch (status) {
    case "success":
      return "var(--md-safe)";
    case "running":
      return "var(--md-primary)";
    case "error":
      return "var(--md-error)";
    case "warning":
      return "var(--md-warning)";
    default:
      return "var(--md-outline)";
  }
}

export default function AgentActivityPanel({
  adkTrace,
  tokens,
  filesScanned,
  totalFiles,
  currentActivity,
  warningMessage,
}: Props) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const phaseMap = new Map<AdkTracePhase, AdkTracePhaseSummary>();
  for (const p of adkTrace.phases) {
    phaseMap.set(p.phase, p);
  }

  const currentPhase = [...PHASE_ORDER].reverse().find((phase) => {
    const summary = phaseMap.get(phase);
    return summary && (summary.status === "running" || summary.status === "success" || summary.status === "warning" || summary.status === "error");
  });

  const totalPhaseTokens = adkTrace.phases.reduce((s, p) => s + p.total_tokens, 0);

  return (
    <div
      className="card"
      style={{
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Pipeline Phase Strip */}
      <div style={{ display: "flex", gap: 4 }}>
        {PHASE_ORDER.map((phase) => {
          const summary = phaseMap.get(phase);
          const status = summary?.status || "pending";
          const isCurrent = phase === currentPhase && status === "running";
          const barColor = phaseStatusColor(status);

          return (
            <div key={phase} style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: barColor,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {isCurrent && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
                      animation: "shimmer 1.5s infinite",
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  fontSize: 9,
                  marginTop: 4,
                  color:
                    isCurrent
                      ? "var(--md-primary)"
                      : status === "success"
                        ? "var(--md-on-surface)"
                        : "var(--md-on-surface-variant)",
                  fontWeight: isCurrent ? 700 : 400,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {PHASE_SHORT_LABELS[phase]}
              </div>
              <div
                style={{
                  fontSize: 8,
                  fontFamily: "var(--md-font-mono)",
                  color: "var(--md-on-surface-variant)",
                  marginTop: 1,
                }}
              >
                {(summary?.total_tokens || 0) > 0
                  ? `${(summary!.total_tokens / 1000).toFixed(1)}k`
                  : "\u2014"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Agent Activity Row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: "var(--md-primary)",
            flexShrink: 0,
          }}
        >
          Agent Activity
        </div>
        {currentPhase && (
          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 10,
              fontWeight: 600,
              background: `${PHASE_COLORS[currentPhase]}22`,
              color: PHASE_COLORS[currentPhase],
              flexShrink: 0,
            }}
          >
            {PHASE_SHORT_LABELS[currentPhase]}
          </span>
        )}
        <div
          style={{
            fontSize: 13,
            color: "var(--md-on-surface)",
            lineHeight: 1.5,
            flex: 1,
            minWidth: 0,
          }}
        >
          {currentActivity}
        </div>
      </div>
      {warningMessage && (
        <div style={{ fontSize: 12, color: "var(--md-warning)", lineHeight: 1.5, marginTop: -8 }}>
          {warningMessage}
        </div>
      )}

      {/* Live Token Usage Row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          fontSize: 12,
          color: "var(--md-on-surface-variant)",
          padding: "10px 12px",
          background: "var(--md-surface-container-high)",
          borderRadius: 8,
        }}
      >
        <span style={{ fontWeight: 500, color: "var(--md-on-surface)" }}>Live token usage</span>
        <span>
          <strong style={{ color: "var(--md-on-surface)" }}>
            {tokens.input.toLocaleString()}
          </strong>{" "}
          input
        </span>
        <span>
          <strong style={{ color: "var(--md-on-surface)" }}>
            {tokens.output.toLocaleString()}
          </strong>{" "}
          output
        </span>
        <span>
          <strong style={{ color: "var(--md-on-surface)" }}>
            {tokens.total.toLocaleString()}
          </strong>{" "}
          total
        </span>
        {totalFiles > 0 && (
          <span>
            <strong style={{ color: "var(--md-on-surface)" }}>{filesScanned}</strong>/
            {totalFiles} files
          </span>
        )}
      </div>

      {/* Collapsible Per-Phase Token Breakdown */}
      {totalPhaseTokens > 0 && (
        <div>
          <button
            onClick={() => setBreakdownOpen(!breakdownOpen)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--md-on-surface-variant)",
              padding: "4px 0",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 10 }}>{breakdownOpen ? "\u25BC" : "\u25B6"}</span>
            Token breakdown by phase
          </button>
          {breakdownOpen && (
            <div style={{ marginTop: 8 }}>
              {/* Stacked bar */}
              <div
                style={{
                  display: "flex",
                  height: 8,
                  borderRadius: 4,
                  overflow: "hidden",
                  marginBottom: 10,
                }}
              >
                {PHASE_ORDER.map((phase) => {
                  const summary = phaseMap.get(phase);
                  const tok = summary?.total_tokens || 0;
                  if (tok === 0) return null;
                  const pct = (tok / totalPhaseTokens) * 100;
                  return (
                    <div
                      key={phase}
                      style={{
                        width: `${pct}%`,
                        background: PHASE_COLORS[phase],
                        minWidth: 2,
                      }}
                    />
                  );
                })}
              </div>
              {/* Legend */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {PHASE_ORDER.map((phase) => {
                  const summary = phaseMap.get(phase);
                  const tok = summary?.total_tokens || 0;
                  if (tok === 0) return null;
                  const pct = ((tok / totalPhaseTokens) * 100).toFixed(1);
                  return (
                    <div
                      key={phase}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 11,
                        color: "var(--md-on-surface-variant)",
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: PHASE_COLORS[phase],
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ flex: 1, color: "var(--md-on-surface)" }}>
                        {PHASE_SHORT_LABELS[phase]}
                      </span>
                      <span style={{ fontFamily: "var(--md-font-mono)" }}>
                        {tok.toLocaleString()}
                      </span>
                      <span style={{ fontFamily: "var(--md-font-mono)", width: 45, textAlign: "right" }}>
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
