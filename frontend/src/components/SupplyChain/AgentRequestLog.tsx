import { useMemo, useState } from "react";
import type { AdkTraceEvent } from "../../types";

interface Props {
  events: AdkTraceEvent[];
  loading?: boolean;
}

const PHASE_COLORS: Record<string, string> = {
  chunk_summary: "#42a5f5",
  candidate_generation: "#ab47bc",
  evidence_expansion: "#ff7043",
  verification: "#66bb6a",
  repo_synthesis: "#26c6da",
};

export default function AgentRequestLog({ events, loading }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const totals = useMemo(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let durationMs = 0;
    for (const e of events) {
      inputTokens += e.input_tokens;
      outputTokens += e.output_tokens;
      totalTokens += e.total_tokens;
      durationMs += e.duration_ms;
    }
    return { count: events.length, inputTokens, outputTokens, totalTokens, durationMs };
  }, [events]);

  if (events.length === 0 && !loading) return null;

  return (
    <div
      className="card"
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <h4
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--md-on-surface)",
            margin: 0,
          }}
        >
          Agent Request Log
          {loading && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                color: "var(--md-primary)",
                fontWeight: 400,
              }}
            >
              streaming...
            </span>
          )}
        </h4>
        {totals.count > 0 && (
          <div
            style={{
              display: "flex",
              gap: 14,
              fontSize: 11,
              color: "var(--md-on-surface-variant)",
            }}
          >
            <span>
              <strong style={{ color: "var(--md-on-surface)" }}>{totals.count}</strong> requests
            </span>
            <span>
              <strong style={{ color: "var(--md-on-surface)" }}>
                {totals.inputTokens.toLocaleString()}
              </strong>{" "}
              in
            </span>
            <span>
              <strong style={{ color: "var(--md-on-surface)" }}>
                {totals.outputTokens.toLocaleString()}
              </strong>{" "}
              out
            </span>
            <span>
              <strong style={{ color: "var(--md-primary)" }}>
                {totals.totalTokens.toLocaleString()}
              </strong>{" "}
              total
            </span>
            <span>
              <strong style={{ color: "var(--md-on-surface)" }}>
                {(totals.durationMs / 1000).toFixed(1)}s
              </strong>
            </span>
          </div>
        )}
      </div>

      {events.length === 0 && loading && (
        <div
          style={{
            fontSize: 13,
            color: "var(--md-on-surface-variant)",
            padding: "8px 0",
          }}
        >
          Waiting for agent LLM calls...
        </div>
      )}

      {events.length > 0 && (
        <div
          style={{
            maxHeight: 320,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {events.map((event) => {
            const isExpanded = expandedId === event.id;
            const phaseColor = PHASE_COLORS[event.phase] || "var(--md-outline)";
            const isError = event.status === "error";

            return (
              <div
                key={event.id}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "var(--md-surface-container)",
                  cursor: event.text_preview ? "pointer" : "default",
                }}
                onClick={() => {
                  if (event.text_preview) setExpandedId(isExpanded ? null : event.id);
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                  }}
                >
                  {/* Phase badge */}
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 600,
                      background: `${phaseColor}22`,
                      color: phaseColor,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {event.phase.replace(/_/g, " ")}
                  </span>

                  {/* Label */}
                  <span
                    style={{
                      flex: 1,
                      color: "var(--md-on-surface)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {event.label}
                  </span>

                  {/* Status indicator */}
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: isError ? "var(--md-error)" : "var(--md-safe)",
                      flexShrink: 0,
                    }}
                  />

                  {/* Tokens */}
                  <span
                    style={{
                      fontFamily: "var(--md-font-mono)",
                      fontSize: 11,
                      color: "var(--md-on-surface-variant)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {event.input_tokens.toLocaleString()}/{event.output_tokens.toLocaleString()}
                  </span>

                  {/* Duration */}
                  <span
                    style={{
                      fontFamily: "var(--md-font-mono)",
                      fontSize: 11,
                      color: "var(--md-on-surface-variant)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      minWidth: 40,
                      textAlign: "right",
                    }}
                  >
                    {(event.duration_ms / 1000).toFixed(1)}s
                  </span>
                </div>

                {/* Expanded text preview */}
                {isExpanded && event.text_preview && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 8,
                      borderRadius: 6,
                      background: "var(--md-surface-container-high)",
                      fontSize: 11,
                      fontFamily: "var(--md-font-mono)",
                      color: "var(--md-on-surface-variant)",
                      maxHeight: 120,
                      overflowY: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      lineHeight: 1.5,
                    }}
                  >
                    {event.text_preview.slice(0, 1000)}
                    {event.text_preview.length > 1000 && "..."}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
