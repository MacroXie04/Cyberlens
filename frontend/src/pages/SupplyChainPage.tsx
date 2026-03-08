import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import AdkPipelineView from "../components/SupplyChain/AdkPipelineView";
import AgentActivityPanel from "../components/SupplyChain/AgentActivityPanel";
import AgentRequestLog from "../components/SupplyChain/AgentRequestLog";
import AiRemediationReport from "../components/SupplyChain/AiRemediationReport";
import CodeScanLiveView from "../components/SupplyChain/CodeScanLiveView";
import CodeSecurityFindings from "../components/SupplyChain/CodeSecurityFindings";
import DependencyInventory from "../components/SupplyChain/DependencyInventory";
import DependencyList from "../components/SupplyChain/DependencyList";
import DependencyTree from "../components/SupplyChain/DependencyTree";
import ScanProgress from "../components/SupplyChain/ScanProgress";
import VulnerabilityList from "../components/SupplyChain/VulnerabilityList";
import { deriveAgentActivity } from "../components/SupplyChain/activity";
import { useSocket } from "../hooks/useSocket";
import {
  getAdkTraceSnapshot,
  getAiReport,
  getCodeFindings,
  getScanHistory,
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
  GitHubScanHistoryItem,
  ScanMode,
  SelectedProject,
} from "../types";
import { deriveScanProgress, type ScanProgressStep } from "./supplyChainScanProgress";

type ResultTab = "overview" | "dependencies" | "vulnerabilities" | "code" | "pipeline";

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

function upsertHistoryItem(
  previous: GitHubScanHistoryItem[],
  nextItem: GitHubScanHistoryItem
): GitHubScanHistoryItem[] {
  return [...previous.filter((item) => item.id !== nextItem.id), nextItem].sort(
    (left, right) => new Date(right.scanned_at).getTime() - new Date(left.scanned_at).getTime()
  );
}

function scanToHistoryItem(scan: GitHubScan): GitHubScanHistoryItem {
  return {
    id: scan.id,
    repo_name: scan.repo_name,
    repo_url: scan.repo_url,
    scan_source: scan.scan_source,
    scan_mode: scan.scan_mode,
    scan_status: scan.scan_status,
    total_deps: scan.total_deps,
    vulnerable_deps: scan.vulnerable_deps,
    security_score: scan.security_score,
    dependency_score: scan.dependency_score,
    code_security_score: scan.code_security_score,
    code_findings_count:
      scan.code_findings_count ?? scan.code_findings?.length ?? 0,
    code_scan_phase: scan.code_scan_phase,
    scanned_at: scan.scanned_at,
    started_at: scan.started_at,
    completed_at: scan.completed_at ?? null,
    duration_ms: scan.duration_ms,
    error_message: scan.error_message,
  };
}

function formatTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatDuration(durationMs?: number): string {
  if (!durationMs) return "-";
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function severityCounts(dependencies: Dependency[], findings: CodeFinding[]) {
  const vulnerabilityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const dependency of dependencies) {
    for (const vulnerability of dependency.vulnerabilities || []) {
      const severity = vulnerability.severity as keyof typeof vulnerabilityCounts;
      if (severity in vulnerabilityCounts) {
        vulnerabilityCounts[severity] += 1;
      }
    }
  }

  const codeCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of findings) {
    const severity = finding.severity as keyof typeof codeCounts;
    if (severity in codeCounts) {
      codeCounts[severity] += 1;
    }
  }

  return { vulnerabilityCounts, codeCounts };
}

function statusTone(status: GitHubScanHistoryItem["scan_status"] | GitHubScan["scan_status"] | undefined) {
  if (status === "completed") {
    return { background: "rgba(46, 125, 50, 0.1)", color: "var(--md-safe)", label: "Completed" };
  }
  if (status === "failed") {
    return { background: "rgba(198, 40, 40, 0.1)", color: "var(--md-error)", label: "Failed" };
  }
  if (status === "scanning") {
    return { background: "rgba(2, 119, 189, 0.1)", color: "var(--md-primary)", label: "Scanning" };
  }
  return { background: "var(--md-surface-container-high)", color: "var(--md-on-surface-variant)", label: "Pending" };
}

export default function SupplyChainPage({ selectedProject }: Props) {
  const [scanHistory, setScanHistory] = useState<GitHubScanHistoryItem[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<number | null>(null);
  const [selectedScan, setSelectedScan] = useState<GitHubScan | null>(null);
  const [report, setReport] = useState<AiReport | null>(null);
  const [codeFindings, setCodeFindings] = useState<CodeFinding[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [scanStep, setScanStep] = useState<ScanProgressStep>("");
  const [resultTab, setResultTab] = useState<ResultTab>("overview");
  const [adkTrace, setAdkTrace] = useState<AdkTraceSnapshot | null>(null);
  const [adkTraceLoading, setAdkTraceLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [codeScanStreamEvents, setCodeScanStreamEvents] = useState<CodeScanStreamEvent[]>([]);
  const [codeScanActive, setCodeScanActive] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedScanIdRef = useRef<number | null>(null);
  const lastProjectKeyRef = useRef<string | null>(null);
  const lastRealtimeEventAtRef = useRef(0);

  const repoFullName = selectedProject?.repo.full_name || null;

  useEffect(() => {
    selectedScanIdRef.current = selectedScanId;
  }, [selectedScanId]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const resetPageState = useCallback(() => {
    stopPolling();
    selectedScanIdRef.current = null;
    lastRealtimeEventAtRef.current = 0;
    setScanHistory([]);
    setSelectedScanId(null);
    setSelectedScan(null);
    setReport(null);
    setCodeFindings([]);
    setScanning(false);
    setScanMessage("");
    setScanStep("");
    setResultTab("overview");
    setAdkTrace(null);
    setAdkTraceLoading(false);
    setHistoryLoading(false);
    setDetailLoading(false);
    setCodeScanStreamEvents([]);
    setCodeScanActive(false);
  }, [stopPolling]);

  const applyHistoryItem = useCallback((item: GitHubScanHistoryItem) => {
    setScanHistory((previous) => upsertHistoryItem(previous, item));
  }, []);

  const loadScanData = useCallback(
    async (scanId: number) => {
      setDetailLoading(true);
      setAdkTraceLoading(true);

      const [scanResult, aiReportResult, findingsResult, traceResult] = await Promise.allSettled([
        getScanResults(scanId),
        getAiReport(scanId),
        getCodeFindings(scanId),
        getAdkTraceSnapshot(scanId),
      ]);

      if (selectedScanIdRef.current !== scanId) {
        setDetailLoading(false);
        setAdkTraceLoading(false);
        return;
      }

      if (scanResult.status === "fulfilled") {
        const nextScan = scanResult.value;
        setSelectedScan(nextScan);
        applyHistoryItem(scanToHistoryItem(nextScan));
        setScanning(nextScan.scan_status === "scanning");
        if (nextScan.scan_status === "failed") {
          setScanStep("failed");
          setScanMessage(nextScan.error_message || "Scan failed");
        } else if (nextScan.scan_status === "scanning") {
          const derived = deriveScanProgress(nextScan);
          setScanStep(derived.step);
          setScanMessage(derived.message);
          if (derived.codeScanActive) {
            setCodeScanActive(true);
          }
        } else {
          setScanMessage("");
          setScanStep("completed");
          setCodeScanActive(false);
        }
      }

      setReport(aiReportResult.status === "fulfilled" ? aiReportResult.value || null : null);
      setCodeFindings(
        findingsResult.status === "fulfilled" && Array.isArray(findingsResult.value)
          ? findingsResult.value
          : []
      );
      setAdkTrace(
        traceResult.status === "fulfilled" ? traceResult.value : emptyTraceSnapshot()
      );

      setDetailLoading(false);
      setAdkTraceLoading(false);
    },
    [applyHistoryItem]
  );

  const startPolling = useCallback(
    (scanId: number) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const result = await getScanResults(scanId);
          applyHistoryItem(scanToHistoryItem(result));

          if (selectedScanIdRef.current !== scanId) {
            return;
          }

          setSelectedScan(result);
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
            await loadScanData(scanId);
          }
        } catch {
          // Polling will retry on the next interval.
        }
      }, 3000);
    },
    [applyHistoryItem, loadScanData, stopPolling]
  );

  const loadHistoryForRepo = useCallback(
    async (repo: string) => {
      setHistoryLoading(true);
      try {
        const history = await getScanHistory(repo);
        if (lastProjectKeyRef.current !== repo) {
          return;
        }
        setScanHistory(history);

        if (history.length === 0) {
          setHistoryLoading(false);
          return;
        }

        const latest = history[0];
        selectedScanIdRef.current = latest.id;
        setSelectedScanId(latest.id);
        setScanning(latest.scan_status === "scanning");
        if (latest.scan_status === "scanning") {
          startPolling(latest.id);
        } else {
          stopPolling();
        }
        await loadScanData(latest.id);
      } finally {
        setHistoryLoading(false);
      }
    },
    [loadScanData, startPolling, stopPolling]
  );

  useEffect(() => {
    if (repoFullName && repoFullName !== lastProjectKeyRef.current) {
      lastProjectKeyRef.current = repoFullName;
      resetPageState();
      void loadHistoryForRepo(repoFullName);
      return;
    }

    if (!repoFullName) {
      lastProjectKeyRef.current = null;
      resetPageState();
    }
  }, [loadHistoryForRepo, repoFullName, resetPageState]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const selectHistoryItem = useCallback(
    async (item: GitHubScanHistoryItem) => {
      selectedScanIdRef.current = item.id;
      setSelectedScanId(item.id);
      setSelectedScan(null);
      setReport(null);
      setCodeFindings([]);
      setAdkTrace(null);
      setCodeScanStreamEvents([]);
      setCodeScanActive(false);
      setScanning(item.scan_status === "scanning");
      if (item.scan_status === "scanning") {
        startPolling(item.id);
      } else {
        stopPolling();
      }
      await loadScanData(item.id);
    },
    [loadScanData, startPolling, stopPolling]
  );

  const runScan = useCallback(
    async (scanMode: ScanMode) => {
      if (!repoFullName) return;
      lastRealtimeEventAtRef.current = 0;
      setScanning(true);
      setScanMessage(
        scanMode === "fast"
          ? "Starting Fast Scan..."
          : "Starting Full Scan..."
      );
      setScanStep("starting");
      setReport(null);
      setCodeFindings([]);
      setCodeScanStreamEvents([]);
      setCodeScanActive(false);
      setAdkTrace(emptyTraceSnapshot());
      setResultTab("pipeline");

      try {
        const created = await triggerScan(repoFullName, scanMode);
        const historyItem = scanToHistoryItem(created);
        applyHistoryItem(historyItem);
        selectedScanIdRef.current = created.id;
        setSelectedScanId(created.id);
        setSelectedScan(created);
        setScanning(true);
        startPolling(created.id);
        await loadScanData(created.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Scan failed";
        setScanning(false);
        setScanStep("failed");
        setScanMessage(message);
      }
    },
    [applyHistoryItem, loadScanData, repoFullName, startPolling]
  );

  const onScanProgress = useCallback((data: { scan_id: number; step: string; message: string }) => {
    if (selectedScanIdRef.current === data.scan_id) {
      lastRealtimeEventAtRef.current = Date.now();
      setScanMessage(data.message);
      setScanStep(data.step as ScanProgressStep);
    }
  }, []);

  const onScanComplete = useCallback(
    async (data: { scan_id: number }) => {
      if (selectedScanIdRef.current === data.scan_id) {
        lastRealtimeEventAtRef.current = Date.now();
        stopPolling();
        await loadScanData(data.scan_id);
      }
    },
    [loadScanData, stopPolling]
  );

  const onCodeScanStream = useCallback((data: CodeScanStreamEvent) => {
    if (selectedScanIdRef.current === data.scan_id) {
      lastRealtimeEventAtRef.current = Date.now();
      if (data.type === "scan_start") {
        setCodeScanActive(true);
        setCodeScanStreamEvents([data]);
      } else {
        setCodeScanStreamEvents((previous) => [...previous, data]);
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
    if (selectedScanIdRef.current === data.scan_id) {
      lastRealtimeEventAtRef.current = Date.now();
      setAdkTrace((previous) => mergeTraceEvent(previous, data));
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

  const activeScan = selectedScan;
  const selectedHistoryItem = useMemo(
    () => scanHistory.find((item) => item.id === selectedScanId) || null,
    [scanHistory, selectedScanId]
  );

  const dependencies: Dependency[] = Array.isArray(activeScan?.dependencies)
    ? activeScan.dependencies
    : [];
  const liveCodeFindings = codeFindings.length > 0
    ? codeFindings
    : Array.isArray(activeScan?.code_findings)
      ? activeScan.code_findings
      : [];
  const vulnerableDeps = dependencies.filter((dependency) => dependency.is_vulnerable);
  const totalVulns = vulnerableDeps.reduce(
    (sum, dependency) => sum + (dependency.vulnerabilities?.length || 0),
    0
  );
  const codeAgentRequests = useMemo(() => {
    if (!adkTrace?.events) return [];
    const trackedPhases = new Set([
      "chunk_summary",
      "candidate_generation",
      "evidence_expansion",
      "verification",
      "repo_synthesis",
    ]);
    return adkTrace.events.filter(
      (event) => trackedPhases.has(event.phase) && event.kind === "llm_completed"
    );
  }, [adkTrace]);
  const activity = useMemo(
    () => deriveAgentActivity(adkTrace, activeScan, codeScanStreamEvents),
    [activeScan, adkTrace, codeScanStreamEvents]
  );
  const { vulnerabilityCounts, codeCounts } = useMemo(
    () => severityCounts(dependencies, liveCodeFindings),
    [dependencies, liveCodeFindings]
  );

  const scoreColor =
    (activeScan?.security_score ?? 0) >= 80
      ? "var(--md-safe)"
      : (activeScan?.security_score ?? 0) >= 50
        ? "var(--md-warning)"
        : "var(--md-error)";
  const isIdle =
    Boolean(selectedProject) &&
    !historyLoading &&
    scanHistory.length === 0 &&
    !activeScan &&
    !scanning;
  const hasTrace = Boolean(adkTrace?.events.length);
  const selectedStatus = statusTone(activeScan?.scan_status || selectedHistoryItem?.scan_status);

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
            Connect GitHub in <strong>Settings</strong> and select a repository to inspect.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        className="scan-workbench-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "320px minmax(0, 1fr)",
          gap: 20,
          alignItems: "start",
        }}
      >
        <aside className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>
              Scan History
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: "var(--md-on-surface-variant)", lineHeight: 1.6 }}>
              Stored scans for the current repository. Selecting a result does not trigger a new scan.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {historyLoading ? (
              <div style={{ padding: 16, fontSize: 13, color: "var(--md-on-surface-variant)" }}>
                Loading scan history...
              </div>
            ) : scanHistory.length === 0 ? (
              <div
                style={{
                  padding: 16,
                  borderRadius: 14,
                  background: "var(--md-surface-container)",
                  fontSize: 13,
                  color: "var(--md-on-surface-variant)",
                  lineHeight: 1.6,
                }}
              >
                No stored scans for this repository yet. Use <strong>Fast Scan</strong> or <strong>Full Scan</strong> to start one manually.
              </div>
            ) : (
              scanHistory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void selectHistoryItem(item)}
                  style={{
                    border: selectedScanId === item.id ? "1px solid var(--md-primary)" : "1px solid var(--md-outline-variant)",
                    background:
                      selectedScanId === item.id
                        ? "rgba(2, 119, 189, 0.08)"
                        : "var(--md-surface-container)",
                    borderRadius: 14,
                    padding: "14px 14px 12px",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--md-on-surface)" }}>
                      {item.scan_mode === "fast" ? "Fast Scan" : "Full Scan"}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: statusTone(item.scan_status).background,
                        color: statusTone(item.scan_status).color,
                        fontWeight: 700,
                      }}
                    >
                      {statusTone(item.scan_status).label}
                    </span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--md-on-surface-variant)" }}>
                    {formatTime(item.scanned_at)}
                  </div>
                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                    <HistoryMetric label="Score" value={String(item.security_score ?? 0)} />
                    <HistoryMetric label="Vuln Deps" value={String(item.vulnerable_deps ?? 0)} />
                    <HistoryMetric label="Code" value={String(item.code_findings_count ?? 0)} />
                  </div>
                  {item.error_message && (
                    <div style={{ marginTop: 10, fontSize: 11, color: "var(--md-error)", lineHeight: 1.5 }}>
                      {item.error_message}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </aside>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--md-on-surface)", margin: 0 }}>
                    {selectedProject.repo.name}
                  </h2>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontWeight: 700,
                      background: selectedStatus.background,
                      color: selectedStatus.color,
                    }}
                  >
                    {selectedStatus.label}
                  </span>
                  {(activeScan?.scan_mode || selectedHistoryItem?.scan_mode) && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "4px 10px",
                        borderRadius: 999,
                        fontWeight: 700,
                        background: "var(--md-surface-container-high)",
                        color: "var(--md-on-surface)",
                      }}
                    >
                      {(activeScan?.scan_mode || selectedHistoryItem?.scan_mode) === "fast" ? "Fast Scan" : "Full Scan"}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 11,
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontWeight: 600,
                      background: "var(--md-surface-container-high)",
                      color: "var(--md-on-surface-variant)",
                    }}
                  >
                    {(activeScan?.scan_status || selectedHistoryItem?.scan_status) === "scanning" ? "Live scan" : "Stored result"}
                  </span>
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: "var(--md-on-surface-variant)", fontFamily: "var(--md-font-mono)" }}>
                  {selectedProject.repo.full_name}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => void runScan("fast")}
                  disabled={scanning}
                  style={{
                    ...buttonStyle,
                    background: scanning ? "var(--md-surface-container-high)" : "var(--md-primary)",
                    color: scanning ? "var(--md-on-surface-variant)" : "var(--md-on-primary)",
                  }}
                >
                  {scanning && <Spinner />}
                  {scanning ? "Scanning..." : "Fast Scan"}
                </button>
                <button
                  onClick={() => void runScan("full")}
                  disabled={scanning}
                  style={{
                    ...buttonStyle,
                    background: "var(--md-surface-container)",
                    color: scanning ? "var(--md-on-surface-variant)" : "var(--md-on-surface)",
                    border: "1px solid var(--md-outline-variant)",
                  }}
                >
                  Full Scan
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12,
              }}
            >
              <SnapshotMetric label="Started" value={formatTime(activeScan?.started_at || selectedHistoryItem?.started_at || activeScan?.scanned_at || selectedHistoryItem?.scanned_at)} />
              <SnapshotMetric label="Completed" value={formatTime(activeScan?.completed_at || selectedHistoryItem?.completed_at)} />
              <SnapshotMetric label="Duration" value={formatDuration(activeScan?.duration_ms || selectedHistoryItem?.duration_ms)} />
              <SnapshotMetric label="Security Score" value={`${activeScan?.security_score ?? selectedHistoryItem?.security_score ?? 0}/100`} tone={scoreColor} />
            </div>

            {activeScan && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                <StatCard
                  label="Dependencies"
                  value={activeScan.total_deps}
                  detail={`${activeScan.vulnerable_deps} vulnerable`}
                  color={activeScan.vulnerable_deps > 0 ? "var(--md-error)" : "var(--md-safe)"}
                />
                <StatCard
                  label="Vulnerabilities"
                  value={totalVulns}
                  detail={`Critical ${vulnerabilityCounts.critical} · High ${vulnerabilityCounts.high}`}
                  color={totalVulns > 0 ? "var(--md-error)" : "var(--md-safe)"}
                />
                <StatCard
                  label="Code Findings"
                  value={liveCodeFindings.length}
                  detail={`Critical ${codeCounts.critical} · High ${codeCounts.high}`}
                  color={(codeCounts.critical + codeCounts.high) > 0 ? "var(--md-error)" : liveCodeFindings.length > 0 ? "var(--md-warning)" : "var(--md-safe)"}
                />
                <StatCard
                  label="Execution"
                  value={hasTrace ? adkTrace?.events.length || 0 : 0}
                  detail={activity.phase_label}
                  color="var(--md-primary)"
                />
              </div>
            )}

            {activeScan?.error_message && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "rgba(198, 40, 40, 0.08)",
                  color: "var(--md-error)",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                {activeScan.error_message}
              </div>
            )}
          </div>

          {scanning && <ScanProgress currentStep={scanStep} message={scanMessage} />}

          {adkTrace && (scanning || adkTrace.events.length > 0) && (
            <AgentActivityPanel adkTrace={adkTrace} activity={activity} />
          )}

          {codeScanActive && scanning && (
            <CodeScanLiveView
              streamEvents={codeScanStreamEvents}
              agentRequests={codeAgentRequests}
            />
          )}

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
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--md-on-surface)" }}>
                Scan is idle
              </div>
              <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", lineHeight: 1.6 }}>
                Opening this page or switching repositories only loads stored history. Start a new scan manually with <strong>Fast Scan</strong> or <strong>Full Scan</strong>.
              </div>
            </div>
          )}

          {(activeScan || historyLoading || detailLoading || hasTrace) && (
            <>
              <div
                style={{
                  display: "flex",
                  gap: 0,
                  borderBottom: "1px solid var(--md-outline-variant)",
                  flexWrap: "wrap",
                }}
              >
                <TabButton active={resultTab === "overview"} onClick={() => setResultTab("overview")} label="Overview" />
                <TabButton active={resultTab === "dependencies"} onClick={() => setResultTab("dependencies")} label="Dependencies" count={dependencies.length} />
                <TabButton active={resultTab === "vulnerabilities"} onClick={() => setResultTab("vulnerabilities")} label="Vulnerabilities" count={totalVulns} alert={totalVulns > 0} />
                <TabButton active={resultTab === "code"} onClick={() => setResultTab("code")} label="Code Security" count={liveCodeFindings.length} alert={liveCodeFindings.some((finding) => finding.severity === "critical" || finding.severity === "high")} />
                <TabButton active={resultTab === "pipeline"} onClick={() => setResultTab("pipeline")} label="ADK Pipeline" count={adkTrace?.events.length || 0} alert={adkTrace?.phases.some((phase) => phase.status === "error")} />
              </div>

              <div style={{ minHeight: 420 }}>
                {detailLoading && !activeScan ? (
                  <div className="card" style={{ padding: 18, color: "var(--md-on-surface-variant)", fontSize: 13 }}>
                    Loading scan details...
                  </div>
                ) : resultTab === "overview" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {!activeScan && <InlineScanNotice message="Select a stored scan to inspect the analyst summary." />}
                    {activeScan && (
                      <>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                            gap: 12,
                          }}
                        >
                          <SnapshotMetric label="Dependency Severity" value={`C ${vulnerabilityCounts.critical} · H ${vulnerabilityCounts.high} · M ${vulnerabilityCounts.medium} · L ${vulnerabilityCounts.low}`} />
                          <SnapshotMetric label="Code Severity" value={`C ${codeCounts.critical} · H ${codeCounts.high} · M ${codeCounts.medium} · L ${codeCounts.low}`} />
                          <SnapshotMetric label="Vulnerable Dependencies" value={`${activeScan.vulnerable_deps}/${activeScan.total_deps}`} />
                          <SnapshotMetric label="Code Findings" value={`${liveCodeFindings.length}`} />
                        </div>
                        <DependencyTree dependencies={dependencies} />
                        {report ? (
                          <AiRemediationReport report={report} />
                        ) : (
                          <InlineScanNotice message="AI remediation summary is not available for this scan yet." />
                        )}
                      </>
                    )}
                  </div>
                ) : resultTab === "dependencies" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {activeScan ? (
                      <>
                        <DependencyInventory dependencies={dependencies} />
                        <DependencyTree dependencies={dependencies} />
                        <DependencyList dependencies={dependencies} />
                      </>
                    ) : (
                      <InlineScanNotice message="No dependency inventory is available for the selected scan." />
                    )}
                  </div>
                ) : resultTab === "vulnerabilities" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {activeScan ? (
                      <>
                        <VulnerabilityList dependencies={dependencies} />
                        {report && <AiRemediationReport report={report} />}
                      </>
                    ) : (
                      <InlineScanNotice message="No vulnerability results are available for the selected scan." />
                    )}
                  </div>
                ) : resultTab === "code" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <AgentRequestLog events={codeAgentRequests} loading={scanning} />
                    {scanning && liveCodeFindings.length === 0 && (
                      <InlineScanNotice message="Code findings will appear here as verification completes." />
                    )}
                    <CodeSecurityFindings findings={liveCodeFindings} />
                  </div>
                ) : (
                  <AdkPipelineView
                    snapshot={adkTrace}
                    loading={adkTraceLoading || scanning}
                    scan={activeScan}
                    codeScanStreamEvents={codeScanStreamEvents}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .scan-workbench-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function HistoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        background: "var(--md-surface-container-high)",
      }}
    >
      <div style={{ fontSize: 10, color: "var(--md-on-surface-variant)" }}>{label}</div>
      <div
        style={{
          marginTop: 3,
          fontSize: 13,
          fontWeight: 700,
          color: "var(--md-on-surface)",
          fontFamily: "var(--md-font-mono)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SnapshotMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--md-surface-container)",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}>{label}</div>
      <div
        style={{
          marginTop: 4,
          fontSize: 14,
          fontWeight: 700,
          color: tone || "var(--md-on-surface)",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
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
        fontWeight: active ? 700 : 500,
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
            fontWeight: 700,
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

function Spinner() {
  return (
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
  );
}

const buttonStyle: CSSProperties = {
  padding: "10px 18px",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 8,
  border: "none",
};
