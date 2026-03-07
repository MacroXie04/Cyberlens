import type { AiReport } from "../../types";

interface Props {
  report: AiReport | null;
}

export default function AiRemediationReport({ report }: Props) {
  return (
    <div className="card" style={{ minHeight: 300 }}>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 500,
          marginBottom: 16,
          color: "var(--md-on-surface)",
        }}
      >
        AI Remediation Report
      </h3>

      {!report ? (
        <div
          style={{
            textAlign: "center",
            padding: 40,
            color: "var(--md-on-surface-variant)",
          }}
        >
          Run a scan to generate AI remediation report
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Executive Summary */}
          <div
            style={{
              padding: 16,
              background: "var(--md-surface-container-high)",
              borderRadius: 16,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--md-primary)",
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Executive Summary
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              {report.executive_summary}
            </div>
          </div>

          {/* Priority Ranking */}
          {report.priority_ranking.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--md-primary)",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Priority Actions
              </div>
              {report.priority_ranking.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    padding: 12,
                    background: "var(--md-surface-container-high)",
                    borderRadius: 12,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "var(--md-primary)",
                      color: "var(--md-on-primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <div className="mono" style={{ fontWeight: 500 }}>
                      {item.package}{" "}
                      <span style={{ color: "var(--md-on-surface-variant)" }}>
                        {item.cve}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--md-on-surface-variant)",
                        marginTop: 2,
                      }}
                    >
                      {item.action}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Remediation Steps */}
          {report.remediation_json && (
            <div>
              {report.remediation_json.immediate &&
                report.remediation_json.immediate.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--md-error)",
                        marginBottom: 4,
                      }}
                    >
                      Immediate
                    </div>
                    <ul style={{ paddingLeft: 20, fontSize: 13 }}>
                      {report.remediation_json.immediate.map((s, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              {report.remediation_json.short_term &&
                report.remediation_json.short_term.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--md-warning)",
                        marginBottom: 4,
                      }}
                    >
                      Short Term
                    </div>
                    <ul style={{ paddingLeft: 20, fontSize: 13 }}>
                      {report.remediation_json.short_term.map((s, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              {report.remediation_json.long_term &&
                report.remediation_json.long_term.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--md-safe)",
                        marginBottom: 4,
                      }}
                    >
                      Long Term
                    </div>
                    <ul style={{ paddingLeft: 20, fontSize: 13 }}>
                      {report.remediation_json.long_term.map((s, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
