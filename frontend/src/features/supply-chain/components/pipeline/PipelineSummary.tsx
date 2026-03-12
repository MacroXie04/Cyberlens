import { deriveAgentActivity } from "../../../../components/SupplyChain/activity/activity";
import type { AdkTracePhaseSummary, AdkTraceSnapshot, CodeScanStreamEvent, GitHubScan } from "../../types";

import { deriveOverallProgress, derivePhaseProgress, findCurrentPhase, findLatestTokenEvent } from "../../lib/pipelineProgress";
import { artifactCounts, type VerificationOutcome, PHASE_LABELS, statusColor, statusSurface } from "../../lib/pipelineShared";
import { formatDuration, formatTimestamp } from "../../lib/pipelineShared";
import { MetricPill } from "../PipelineUi";

interface Props {
  snapshot: AdkTraceSnapshot;
  loading: boolean;
  phaseSummaries: AdkTracePhaseSummary[];
  scan: GitHubScan | null;
  codeScanStreamEvents: CodeScanStreamEvent[];
  verificationOutcomes: VerificationOutcome[];
  onSelectEvent: (eventId: number) => void;
}

export default function PipelineSummary({ snapshot, loading, phaseSummaries, scan, codeScanStreamEvents, verificationOutcomes, onSelectEvent }: Props) {
  const currentPhase = findCurrentPhase(phaseSummaries);
  const overallProgress = deriveOverallProgress(phaseSummaries, snapshot, scan, codeScanStreamEvents);
  const counts = artifactCounts(snapshot.artifacts, verificationOutcomes);
  const liveTokenEvent = findLatestTokenEvent(codeScanStreamEvents);
  const activity = deriveAgentActivity(snapshot, scan, codeScanStreamEvents);

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--md-on-surface)", margin: 0 }}>ADK Pipeline</h3>
          <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", marginTop: 4 }}>
            Full scan trace, live progress, and intermediate artifacts across dependency and code ADK
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {currentPhase && <span style={{ fontSize: 12, padding: "6px 10px", borderRadius: 999, background: statusSurface(currentPhase.status), color: statusColor(currentPhase.status), fontWeight: 600 }}>Current: {currentPhase.label || PHASE_LABELS[currentPhase.phase]}</span>}
          {loading && <span style={{ fontSize: 12, color: "var(--md-primary)", fontWeight: 600 }}>Live trace active</span>}
        </div>
      </div>

      <div className="adk-pipeline-activity-grid" style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)", gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--md-on-surface)", marginBottom: 10 }}>Agent Activity</div>
          {activity.recent_events.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)" }}>No agent activity yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ padding: 14, borderRadius: 12, background: activity.status === "error" ? statusSurface("error") : activity.status === "warning" ? statusSurface("warning") : statusSurface("running"), border: `1px solid ${activity.status === "error" ? statusColor("error") : activity.status === "warning" ? statusColor("warning") : statusColor("running")}22` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--md-on-surface)" }}>{activity.title}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--md-on-surface-variant)" }}>{activity.phase_label} · {formatTimestamp(activity.updated_at)}</div>
                <div style={{ marginTop: 10, fontSize: 13, color: "var(--md-on-surface)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {[activity.subject, activity.progress_text, activity.warning_message, activity.error_message].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {activity.recent_events.map((event) => (
                  <button key={event.id} type="button" onClick={() => onSelectEvent(event.id)} style={{ border: "1px solid var(--md-outline-variant)", background: "var(--md-surface-container)", borderRadius: 10, padding: "10px 12px", textAlign: "left", cursor: "pointer" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--md-on-surface)" }}>{event.label}</div>
                    <div style={{ marginTop: 4, fontSize: 11, color: "var(--md-on-surface-variant)" }}>{PHASE_LABELS[event.phase]} · {event.kind} · #{event.sequence}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--md-on-surface)", marginBottom: 10 }}>Live Token Usage</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
            <MetricPill label="Input" value={(liveTokenEvent?.input_tokens ?? scan?.code_scan_input_tokens ?? 0).toLocaleString()} />
            <MetricPill label="Output" value={(liveTokenEvent?.output_tokens ?? scan?.code_scan_output_tokens ?? 0).toLocaleString()} />
            <MetricPill label="Total" value={(liveTokenEvent?.total_tokens ?? scan?.code_scan_total_tokens ?? 0).toLocaleString()} />
            <MetricPill label="Files" value={`${scan?.code_scan_files_scanned ?? 0}/${scan?.code_scan_files_total ?? 0}`} />
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--md-on-surface-variant)", lineHeight: 1.6 }}>
            Token totals refresh after each ADK call completes. If the counters stay at zero, inspect the latest warning or error to see whether the agent was skipped before any model call started.
          </div>
        </div>
      </div>

      <div style={{ padding: 16, borderRadius: 16, background: "var(--md-surface-container)", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)" }}>Overall pipeline progress</div>
            <div style={{ marginTop: 4, fontSize: 22, fontWeight: 700, color: "var(--md-on-surface)" }}>{overallProgress}%</div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <MetricPill label="Events" value={snapshot.events.length.toLocaleString()} />
            <MetricPill label="Artifacts" value={(snapshot.artifacts.candidates.length + snapshot.artifacts.evidence_packs.length + snapshot.artifacts.verified_findings.length + snapshot.artifacts.dependency_report_batches.length).toLocaleString()} />
            <MetricPill label="Tokens" value={(liveTokenEvent?.total_tokens ?? scan?.code_scan_total_tokens ?? phaseSummaries.reduce((sum, item) => sum + item.total_tokens, 0)).toLocaleString()} />
            <MetricPill label="Files" value={`${scan?.code_scan_files_scanned ?? 0}/${scan?.code_scan_files_total ?? 0}`} />
          </div>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: "var(--md-surface-container-high)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${overallProgress}%`, background: "linear-gradient(90deg, var(--md-primary), var(--md-safe))", transition: "width 0.3s ease" }} />
        </div>
        {currentPhase && <div style={{ marginTop: 10, fontSize: 12, color: "var(--md-on-surface-variant)" }}>{derivePhaseProgress(currentPhase, snapshot, scan, codeScanStreamEvents).detail}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
        {counts.map((item) => (
          <div key={item.label} style={{ padding: "12px 14px", borderRadius: 12, background: "var(--md-surface-container-high)" }}>
            <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>{item.label}</div>
            <div style={{ marginTop: 4, fontSize: 20, fontWeight: 700, color: "var(--md-on-surface)", fontFamily: "var(--md-font-mono)" }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {phaseSummaries.map((phase) => {
          const progress = derivePhaseProgress(phase, snapshot, scan, codeScanStreamEvents);
          return (
            <div key={phase.phase} style={{ border: `1px solid ${statusColor(phase.status)}33`, background: statusSurface(phase.status), borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: statusColor(phase.status), flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--md-on-surface)" }}>{phase.label || PHASE_LABELS[phase.phase]}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--md-on-surface-variant)", fontFamily: "var(--md-font-mono)" }}>{progress.percent}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.5)", overflow: "hidden" }}><div style={{ height: "100%", width: `${progress.percent}%`, background: statusColor(phase.status), transition: "width 0.3s ease" }} /></div>
              <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", minHeight: 36 }}>{progress.detail}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11 }}><span style={{ color: "var(--md-on-surface-variant)" }}>{phase.status.toUpperCase()}</span><span style={{ color: "var(--md-on-surface-variant)" }}>{formatDuration(phase.duration_ms)}</span><span style={{ color: "var(--md-on-surface-variant)" }}>{phase.total_tokens.toLocaleString()} tokens</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8 }}>{progress.stats.map((item) => <MetricPill key={`${phase.phase}-${item.label}`} label={item.label} value={item.value} />)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
