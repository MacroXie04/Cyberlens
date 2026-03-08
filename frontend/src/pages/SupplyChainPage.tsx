import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AdkPipelineView from "../components/SupplyChain/AdkPipelineView";
import AgentActivityPanel from "../components/SupplyChain/AgentActivityPanel";
import AgentRequestLog from "../components/SupplyChain/AgentRequestLog";
import AiRemediationReport from "../components/SupplyChain/AiRemediationReport";
import CodeScanLiveView from "../components/SupplyChain/CodeScanLiveView";
import CodeSecurityFindings from "../components/SupplyChain/CodeSecurityFindings";
import DependencyTree from "../components/SupplyChain/DependencyTree";
import ScanProgress from "../components/SupplyChain/ScanProgress";
import VulnerabilityList from "../components/SupplyChain/VulnerabilityList";
import { useSocket } from "../hooks/useSocket";
import { deriveScanProgress, type ScanProgressStep } from "./supplyChainScanProgress";
import {
  getAdkTraceSnapshot,
  getAiReport,
  getCodeFindings,
  getScanResults,
  triggerScan,
} from "../services/api";
import type {
  AdkArtifactSummary,
  AdkTraceEvent,
  AdkTracePhase,
  AdkTracePhaseSummary,
  AdkTraceSnapshot,
  AiReport,
  CodeFinding,
  CodeScanStreamEvent,
  Dependency,
  GitHubScan,
  SelectedProject,
} from "../types";

type ResultTab = "overview" | "vulnerabilities" | "code" | "pipeline";

interface Props {
  selectedProject: SelectedProject;
}

const TRACE_PHASE_LABELS: Record<AdkTracePhase, string> = {
  dependency_input: "Dependency Input",
  dependency_adk_report: "Dependency ADK Report",
  code_inventory: "Code Inventory",
  chunk_summary: "Chunk Summary",
  candidate_generation: "Candidate Generation",
  evidence_expansion: "Evidence Expansion",
  verification: "Verification",
  repo_synthesis: "Repo Synthesis",
};

const TRACE_PHASE_ORDER: AdkTracePhase[] = [
  "dependency_input",
  "dependency_adk_report",
  "code_inventory",
  "chunk_summary",
  "candidate_generation",
  "evidence_expansion",
  "verification",
  "repo_synthesis",
];

const EMPTY_ARTIFACTS: AdkArtifactSummary = {
  candidates: [],
  evidence_packs: [],
  verified_findings: [],
  dependency_report_batches: [],
};

function emptyTraceSnapshot(): AdkTraceSnapshot {
  return {
    phases: TRACE_PHASE_ORDER.map((phase) => ({
      phase,
      status: "pending",
      label: TRACE_PHASE_LABELS[phase],
      started_at: null,
      ended_at: null,
      duration_ms: 0,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      event_count: 0,
      artifact_count: 0,
      error_count: 0,
    })),
    events: [],
    artifacts: EMPTY_ARTIFACTS,
  };
}

function buildTracePhases(events: AdkTraceEvent[]): AdkTracePhaseSummary[] {
  return TRACE_PHASE_ORDER.map((phase) => {
    const phaseEvents = events.filter((event) => event.phase === phase);
    const started = phaseEvents.find((event) => event.kind === "stage_started");
    const completed = [...phaseEvents]
      .reverse()
      .find((event) => event.kind === "stage_completed");

    let status: AdkTracePhaseSummary["status"] = "pending";
    if (phaseEvents.some((event) => event.kind === "error" || event.status === "error")) {
      status = "error";
    } else if (phaseEvents.some((event) => event.kind === "warning" || event.status === "warning")) {
      status = "warning";
    } else if (completed) {
      status = completed.status as AdkTracePhaseSummary["status"];
    } else if (phaseEvents.length > 0) {
      status = "running";
    }

    return {
      phase,
      status,
      label: TRACE_PHASE_LABELS[phase],
      started_at: started?.started_at || started?.created_at || null,
      ended_at:
        completed?.ended_at ||
        completed?.created_at ||
        (status === "warning" ? phaseEvents[phaseEvents.length - 1]?.created_at || null : null),
      duration_ms: completed?.duration_ms || 0,
      input_tokens:
        completed?.input_tokens ||
        phaseEvents
          .filter((event) => event.kind === "llm_completed" || event.kind === "metric")
          .reduce((sum, event) => sum + event.input_tokens, 0),
      output_tokens:
        completed?.output_tokens ||
        phaseEvents
          .filter((event) => event.kind === "llm_completed" || event.kind === "metric")
          .reduce((sum, event) => sum + event.output_tokens, 0),
      total_tokens:
        completed?.total_tokens ||
        phaseEvents
          .filter((event) => event.kind === "llm_completed" || event.kind === "metric")
          .reduce((sum, event) => sum + event.total_tokens, 0),
      event_count: phaseEvents.length,
      artifact_count: phaseEvents.filter((event) => event.kind === "artifact_created").length,
      error_count: phaseEvents.filter((event) => event.kind === "error").length,
    };
  });
}

function mergeArtifactSummary(
  previous: AdkArtifactSummary,
  event: AdkTraceEvent
): AdkArtifactSummary {
  if (event.kind !== "artifact_created" || Array.isArray(event.payload_json)) {
    return previous;
  }

  const payload = event.payload_json as Record<string, unknown>;

  if (event.phase === "candidate_generation" && typeof payload.candidate_id === "number") {
    const candidate = {
      candidate_id: payload.candidate_id,
      category: String(payload.category || ""),
      label: String(payload.label || ""),
      score: Number(payload.score || 0),
      severity_hint: String(payload.severity_hint || ""),
      status: String(payload.status || "candidate"),
      chunk_refs: Array.isArray(payload.chunk_refs)
        ? payload.chunk_refs.map((ref) => String(ref))
        : [],
      rationale: String(payload.rationale || ""),
      verified_finding_id:
        typeof payload.verified_finding_id === "number"
          ? payload.verified_finding_id
          : null,
    };
    return {
      ...previous,
      candidates: [
        ...previous.candidates.filter((item) => item.candidate_id !== candidate.candidate_id),
        candidate,
      ].sort((a, b) => b.score - a.score),
    };
  }

  if (event.phase === "evidence_expansion" && payload.evidence_pack_id) {
    const evidencePack = {
      event_id: event.id,
      sequence: event.sequence,
      label: event.label,
      ...payload,
    };
    const evidenceId = String(payload.evidence_pack_id);
    return {
      ...previous,
      evidence_packs: [
        ...previous.evidence_packs.filter(
          (item) => String(item.evidence_pack_id || "") !== evidenceId
        ),
        evidencePack,
      ],
    };
  }

  if (
    event.phase === "verification" &&
    payload.decision === "confirmed" &&
    typeof payload.finding_ref === "number"
  ) {
    const finding = {
      finding_id: payload.finding_ref,
      title: event.label,
      category: String(payload.category || ""),
      severity: String(payload.severity || ""),
      file_path: String(payload.file_path || ""),
      line_number: Number(payload.line_number || 0),
      candidate_ids:
        typeof payload.candidate_id === "number" ? [payload.candidate_id as number] : [],
    };
    return {
      ...previous,
      verified_findings: [
        ...previous.verified_findings.filter((item) => item.finding_id !== finding.finding_id),
        finding,
      ],
    };
  }

  if (
    (event.phase === "dependency_input" || event.phase === "dependency_adk_report") &&
    typeof payload.batch_index === "number"
  ) {
    const batch = {
      event_id: event.id,
      sequence: event.sequence,
      label: event.label,
      ...payload,
    };
    const batchIndex = Number(payload.batch_index);
    return {
      ...previous,
      dependency_report_batches: [
        ...previous.dependency_report_batches.filter(
          (item) => Number(item.batch_index || 0) !== batchIndex
        ),
        batch,
      ],
    };
  }

  return previous;
}

function mergeTraceEvent(previous: AdkTraceSnapshot | null, event: AdkTraceEvent): AdkTraceSnapshot {
  const base = previous || emptyTraceSnapshot();
  if (base.events.some((item) => item.sequence === event.sequence)) {
    return base;
  }

  const events = [...base.events, event].sort((left, right) => left.sequence - right.sequence);
  return {
    phases: buildTracePhases(events),
    events,
    artifacts: mergeArtifactSummary(base.artifacts, event),
  };
}

function scanStorageKey(repoFullName: string): string {
  return `scan:${repoFullName}`;
}

export default function SupplyChainPage({ selectedProject }: Props) {
  const [scan, setScan] = useState<GitHubScan | null>(null);
  const [report, setReport] = useState<AiReport | null>(null);
  const [codeFindings, setCodeFindings] = useState<CodeFinding[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [scanStep, setScanStep] = useState<ScanProgressStep>("");
  const [resultTab, setResultTab] = useState<ResultTab>("overview");
  const [adkTrace, setAdkTrace] = useState<AdkTraceSnapshot | null>(null);
  const [adkTraceLoading, setAdkTraceLoading] = useState(false);

  const scanIdRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastProjectKeyRef = useRef<string | null>(null);
  const lastRealtimeEventAtRef = useRef(0);

  const [codeScanStreamEvents, setCodeScanStreamEvents] = useState<CodeScanStreamEvent[]>([]);
  const [codeScanActive, setCodeScanActive] = useState(false);
  const [_codeScanSummary, setCodeScanSummary] = useState<CodeScanStreamEvent | null>(null);

  const repoFullName = selectedProject?.repo.full_name || null;

  const refreshLiveArtifacts = useCallback(async (scanId: number) => {
    const [aiReportResult, findingsResult] = await Promise.allSettled([
      getAiReport(scanId),
      getCodeFindings(scanId),
    ]);

    if (aiReportResult.status === "fulfilled") {
      setReport(aiReportResult.value);
    }
    if (findingsResult.status === "fulfilled") {
      setCodeFindings(findingsResult.value);
    }
  }, []);

  const loadAdkTrace = useCallback(async (scanId: number) => {
    setAdkTraceLoading(true);
    try {
      const snapshot = await getAdkTraceSnapshot(scanId);
      setAdkTrace(snapshot);
    } catch (err) {
      console.error("Failed to fetch ADK trace:", err);
      setAdkTrace((current) => current || emptyTraceSnapshot());
    } finally {
      setAdkTraceLoading(false);
    }
  }, []);

  const fetchScanResults = useCallback(
    async (scanId: number) => {
      setScanning(false);
      setCodeScanActive(false);
      try {
        const results = await getScanResults(scanId);
        setScan(results);

        if (results.scan_status === "failed") {
          setScanStep("failed");
          setScanMessage(results.error_message || "Scan failed");
          return;
        }

        setScanMessage("");
        setScanStep("completed");

        const [aiReportResult, findingsResult, traceResult] = await Promise.allSettled([
          getAiReport(scanId),
          getCodeFindings(scanId),
          getAdkTraceSnapshot(scanId),
        ]);

        setReport(aiReportResult.status === "fulfilled" ? aiReportResult.value : null);
        setCodeFindings(findingsResult.status === "fulfilled" ? findingsResult.value : []);
        if (traceResult.status === "fulfilled") {
          setAdkTrace(traceResult.value);
        }
      } catch (err) {
        console.error("Failed to fetch results:", err);
      }
    },
    []
  );

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const resetScanState = useCallback(() => {
    stopPolling();
    scanIdRef.current = null;
    lastRealtimeEventAtRef.current = 0;
    setScan(null);
    setReport(null);
    setCodeFindings([]);
    setScanning(false);
    setScanMessage("");
    setScanStep("");
    setResultTab("overview");
    setAdkTrace(null);
    setAdkTraceLoading(false);
    setCodeScanStreamEvents([]);
    setCodeScanActive(false);
    setCodeScanSummary(null);
  }, [stopPolling]);

  const startPolling = useCallback(
    (scanId: number) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const result = await getScanResults(scanId);
          setScan(result);
          void refreshLiveArtifacts(scanId);
          if (
            result.scan_status === "scanning" &&
            Date.now() - lastRealtimeEventAtRef.current > 10000
          ) {
            const derived = deriveScanProgress(result);
            setScanStep(derived.step);
            setScanMessage(derived.message);
            if (derived.codeScanActive) {
              setCodeScanActive(true);
            }
          }
          if (result.scan_status === "completed" || result.scan_status === "failed") {
            stopPolling();
            if (result.scan_status === "completed") {
              await fetchScanResults(scanId);
            } else {
              setScanning(false);
              setScanMessage("Scan failed");
              setScanStep("failed");
              setCodeScanActive(false);
            }
          }
        } catch {
          // Polling will retry on next interval
        }
      }, 3000);
    },
    [fetchScanResults, refreshLiveArtifacts, stopPolling]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  const runScan = useCallback(async () => {
    if (!selectedProject) return;
    lastRealtimeEventAtRef.current = 0;
    setScanning(true);
    setScanMessage("Starting scan...");
    setScanStep("starting");
    setScan(null);
    setReport(null);
    setCodeFindings([]);
    setCodeScanStreamEvents([]);
    setCodeScanActive(false);
    setCodeScanSummary(null);
    setAdkTrace(emptyTraceSnapshot());
    setResultTab("pipeline");

    try {
      const result = await triggerScan(selectedProject.repo.full_name);
      setScan(result);
      scanIdRef.current = result.id;
      sessionStorage.setItem(scanStorageKey(selectedProject.repo.full_name), String(result.id));
      void loadAdkTrace(result.id);
      startPolling(result.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      setScanMessage(msg);
      setScanStep("failed");
      setScanning(false);
    }
  }, [loadAdkTrace, selectedProject, startPolling]);

  useEffect(() => {
    const key = repoFullName;
    if (key && key !== lastProjectKeyRef.current) {
      lastProjectKeyRef.current = key;
      resetScanState();
    } else if (!key) {
      lastProjectKeyRef.current = null;
      resetScanState();
    }
  }, [repoFullName, resetScanState]);

  const onScanProgress = useCallback((data: { scan_id: number; step: string; message: string }) => {
    if (scanIdRef.current && data.scan_id === scanIdRef.current) {
      lastRealtimeEventAtRef.current = Date.now();
      setScanMessage(data.message);
      setScanStep(data.step as ScanProgressStep);
    }
  }, []);

  const onScanComplete = useCallback(
    async (data: { scan_id: number }) => {
      if (scanIdRef.current && data.scan_id === scanIdRef.current) {
        lastRealtimeEventAtRef.current = Date.now();
        stopPolling();
        await fetchScanResults(data.scan_id);
      }
    },
    [fetchScanResults, stopPolling]
  );

  const onCodeScanStream = useCallback((data: CodeScanStreamEvent) => {
    if (scanIdRef.current && data.scan_id === scanIdRef.current) {
      lastRealtimeEventAtRef.current = Date.now();
      if (data.type === "scan_start") {
        setCodeScanActive(true);
        setCodeScanStreamEvents([data]);
      } else if (data.type === "scan_summary") {
        setCodeScanSummary(data);
        setCodeScanStreamEvents((prev) => [...prev, data]);
        if (data.message) {
          setScanMessage(data.message);
        }
      } else {
        setCodeScanStreamEvents((prev) => [...prev, data]);
      }

      if (data.type === "file_start" && data.file_path) {
        const fileName = data.file_path.split("/").pop() || data.file_path;
        const detail =
          data.total_files != null && data.file_index != null
            ? `Analyzing ${fileName} (${data.file_index + 1}/${data.total_files})`
            : `Analyzing ${fileName}`;
        setScanMessage(detail);
        setScanStep("code_scan");
      } else if (data.type === "warning") {
        setScanMessage(data.message || data.error || "Code scan warning");
      }
    }
  }, []);

  const onAdkTraceStream = useCallback((data: AdkTraceEvent) => {
    if (scanIdRef.current && data.scan_id === scanIdRef.current) {
      lastRealtimeEventAtRef.current = Date.now();
      setAdkTrace((prev) => mergeTraceEvent(prev, data));
      if (data.kind === "stage_started") {
        if (
          data.phase === "chunk_summary" ||
          data.phase === "candidate_generation" ||
          data.phase === "evidence_expansion" ||
          data.phase === "verification" ||
          data.phase === "repo_synthesis"
        ) {
          setScanStep("code_scan");
        } else if (data.phase === "dependency_input" || data.phase === "dependency_adk_report") {
          setScanStep("analyzing");
        }
        setScanMessage(data.label || TRACE_PHASE_LABELS[data.phase]);
      } else if (data.kind === "warning" || data.kind === "error") {
        setScanMessage(data.text_preview || data.label || TRACE_PHASE_LABELS[data.phase]);
      }
    }
  }, []);

  useSocket({ onScanProgress, onScanComplete, onCodeScanStream, onAdkTraceStream });

  const codeAgentRequests = useMemo(() => {
    if (!adkTrace?.events) return [];
    const phases = new Set(["chunk_summary", "candidate_generation", "evidence_expansion", "verification", "repo_synthesis"]);
    return adkTrace.events.filter(e => phases.has(e.phase) && e.kind === "llm_completed");
  }, [adkTrace]);

  // Derive token/activity state for AgentActivityPanel from existing data
  const panelTokens = useMemo(() => {
    // Use latest token_update or scan_summary event from code scan stream
    for (let i = codeScanStreamEvents.length - 1; i >= 0; i--) {
      const evt = codeScanStreamEvents[i];
      if (evt.type === "scan_summary" || evt.type === "token_update") {
        return {
          input: evt.input_tokens ?? 0,
          output: evt.output_tokens ?? 0,
          total: evt.total_tokens ?? 0,
        };
      }
    }
    return { input: 0, output: 0, total: 0 };
  }, [codeScanStreamEvents]);

  const panelFilesInfo = useMemo(() => {
    let filesScanned = 0;
    let totalFiles = 0;
    for (let i = codeScanStreamEvents.length - 1; i >= 0; i--) {
      const evt = codeScanStreamEvents[i];
      if (evt.files_scanned != null) {
        filesScanned = evt.files_scanned;
        totalFiles = evt.total_files ?? totalFiles;
        break;
      }
      if (evt.type === "scan_start" && evt.total_files != null) {
        totalFiles = evt.total_files;
      }
    }
    return { filesScanned, totalFiles };
  }, [codeScanStreamEvents]);

  const panelActivity = useMemo(() => {
    // Prefer latest ADK trace event label for richer context
    if (adkTrace?.events.length) {
      const latest = adkTrace.events[adkTrace.events.length - 1];
      if (latest.label) return latest.label;
    }
    // Fall back to the current scan message
    return scanMessage || "Waiting for agent activity...";
  }, [adkTrace, scanMessage]);

  const panelWarning = useMemo(() => {
    for (let i = codeScanStreamEvents.length - 1; i >= 0; i--) {
      const evt = codeScanStreamEvents[i];
      if (evt.type === "warning") return evt.message || evt.error || "";
    }
    return "";
  }, [codeScanStreamEvents]);

  const dependencies: Dependency[] = scan?.dependencies || [];
  const liveCodeFindings = codeFindings.length > 0 ? codeFindings : scan?.code_findings || [];
  const vulnerableDeps = dependencies.filter((dependency) => dependency.is_vulnerable);
  const totalVulns = vulnerableDeps.reduce(
    (sum, dependency) => sum + (dependency.vulnerabilities?.length || 0),
    0
  );
  const isCompleted = scan?.scan_status === "completed";
  const hasPipeline = Boolean(adkTrace?.events.length || scanning);
  const isIdle = Boolean(selectedProject && !scan && !scanning && !hasPipeline);
  const scoreColor =
    (scan?.security_score ?? 0) >= 80
      ? "var(--md-safe)"
      : (scan?.security_score ?? 0) >= 50
        ? "var(--md-warning)"
        : "var(--md-error)";

  if (!selectedProject) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "calc(100vh - 80px)",
          gap: 16,
          color: "var(--md-on-surface-variant)",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: "var(--md-surface-container-high)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            color: "var(--md-outline)",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
          </svg>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: "var(--md-on-surface)", marginBottom: 4 }}>
            No project selected
          </div>
          <div style={{ fontSize: 14 }}>
            Connect GitHub in <strong>Settings</strong> and select a repository to scan.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "var(--md-on-surface)",
                margin: 0,
              }}
            >
              {selectedProject.repo.name}
            </h2>
            {scan?.scan_status && (
              <span
                style={{
                  fontSize: 11,
                  padding: "3px 10px",
                  borderRadius: 12,
                  fontWeight: 500,
                  background:
                    scan.scan_status === "completed"
                      ? "rgba(46, 125, 50, 0.1)"
                      : scan.scan_status === "failed"
                        ? "rgba(198, 40, 40, 0.1)"
                        : "rgba(0, 131, 143, 0.1)",
                  color:
                    scan.scan_status === "completed"
                      ? "var(--md-safe)"
                      : scan.scan_status === "failed"
                        ? "var(--md-error)"
                        : "var(--md-primary)",
                }}
              >
                {scan.scan_status === "completed"
                  ? "Completed"
                  : scan.scan_status === "failed"
                    ? "Failed"
                    : "Scanning"}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--md-on-surface-variant)",
              marginTop: 2,
              fontFamily: "var(--md-font-mono)",
            }}
          >
            {selectedProject.repo.full_name}
          </div>
        </div>
        <button
          onClick={() => void runScan()}
          disabled={scanning}
          style={{
            padding: "10px 24px",
            borderRadius: "var(--md-radius-button)",
            border: "none",
            background: scanning ? "var(--md-surface-container-high)" : "var(--md-primary)",
            color: scanning ? "var(--md-on-surface-variant)" : "var(--md-on-primary)",
            fontWeight: 600,
            fontSize: 13,
            cursor: scanning ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.2s ease",
          }}
        >
          {scanning && (
            <div
              style={{
                width: 14,
                height: 14,
                border: "2px solid currentColor",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
          )}
          {scanning ? "Scanning..." : "Scan"}
        </button>
      </div>

      {isCompleted && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <StatCard
            label="Security Score"
            value={scan?.security_score ?? 0}
            suffix="/100"
            detail={`Deps: ${scan?.dependency_score ?? 0} | Code: ${scan?.code_security_score ?? 0}`}
            color={scoreColor}
          />
          <StatCard
            label="Dependencies"
            value={scan?.total_deps ?? 0}
            detail={`${scan?.vulnerable_deps ?? 0} vulnerable`}
            color={(scan?.vulnerable_deps ?? 0) > 0 ? "var(--md-error)" : "var(--md-safe)"}
          />
          <StatCard
            label="Vulnerabilities"
            value={totalVulns}
            color={totalVulns > 0 ? "var(--md-error)" : "var(--md-safe)"}
          />
          <StatCard
            label="Code Issues"
            value={codeFindings.length}
            detail={
              codeFindings.filter((finding) => finding.severity === "critical").length > 0
                ? `${codeFindings.filter((finding) => finding.severity === "critical").length} critical`
                : undefined
            }
            color={
              codeFindings.filter(
                (finding) => finding.severity === "critical" || finding.severity === "high"
              ).length > 0
                ? "var(--md-error)"
                : codeFindings.length > 0
                  ? "var(--md-warning)"
                  : "var(--md-safe)"
            }
          />
        </div>
      )}

      {scanning && <ScanProgress currentStep={scanStep} message={scanMessage} />}

      {scanning && adkTrace && (
        <AgentActivityPanel
          adkTrace={adkTrace}
          tokens={panelTokens}
          filesScanned={panelFilesInfo.filesScanned}
          totalFiles={panelFilesInfo.totalFiles}
          currentActivity={panelActivity}
          warningMessage={panelWarning || undefined}
        />
      )}

      {codeScanActive && <CodeScanLiveView streamEvents={codeScanStreamEvents} agentRequests={codeAgentRequests} />}

      {isIdle && (
        <div
          className="card"
          style={{
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            border: "1px dashed var(--md-outline-variant)",
            background: "var(--md-surface-container)",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--md-on-surface)" }}>
            Scan is idle
          </div>
          <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", lineHeight: 1.6 }}>
            Selecting a repository or opening the Code Scan page will not start a scan automatically.
            Click the <strong>Scan</strong> button when you want to run one.
          </div>
        </div>
      )}

      {!scanning && scanStep === "failed" && (
        <div
          className="card"
          style={{
            padding: 20,
            borderLeft: "4px solid var(--md-error)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--md-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--md-error)" }}>
              Scan failed
            </div>
            <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", marginTop: 2, wordBreak: "break-word" }}>
              {scan?.error_message || scanMessage || "Something went wrong. Try scanning again."}
            </div>
          </div>
        </div>
      )}

      {(scan || hasPipeline) && (
        <>
          <div
            style={{
              display: "flex",
              gap: 0,
              borderBottom: "1px solid var(--md-outline-variant)",
              flexWrap: "wrap",
            }}
          >
            <TabButton
              active={resultTab === "overview"}
              onClick={() => setResultTab("overview")}
              label="Overview"
              count={dependencies.length}
            />
            <TabButton
              active={resultTab === "vulnerabilities"}
              onClick={() => setResultTab("vulnerabilities")}
              label="Vulnerabilities"
              count={totalVulns}
              alert={totalVulns > 0}
            />
            <TabButton
              active={resultTab === "code"}
              onClick={() => setResultTab("code")}
              label="Code Security"
              count={liveCodeFindings.length}
              alert={liveCodeFindings.some(
                (finding) => finding.severity === "critical" || finding.severity === "high"
              )}
            />
            <TabButton
              active={resultTab === "pipeline"}
              onClick={() => setResultTab("pipeline")}
              label="ADK Pipeline"
              count={adkTrace?.events.length || 0}
              alert={adkTrace?.phases.some((phase) => phase.status === "error")}
            />
          </div>

          <div style={{ minHeight: 400 }}>
            {resultTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {scanning && dependencies.length === 0 && (
                  <InlineScanNotice message="Dependency inventory is still being collected for the overview." />
                )}
                <DependencyTree dependencies={dependencies} />
                {report && <AiRemediationReport report={report} />}
                {scanning && !report && (
                  <InlineScanNotice message="AI remediation report will appear here as soon as dependency analysis finishes." />
                )}
              </div>
            )}

            {resultTab === "vulnerabilities" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {scanning && dependencies.length === 0 && (
                  <InlineScanNotice message="Vulnerability results are still loading from dependency analysis." />
                )}
                <VulnerabilityList dependencies={dependencies} />
                {report && <AiRemediationReport report={report} />}
              </div>
            )}

            {resultTab === "code" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {scan && (scan.code_scan_total_tokens > 0 || scanning) && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 20,
                      padding: "12px 16px",
                      background: "var(--md-surface-container)",
                      borderRadius: "var(--md-radius-button)",
                      fontSize: 12,
                      color: "var(--md-on-surface-variant)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontWeight: 500, color: "var(--md-on-surface)" }}>
                      Scan Metrics
                    </span>
                    <span>
                      Files:{" "}
                      <strong style={{ color: "var(--md-on-surface)" }}>
                        {scan.code_scan_files_scanned}/{scan.code_scan_files_total}
                      </strong>
                    </span>
                    <div style={{ width: 1, height: 16, background: "var(--md-outline-variant)" }} />
                    <span>
                      Tokens:{" "}
                      <strong style={{ color: "var(--md-on-surface)" }}>
                        {scan.code_scan_input_tokens.toLocaleString()}
                      </strong>{" "}
                      in
                    </span>
                    <span>
                      <strong style={{ color: "var(--md-on-surface)" }}>
                        {scan.code_scan_output_tokens.toLocaleString()}
                      </strong>{" "}
                      out
                    </span>
                    <span>
                      <strong style={{ color: "var(--md-primary)" }}>
                        {scan.code_scan_total_tokens.toLocaleString()}
                      </strong>{" "}
                      total
                    </span>
                  </div>
                )}
                <AgentRequestLog events={codeAgentRequests} loading={scanning} />
                {scanning && liveCodeFindings.length === 0 && (
                  <InlineScanNotice message="Code findings will stream in here while verification completes." />
                )}
                <CodeSecurityFindings findings={liveCodeFindings} />
              </div>
            )}

            {resultTab === "pipeline" && (
              <AdkPipelineView
                snapshot={adkTrace}
                loading={adkTraceLoading || scanning}
                scan={scan}
                codeScanStreamEvents={codeScanStreamEvents}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  detail,
  color,
}: {
  label: string;
  value: number;
  suffix?: string;
  detail?: string;
  color: string;
}) {
  return (
    <div
      className="card"
      style={{
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span
          style={{
            fontSize: 28,
            fontWeight: 700,
            fontFamily: "var(--md-font-mono)",
            color,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        {suffix && <span style={{ fontSize: 13, color: "var(--md-on-surface-variant)" }}>{suffix}</span>}
      </div>
      {detail && <div style={{ fontSize: 12, color, marginTop: 2 }}>{detail}</div>}
    </div>
  );
}

function InlineScanNotice({ message }: { message: string }) {
  return (
    <div
      className="card"
      style={{
        padding: 14,
        background: "var(--md-surface-container)",
        color: "var(--md-on-surface-variant)",
        fontSize: 13,
      }}
    >
      {message}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  alert,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  alert?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "12px 20px",
        border: "none",
        borderBottom: active ? "2px solid var(--md-primary)" : "2px solid transparent",
        background: "transparent",
        color: active ? "var(--md-primary)" : "var(--md-on-surface-variant)",
        fontWeight: active ? 600 : 400,
        fontSize: 14,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
        transition: "all 0.15s ease",
        fontFamily: "var(--md-font-body)",
      }}
    >
      {label}
      {count != null && (
        <span
          style={{
            fontSize: 11,
            padding: "2px 7px",
            borderRadius: 10,
            fontWeight: 600,
            background: alert
              ? "var(--md-error)"
              : active
                ? "var(--md-primary)"
                : "var(--md-surface-container-highest)",
            color: alert || active ? "#fff" : "var(--md-on-surface-variant)",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
