import { useState, useCallback, useRef, useEffect } from "react";
import { useSocket } from "../hooks/useSocket";
import { triggerScan, triggerLocalScan, getScanResults, getAiReport, getCodeFindings } from "../services/api";
import type { GitHubScan, AiReport, Dependency, CodeFinding, SelectedProject } from "../types";
import SecurityScore from "../components/SupplyChain/SecurityScore";
import ScanProgress from "../components/SupplyChain/ScanProgress";
import DependencyTree from "../components/SupplyChain/DependencyTree";
import VulnerabilityList from "../components/SupplyChain/VulnerabilityList";
import AiRemediationReport from "../components/SupplyChain/AiRemediationReport";
import CodeSecurityFindings from "../components/SupplyChain/CodeSecurityFindings";

interface Props {
  selectedProject: SelectedProject;
}

export default function SupplyChainPage({ selectedProject }: Props) {
  const [scan, setScan] = useState<GitHubScan | null>(null);
  const [report, setReport] = useState<AiReport | null>(null);
  const [codeFindings, setCodeFindings] = useState<CodeFinding[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [scanStep, setScanStep] = useState("");
  const scanIdRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastProjectKeyRef = useRef<string | null>(null);

  async function fetchScanResults(scanId: number) {
    setScanning(false);
    setScanMessage("");
    setScanStep("completed");
    try {
      const results = await getScanResults(scanId);
      setScan(results);
      const aiReport = await getAiReport(scanId);
      setReport(aiReport);
      const findings = await getCodeFindings(scanId);
      setCodeFindings(findings);
    } catch (err) {
      console.error("Failed to fetch results:", err);
    }
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling(scanId: number) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const result = await getScanResults(scanId);
        if (result.scan_status === "completed" || result.scan_status === "failed") {
          stopPolling();
          if (result.scan_status === "completed") {
            await fetchScanResults(scanId);
          } else {
            setScanning(false);
            setScanMessage("Scan failed");
            setScanStep("failed");
          }
        }
      } catch {
        // Polling will retry on next interval
      }
    }, 3000);
  }

  useEffect(() => () => stopPolling(), []);

  async function runScan() {
    if (!selectedProject) return;
    setScanning(true);
    setScanMessage("Starting scan...");
    setScanStep("starting");
    setScan(null);
    setReport(null);
    setCodeFindings([]);
    try {
      const result =
        selectedProject.mode === "github"
          ? await triggerScan(selectedProject.repo.full_name)
          : await triggerLocalScan(selectedProject.path);
      setScan(result);
      scanIdRef.current = result.id;
      startPolling(result.id);
    } catch (err) {
      setScanMessage(err instanceof Error ? err.message : "Scan failed");
      setScanning(false);
    }
  }

  // Auto-scan when selected project changes
  useEffect(() => {
    const key = selectedProject
      ? selectedProject.mode === "github"
        ? selectedProject.repo.full_name
        : selectedProject.path
      : null;

    if (key && key !== lastProjectKeyRef.current) {
      lastProjectKeyRef.current = key;
      runScan();
    } else if (!key) {
      lastProjectKeyRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  const onScanProgress = useCallback(
    (data: { scan_id: number; step: string; message: string }) => {
      if (scanIdRef.current && data.scan_id === scanIdRef.current) {
        setScanMessage(data.message);
        setScanStep(data.step);
      }
    },
    []
  );

  const onScanComplete = useCallback(
    async (data: { scan_id: number }) => {
      if (scanIdRef.current && data.scan_id === scanIdRef.current) {
        stopPolling();
        await fetchScanResults(data.scan_id);
      }
    },
    []
  );

  useSocket({ onScanProgress, onScanComplete });

  const dependencies: Dependency[] = scan?.dependencies || [];

  // No project selected
  if (!selectedProject) {
    return (
      <div
        style={{
          padding: 48,
          textAlign: "center",
          color: "var(--md-on-surface-variant)",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>&#128269;</div>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
          No project selected
        </div>
        <div style={{ fontSize: 14 }}>
          Go to <strong>Settings</strong> to connect GitHub or select a local project.
        </div>
      </div>
    );
  }

  const projectLabel =
    selectedProject.mode === "github"
      ? selectedProject.repo.full_name
      : selectedProject.name;

  return (
    <div className="dashboard-grid" style={{ padding: 24 }}>
      {/* Top Row: Project Info + Re-scan + Score */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            padding: "8px 16px",
            background: "var(--md-surface-container-high)",
            borderRadius: "var(--md-radius-chip)",
            fontSize: 14,
            fontWeight: 500,
            color: "var(--md-on-surface)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12, color: "var(--md-on-surface-variant)" }}>
            {selectedProject.mode === "github" ? "GitHub" : "Local"}
          </span>
          {projectLabel}
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          style={{
            padding: "8px 20px",
            borderRadius: "var(--md-radius-button)",
            border: "1px solid var(--md-outline-variant)",
            background: "transparent",
            color: "var(--md-on-surface)",
            fontWeight: 500,
            fontSize: 13,
            cursor: scanning ? "wait" : "pointer",
            opacity: scanning ? 0.6 : 1,
          }}
        >
          {scanning ? "Scanning..." : "Re-scan"}
        </button>
        <div style={{ flex: 1 }} />
        <SecurityScore score={scan?.security_score ?? null} />
      </div>

      {/* Scan Progress */}
      {scanning && (
        <ScanProgress currentStep={scanStep as any} message={scanMessage} />
      )}

      {/* Scan Failed */}
      {!scanning && scanStep === "failed" && (
        <div
          style={{
            padding: 16,
            background: "rgba(239, 83, 80, 0.08)",
            borderRadius: 12,
            color: "var(--md-error)",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Scan failed — try again with the Re-scan button.
        </div>
      )}

      {/* Dependency Tree */}
      {dependencies.length > 0 && <DependencyTree dependencies={dependencies} />}

      {/* Results Row */}
      {scan && scan.scan_status === "completed" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <VulnerabilityList dependencies={dependencies} />
            <AiRemediationReport report={report} />
          </div>
          {codeFindings.length > 0 && (
            <CodeSecurityFindings findings={codeFindings} />
          )}
        </>
      )}
    </div>
  );
}
