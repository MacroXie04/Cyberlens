import type { AdkTraceSnapshot } from "../types";

import { type VerificationOutcome, isRecord, readNumber, readString } from "../lib/pipelineShared";
import { ArtifactCard, ArtifactRow, EmptyArtifactState } from "./PipelineUi";

interface Props {
  snapshot: AdkTraceSnapshot;
  verificationOutcomes: VerificationOutcome[];
  onSelectEvent: (eventId: number) => void;
}

export default function ArtifactCards({ snapshot, verificationOutcomes, onSelectEvent }: Props) {
  return (
    <div className="adk-pipeline-artifact-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
      <ArtifactCard title={`Dependency Report Batches (${snapshot.artifacts.dependency_report_batches.length})`}>
        {snapshot.artifacts.dependency_report_batches.length === 0 ? <EmptyArtifactState label="No dependency batches captured yet." /> : snapshot.artifacts.dependency_report_batches.map((batch, index) => { const payload = isRecord(batch) ? batch : {}; return <ArtifactRow key={`dep-batch-${index}`} title={readString(payload, "label") || `Batch ${index + 1}`} meta={[`${(readNumber(payload, "vulnerability_count") ?? 0).toLocaleString()} vulns`, `${(readNumber(payload, "security_score") ?? 0).toLocaleString()} score`]}>Repository: {readString(payload, "repository") || "-"}</ArtifactRow>; })}
      </ArtifactCard>

      <ArtifactCard title={`Candidates (${snapshot.artifacts.candidates.length})`}>
        {snapshot.artifacts.candidates.length === 0 ? <EmptyArtifactState label="No candidates generated yet." /> : snapshot.artifacts.candidates.map((candidate) => <ArtifactRow key={candidate.candidate_id} title={`#${candidate.candidate_id} ${candidate.label || candidate.category}`} meta={[`${candidate.score.toFixed(2)} score`, candidate.severity_hint || "severity n/a", candidate.status]}>{candidate.chunk_refs.length} chunks linked. {candidate.rationale || "No rationale"}</ArtifactRow>)}
      </ArtifactCard>

      <ArtifactCard title={`Evidence Packs (${snapshot.artifacts.evidence_packs.length})`}>
        {snapshot.artifacts.evidence_packs.length === 0 ? <EmptyArtifactState label="No evidence packs built yet." /> : snapshot.artifacts.evidence_packs.map((item, index) => { const payload = isRecord(item) ? item : {}; const members = Array.isArray(payload.members) ? payload.members.length : 0; const eventId = readNumber(payload, "event_id"); return <ArtifactRow key={`evidence-${index}`} title={String(payload.evidence_pack_id || payload.label || `Evidence ${index + 1}`)} meta={[`${(readNumber(payload, "candidate_id") ?? 0).toLocaleString()} candidate`, `${members} members`]} onClick={eventId != null ? () => onSelectEvent(eventId) : undefined}>Score {(readNumber(payload, "score") ?? 0).toFixed(2)}</ArtifactRow>; })}
      </ArtifactCard>

      <ArtifactCard title={`Verification Outcomes (${verificationOutcomes.length})`}>
        {verificationOutcomes.length === 0 ? <EmptyArtifactState label="No verification outcomes yet." /> : verificationOutcomes.map((outcome) => <ArtifactRow key={outcome.eventId} title={`#${outcome.candidateId ?? "-"} ${outcome.title || outcome.decision}`} meta={[outcome.filePath ? `${outcome.filePath}:${outcome.lineNumber || "?"}` : "location n/a", outcome.category || "category n/a", outcome.severity || "severity n/a", `seq ${outcome.sequence}`]} tone={outcome.decision === "confirmed" ? "success" : outcome.decision === "rejected" ? "warning" : "default"} onClick={() => onSelectEvent(outcome.eventId)}>{outcome.description || outcome.reason || "No explanation recorded."}</ArtifactRow>)}
      </ArtifactCard>

      <ArtifactCard title={`Verified Findings (${snapshot.artifacts.verified_findings.length})`}>
        {snapshot.artifacts.verified_findings.length === 0 ? <EmptyArtifactState label="No findings confirmed yet." /> : snapshot.artifacts.verified_findings.map((finding) => <ArtifactRow key={finding.finding_id} title={`#${finding.finding_id} ${finding.title}`} meta={[finding.category, finding.severity, `${finding.candidate_ids.length} sources`]} tone="success">{finding.file_path}:{finding.line_number}</ArtifactRow>)}
      </ArtifactCard>
    </div>
  );
}
