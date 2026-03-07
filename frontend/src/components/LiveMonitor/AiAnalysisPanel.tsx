import type { HttpRequest } from "../../types";

interface Props {
  request: HttpRequest | null;
}

export default function AiAnalysisPanel({ request }: Props) {
  if (!request) {
    return (
      <div className="card" style={{ minHeight: 200 }}>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 500,
            marginBottom: 16,
            color: "var(--md-on-surface)",
          }}
        >
          AI Analysis
        </h3>
        <div
          style={{
            textAlign: "center",
            padding: 40,
            color: "var(--md-on-surface-variant)",
          }}
        >
          Select a request to view AI analysis
        </div>
      </div>
    );
  }

  const analysis = request.analysis;

  return (
    <div className="card" style={{ minHeight: 200 }}>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 500,
          marginBottom: 16,
          color: "var(--md-on-surface)",
        }}
      >
        AI Analysis
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Request Summary */}
        <div
          style={{
            padding: 12,
            background: "var(--md-surface-container-high)",
            borderRadius: 16,
          }}
        >
          <div className="mono" style={{ color: "var(--md-primary)" }}>
            {request.method} {request.path}
          </div>
          <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginTop: 4 }}>
            From {request.ip} &middot; {request.user_agent}
          </div>
        </div>

        {analysis ? (
          <>
            {/* Threat Info */}
            <div style={{ display: "flex", gap: 12 }}>
              <div
                style={{
                  flex: 1,
                  padding: 12,
                  background: "var(--md-surface-container-high)",
                  borderRadius: 16,
                }}
              >
                <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)" }}>
                  Threat Level
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color:
                      analysis.threat_level === "malicious"
                        ? "var(--md-error)"
                        : analysis.threat_level === "suspicious"
                          ? "var(--md-warning)"
                          : "var(--md-safe)",
                  }}
                >
                  {analysis.threat_level.toUpperCase()}
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  padding: 12,
                  background: "var(--md-surface-container-high)",
                  borderRadius: 16,
                }}
              >
                <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)" }}>
                  Confidence
                </div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>
                  {(analysis.confidence * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Reason */}
            <div
              style={{
                padding: 12,
                background: "var(--md-surface-container-high)",
                borderRadius: 16,
              }}
            >
              <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginBottom: 4 }}>
                Analysis
              </div>
              <div style={{ fontSize: 14 }}>{analysis.reason}</div>
            </div>

            {/* Recommendation */}
            {analysis.recommendation && (
              <div
                style={{
                  padding: 12,
                  background: "var(--md-surface-container-high)",
                  borderRadius: 16,
                }}
              >
                <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginBottom: 4 }}>
                  Recommendation
                </div>
                <div style={{ fontSize: 14 }}>{analysis.recommendation}</div>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: 20, textAlign: "center", color: "var(--md-on-surface-variant)" }}>
            Analysis pending...
          </div>
        )}
      </div>
    </div>
  );
}
