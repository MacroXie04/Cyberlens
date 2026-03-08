import { useState, useCallback, useRef, useEffect } from "react";
import { useSocket } from "../hooks/useSocket";
import { triggerScan, getScanResults, getAiReport, getCodeFindings } from "../services/api";
import type { GitHubScan, AiReport, Dependency, CodeFinding, SelectedProject, CodeScanStreamEvent } from "../types";
import ScanProgress from "../components/SupplyChain/ScanProgress";
import DependencyTree from "../components/SupplyChain/DependencyTree";
import VulnerabilityList from "../components/SupplyChain/VulnerabilityList";
import AiRemediationReport from "../components/SupplyChain/AiRemediationReport";
import CodeSecurityFindings from "../components/SupplyChain/CodeSecurityFindings";
import CodeScanLiveView from "../components/SupplyChain/CodeScanLiveView";

type ResultTab = "overview" | "vulnerabilities" | "code";

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
  const [resultTab, setResultTab] = useState<ResultTab>("overview");
  const scanIdRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastProjectKeyRef = useRef<string | null>(null);

  // Code scan streaming state
  const [codeScanStreamEvents, setCodeScanStreamEvents] = useState<CodeScanStreamEvent[]>([]);
  const [codeScanActive, setCodeScanActive] = useState(false);
  const [codeScanSummary, setCodeScanSummary] = useState<CodeScanStreamEvent | null>(null);

  async function fetchScanResults(scanId: number) {
    setScanning(false);
    setScanMessage("");
    setScanStep("completed");
    setCodeScanActive(false);
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
            setCodeScanActive(false);
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
    setCodeScanStreamEvents([]);
    setCodeScanActive(false);
    setCodeScanSummary(null);
    setResultTab("overview");
    try {
      const result = await triggerScan(selectedProject.repo.full_name);
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
    const key = selectedProject ? selectedProject.repo.full_name : null;
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

  const onCodeScanStream = useCallback(
    (data: CodeScanStreamEvent) => {
      if (scanIdRef.current && data.scan_id === scanIdRef.current) {
        if (data.type === "scan_start") {
          setCodeScanActive(true);
          setCodeScanStreamEvents([data]);
        } else if (data.type === "scan_summary") {
          setCodeScanSummary(data);
          setCodeScanStreamEvents((prev) => [...prev, data]);
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
        }
      }
    },
    []
  );

  useSocket({ onScanProgress, onScanComplete, onCodeScanStream });

  const dependencies: Dependency[] = scan?.dependencies || [];
  const vulnerableDeps = dependencies.filter((d) => d.is_vulnerable);
  const totalVulns = vulnerableDeps.reduce(
    (sum, d) => sum + (d.vulnerabilities?.length || 0),
    0
  );

  // No project selected
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

  const isCompleted = scan?.scan_status === "completed";
  const scoreColor =
    (scan?.security_score ?? 0) >= 80
      ? "var(--md-safe)"
      : (scan?.security_score ?? 0) >= 50
        ? "var(--md-warning)"
        : "var(--md-error)";

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
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
          onClick={runScan}
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

      {/* Stats Row */}
      {isCompleted && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <StatCard
            label="Security Score"
            value={scan?.security_score ?? 0}
            suffix="/100"
            color={scoreColor}
          />
          <StatCard
            label="Dependencies"
            value={scan?.total_deps ?? 0}
            detail={`${scan?.vulnerable_deps ?? 0} vulnerable`}
            color={
              (scan?.vulnerable_deps ?? 0) > 0 ? "var(--md-error)" : "var(--md-safe)"
            }
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
              codeFindings.filter((f) => f.severity === "critical").length > 0
                ? `${codeFindings.filter((f) => f.severity === "critical").length} critical`
                : undefined
            }
            color={
              codeFindings.filter((f) => f.severity === "critical" || f.severity === "high")
                .length > 0
                ? "var(--md-error)"
                : codeFindings.length > 0
                  ? "var(--md-warning)"
                  : "var(--md-safe)"
            }
          />
        </div>
      )}

      {/* Scan Progress */}
      {scanning && (
        <ScanProgress currentStep={scanStep as any} message={scanMessage} />
      )}

      {/* Code Scan Live View */}
      {codeScanActive && (
        <CodeScanLiveView streamEvents={codeScanStreamEvents} />
      )}

      {/* Scan Failed */}
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--md-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--md-error)" }}>
              Scan failed
            </div>
            <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", marginTop: 2 }}>
              Something went wrong. Try scanning again.
            </div>
          </div>
        </div>
      )}

      {/* Results with Tabs */}
      {isCompleted && (
        <>
          {/* Tab Bar */}
          <div
            style={{
              display: "flex",
              gap: 0,
              borderBottom: "1px solid var(--md-outline-variant)",
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
              count={codeFindings.length}
              alert={codeFindings.some((f) => f.severity === "critical" || f.severity === "high")}
            />
          </div>

          {/* Tab Content */}
          <div style={{ minHeight: 400 }}>
            {resultTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <DependencyTree dependencies={dependencies} />
                {report && <AiRemediationReport report={report} />}
              </div>
            )}

            {resultTab === "vulnerabilities" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <VulnerabilityList dependencies={dependencies} />
                {report && <AiRemediationReport report={report} />}
              </div>
            )}

            {resultTab === "code" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Token summary bar */}
                {scan.code_scan_total_tokens > 0 && (
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
                <CodeSecurityFindings findings={codeFindings} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Sub-components ---------- */

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
        {suffix && (
          <span style={{ fontSize: 13, color: "var(--md-on-surface-variant)" }}>
            {suffix}
          </span>
        )}
      </div>
      {detail && (
        <div style={{ fontSize: 12, color, marginTop: 2 }}>{detail}</div>
      )}
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
