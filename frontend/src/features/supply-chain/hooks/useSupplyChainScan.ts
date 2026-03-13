import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSocket } from "../../../hooks/useSocket";
import { deriveAgentActivity } from "../../../components/SupplyChain/activity/activity";
import { getAdkTraceSnapshot, getAiReport, getCodeFindings, getCodeMap, getScanHistory, getScanResults, triggerScan } from "../api";
import { scanToHistoryItem, severityCounts, upsertHistoryItem } from "../lib/history";
import { emptyTraceSnapshot, mergeTraceEvent, TRACE_PHASE_LABELS } from "../lib/traceSnapshot";
import type { AdkTraceEvent, AdkTraceSnapshot, AiReport, CodeFinding, CodeMapData, CodeScanStreamEvent, GitHubScan, GitHubScanHistoryItem, ScanMode, SelectedProject } from "../types";
import { deriveScanProgress, type ScanProgressStep } from "../../../pages/supplyChainScanProgress";

type ResultTab = "overview" | "architecture" | "dependencies" | "vulnerabilities" | "code" | "pipeline";

export function useSupplyChainScan(selectedProject: SelectedProject) {
  const [scanHistory, setScanHistory] = useState<GitHubScanHistoryItem[]>([]), [selectedScanId, setSelectedScanId] = useState<number | null>(null), [selectedScan, setSelectedScan] = useState<GitHubScan | null>(null), [report, setReport] = useState<AiReport | null>(null), [codeFindings, setCodeFindings] = useState<CodeFinding[]>([]), [scanning, setScanning] = useState(false), [scanMessage, setScanMessage] = useState(""), [scanStep, setScanStep] = useState<ScanProgressStep>(""), [resultTab, setResultTab] = useState<ResultTab>("overview"), [adkTrace, setAdkTrace] = useState<AdkTraceSnapshot | null>(null), [adkTraceLoading, setAdkTraceLoading] = useState(false), [historyLoading, setHistoryLoading] = useState(false), [detailLoading, setDetailLoading] = useState(false), [codeScanStreamEvents, setCodeScanStreamEvents] = useState<CodeScanStreamEvent[]>([]), [codeScanActive, setCodeScanActive] = useState(false), [codeMapData, setCodeMapData] = useState<CodeMapData | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null), selectedScanIdRef = useRef<number | null>(null), lastProjectKeyRef = useRef<string | null>(null), lastRealtimeEventAtRef = useRef(0);
  const repoFullName = selectedProject?.repo.full_name || null;

  useEffect(() => { selectedScanIdRef.current = selectedScanId; }, [selectedScanId]);
  const stopPolling = useCallback(() => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }, []);
  const resetPageState = useCallback(() => { stopPolling(); selectedScanIdRef.current = null; lastRealtimeEventAtRef.current = 0; setScanHistory([]); setSelectedScanId(null); setSelectedScan(null); setReport(null); setCodeFindings([]); setScanning(false); setScanMessage(""); setScanStep(""); setResultTab("overview"); setAdkTrace(null); setAdkTraceLoading(false); setHistoryLoading(false); setDetailLoading(false); setCodeScanStreamEvents([]); setCodeScanActive(false); setCodeMapData(null); }, [stopPolling]);
  const applyHistoryItem = useCallback((item: GitHubScanHistoryItem) => setScanHistory((previous) => upsertHistoryItem(previous, item)), []);

  const loadScanData = useCallback(async (scanId: number) => {
    setDetailLoading(true); setAdkTraceLoading(true);
    const [scanResult, aiReportResult, findingsResult, traceResult, codeMapResult] = await Promise.allSettled([getScanResults(scanId), getAiReport(scanId), getCodeFindings(scanId), getAdkTraceSnapshot(scanId), getCodeMap(scanId)]);
    if (selectedScanIdRef.current !== scanId) { setDetailLoading(false); setAdkTraceLoading(false); return; }
    if (scanResult.status === "fulfilled") {
      const nextScan = scanResult.value; setSelectedScan(nextScan); applyHistoryItem(scanToHistoryItem(nextScan)); setScanning(nextScan.scan_status === "scanning");
      if (nextScan.scan_status === "failed") { setScanStep("failed"); setScanMessage(nextScan.error_message || "Scan failed"); }
      else if (nextScan.scan_status === "scanning") { const derived = deriveScanProgress(nextScan); setScanStep(derived.step); setScanMessage(derived.message); if (derived.codeScanActive) setCodeScanActive(true); }
      else { setScanMessage(""); setScanStep("completed"); setCodeScanActive(false); }
    }
    setReport(aiReportResult.status === "fulfilled" ? aiReportResult.value || null : null);
    setCodeFindings(findingsResult.status === "fulfilled" && Array.isArray(findingsResult.value) ? findingsResult.value : []);
    setAdkTrace(traceResult.status === "fulfilled" ? traceResult.value : emptyTraceSnapshot());
    setCodeMapData(codeMapResult.status === "fulfilled" && codeMapResult.value ? codeMapResult.value : null);
    setDetailLoading(false); setAdkTraceLoading(false);
  }, [applyHistoryItem]);

  const startPolling = useCallback((scanId: number) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const result = await getScanResults(scanId); applyHistoryItem(scanToHistoryItem(result));
        if (selectedScanIdRef.current !== scanId) return;
        setSelectedScan(result);
        if (result.scan_status === "scanning" && Date.now() - lastRealtimeEventAtRef.current > 10000) { const derived = deriveScanProgress(result); setScanStep(derived.step); setScanMessage(derived.message); if (derived.codeScanActive) setCodeScanActive(true); }
        if (result.scan_status === "completed" || result.scan_status === "failed") { stopPolling(); await loadScanData(scanId); }
      } catch {}
    }, 3000);
  }, [applyHistoryItem, loadScanData, stopPolling]);

  const loadHistoryForRepo = useCallback(async (repo: string) => {
    setHistoryLoading(true);
    try {
      const history = await getScanHistory(repo); if (lastProjectKeyRef.current !== repo) return; setScanHistory(history);
      if (history.length === 0) return;
      const latest = history[0]; selectedScanIdRef.current = latest.id; setSelectedScanId(latest.id); setScanning(latest.scan_status === "scanning"); latest.scan_status === "scanning" ? startPolling(latest.id) : stopPolling(); await loadScanData(latest.id);
    } finally { setHistoryLoading(false); }
  }, [loadScanData, startPolling, stopPolling]);

  useEffect(() => { if (repoFullName && repoFullName !== lastProjectKeyRef.current) { lastProjectKeyRef.current = repoFullName; resetPageState(); void loadHistoryForRepo(repoFullName); return; } if (!repoFullName) { lastProjectKeyRef.current = null; resetPageState(); } }, [loadHistoryForRepo, repoFullName, resetPageState]);
  useEffect(() => () => stopPolling(), [stopPolling]);

  const selectHistoryItem = useCallback(async (item: GitHubScanHistoryItem) => {
    selectedScanIdRef.current = item.id; setSelectedScanId(item.id); setSelectedScan(null); setReport(null); setCodeFindings([]); setAdkTrace(null); setCodeScanStreamEvents([]); setCodeScanActive(false); setCodeMapData(null); setScanning(item.scan_status === "scanning");
    item.scan_status === "scanning" ? startPolling(item.id) : stopPolling(); await loadScanData(item.id);
  }, [loadScanData, startPolling, stopPolling]);

  const runScan = useCallback(async (scanMode: ScanMode) => {
    if (!repoFullName) return;
    lastRealtimeEventAtRef.current = 0; setScanning(true); setScanMessage(scanMode === "fast" ? "Starting Fast Scan..." : "Starting Full Scan..."); setScanStep("starting"); setReport(null); setCodeFindings([]); setCodeScanStreamEvents([]); setCodeScanActive(false); setCodeMapData(null); setAdkTrace(emptyTraceSnapshot()); setResultTab("pipeline");
    try {
      const created = await triggerScan(repoFullName, scanMode); applyHistoryItem(scanToHistoryItem(created)); selectedScanIdRef.current = created.id; setSelectedScanId(created.id); setSelectedScan(created); setScanning(true); startPolling(created.id); await loadScanData(created.id);
    } catch (error) { const message = error instanceof Error ? error.message : "Scan failed"; setScanning(false); setScanStep("failed"); setScanMessage(message); }
  }, [applyHistoryItem, loadScanData, repoFullName, startPolling]);

  useSocket({
    onScanProgress: (data) => { if (selectedScanIdRef.current === data.scan_id) { lastRealtimeEventAtRef.current = Date.now(); setScanMessage(data.message); setScanStep(data.step as ScanProgressStep); } },
    onScanComplete: async (data) => { if (selectedScanIdRef.current === data.scan_id) { lastRealtimeEventAtRef.current = Date.now(); stopPolling(); await loadScanData(data.scan_id); } },
    onCodeScanStream: (data: CodeScanStreamEvent) => { if (selectedScanIdRef.current === data.scan_id) { lastRealtimeEventAtRef.current = Date.now(); if (data.type === "scan_start") { setCodeScanActive(true); setCodeScanStreamEvents([data]); } else setCodeScanStreamEvents((previous) => [...previous, data]); if (data.type === "file_start" && data.file_path) { const fileName = data.file_path.split("/").pop() || data.file_path; setScanMessage(data.total_files != null && data.file_index != null ? `Analyzing ${fileName} (${data.file_index + 1}/${data.total_files})` : `Analyzing ${fileName}`); setScanStep("code_scan"); } else if (data.type === "warning") setScanMessage(data.message || data.error || "Code scan warning"); } },
    onAdkTraceStream: (data: AdkTraceEvent) => { if (selectedScanIdRef.current === data.scan_id) { lastRealtimeEventAtRef.current = Date.now(); setAdkTrace((previous) => mergeTraceEvent(previous, data)); if (data.kind === "stage_started") { if (["chunk_summary", "candidate_generation", "evidence_expansion", "verification", "repo_synthesis"].includes(data.phase)) setScanStep("code_scan"); else if (["dependency_input", "dependency_adk_report"].includes(data.phase)) setScanStep("analyzing"); setScanMessage(data.label || TRACE_PHASE_LABELS[data.phase]); } else if (data.kind === "warning" || data.kind === "error") setScanMessage(data.text_preview || data.label || TRACE_PHASE_LABELS[data.phase]); } },
  });

  const activeScan = selectedScan, selectedHistoryItem = scanHistory.find((item) => item.id === selectedScanId) || null, dependencies = Array.isArray(activeScan?.dependencies) ? activeScan.dependencies : [], liveCodeFindings = codeFindings.length > 0 ? codeFindings : Array.isArray(activeScan?.code_findings) ? activeScan.code_findings : [];
  const totalVulns = dependencies.filter((dependency) => dependency.is_vulnerable).reduce((sum, dependency) => sum + (dependency.vulnerabilities?.length || 0), 0);
  const codeAgentRequests = useMemo(() => !adkTrace?.events ? [] : adkTrace.events.filter((event) => new Set(["chunk_summary", "candidate_generation", "evidence_expansion", "verification", "repo_synthesis"]).has(event.phase) && event.kind === "llm_completed"), [adkTrace]);
  const activity = useMemo(() => deriveAgentActivity(adkTrace, activeScan, codeScanStreamEvents), [activeScan, adkTrace, codeScanStreamEvents]);
  const { vulnerabilityCounts, codeCounts } = useMemo(() => severityCounts(dependencies, liveCodeFindings), [dependencies, liveCodeFindings]);
  const scoreColor = (activeScan?.security_score ?? 0) >= 80 ? "var(--md-safe)" : (activeScan?.security_score ?? 0) >= 50 ? "var(--md-warning)" : "var(--md-error)";
  const isIdle = Boolean(selectedProject) && !historyLoading && scanHistory.length === 0 && !activeScan && !scanning, hasTrace = Boolean(adkTrace?.events.length);

  return { activeScan, activity, adkTrace, adkTraceLoading, codeAgentRequests, codeCounts, codeFindings: liveCodeFindings, codeMapData, codeScanActive, codeScanStreamEvents, dependencies, detailLoading, hasTrace, historyLoading, isIdle, report, resultTab, scanHistory, scanMessage, scanStep, scanning, scoreColor, selectHistoryItem, selectedHistoryItem, selectedScanId, setResultTab, totalVulns, runScan, vulnerabilityCounts };
}
