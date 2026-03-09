import type { CloudRunLogAnalysis } from "./cloudRunLogAnalysis";
import { analysisToneColor, signalToneColor } from "./cloudRunLogStyles";

interface Props {
  analysis: CloudRunLogAnalysis;
}

export default function CloudRunLogSummary({ analysis }: Props) {
  if (analysis.counts.total === 0) {
    return null;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 12 }}>
      <div style={{ background: "var(--md-surface-container)", borderRadius: 8, padding: 14 }}>
        <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginBottom: 6 }}>Log Analysis</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: analysisToneColor(analysis.tone) }}>{analysis.headline}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {[
            { label: "Entries", value: analysis.counts.total },
            { label: "Errors", value: analysis.counts.error },
            { label: "Warnings", value: analysis.counts.warning },
            { label: "Investigate", value: analysis.counts.investigate },
          ].map((item) => (
            <div key={item.label} style={{ minWidth: 92, borderRadius: 8, padding: "8px 10px", background: "var(--md-surface-container-high)" }}>
              <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>{item.label}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "var(--md-on-surface)" }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {analysis.insights.map((insight) => (
            <div key={insight} style={{ fontSize: 13, color: "var(--md-on-surface)", background: "var(--md-surface-container-high)", borderRadius: 8, padding: "8px 10px" }}>
              {insight}
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "var(--md-surface-container)", borderRadius: 8, padding: 14, display: "grid", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginBottom: 8 }}>Key Signals</div>
          {analysis.signals.length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              {analysis.signals.map((signal) => (
                <div key={signal.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 10px", borderRadius: 8, background: "var(--md-surface-container-high)" }}>
                  <span style={{ color: signalToneColor(signal.tone), fontWeight: 500 }}>{signal.label}</span>
                  <span style={{ color: "var(--md-on-surface-variant)", fontSize: 12 }}>{signal.count} lines</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)" }}>No strong failure or attack signature was detected in the current sample.</div>
          )}
        </div>

        {analysis.repeatedMessages.length > 0 && (
          <div>
            <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginBottom: 8 }}>Repeated Messages</div>
            <div style={{ display: "grid", gap: 8 }}>
              {analysis.repeatedMessages.map((item) => (
                <div key={`${item.sample}-${item.count}`} style={{ padding: "8px 10px", borderRadius: 8, background: "var(--md-surface-container-high)", fontSize: 13, color: "var(--md-on-surface)" }}>
                  <strong style={{ marginRight: 6 }}>{item.count}x</strong>
                  {item.sample}
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis.recommendations.length > 0 && (
          <div>
            <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginBottom: 8 }}>Recommended Checks</div>
            <div style={{ display: "grid", gap: 8 }}>
              {analysis.recommendations.map((recommendation) => (
                <div key={recommendation} style={{ padding: "8px 10px", borderRadius: 8, background: "var(--md-surface-container-high)", fontSize: 13, color: "var(--md-on-surface)" }}>
                  {recommendation}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
