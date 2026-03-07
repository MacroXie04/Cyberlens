import { useState, useCallback } from "react";
import { useSocket } from "../hooks/useSocket";
import { getRepos, triggerScan, getScanResults, getAiReport } from "../services/api";
import type { GitHubUser, GitHubRepo, GitHubScan, AiReport, Dependency } from "../types";
import GitHubConnect from "../components/SupplyChain/GitHubConnect";
import SecurityScore from "../components/SupplyChain/SecurityScore";
import DependencyTree from "../components/SupplyChain/DependencyTree";
import VulnerabilityList from "../components/SupplyChain/VulnerabilityList";
import AiRemediationReport from "../components/SupplyChain/AiRemediationReport";

export default function SupplyChainPage() {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [scan, setScan] = useState<GitHubScan | null>(null);
  const [report, setReport] = useState<AiReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  async function handleConnect(userData: GitHubUser) {
    setUser(userData);
    const repoList = await getRepos();
    setRepos(repoList);
  }

  function handleDisconnect() {
    setUser(null);
    setRepos([]);
    setScan(null);
    setReport(null);
  }

  async function handleScan(repoFullName: string) {
    setScanning(true);
    setScanMessage("Starting scan...");
    setScan(null);
    setReport(null);
    try {
      const result = await triggerScan(repoFullName);
      setScan(result);
    } catch (err) {
      setScanMessage(err instanceof Error ? err.message : "Scan failed");
      setScanning(false);
    }
  }

  const onScanProgress = useCallback(
    (data: { scan_id: number; message: string }) => {
      if (scan && data.scan_id === scan.id) {
        setScanMessage(data.message);
      }
    },
    [scan]
  );

  const onScanComplete = useCallback(
    async (data: { scan_id: number }) => {
      if (scan && data.scan_id === scan.id) {
        setScanning(false);
        setScanMessage("");
        try {
          const results = await getScanResults(data.scan_id);
          setScan(results);
          const aiReport = await getAiReport(data.scan_id);
          setReport(aiReport);
        } catch (err) {
          console.error("Failed to fetch results:", err);
        }
      }
    },
    [scan]
  );

  useSocket({ onScanProgress, onScanComplete });

  const dependencies: Dependency[] = scan?.dependencies || [];

  return (
    <div className="dashboard-grid" style={{ padding: 24 }}>
      {/* Connection + Score Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <GitHubConnect
          user={user}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
        <SecurityScore score={scan?.security_score ?? null} />
      </div>

      {/* Repo Selection */}
      {user && repos.length > 0 && (
        <div className="card">
          <h3
            style={{
              fontSize: 16,
              fontWeight: 500,
              marginBottom: 16,
              color: "var(--md-on-surface)",
            }}
          >
            Select Repository
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
              gap: 8,
            }}
          >
            {repos.map((repo) => (
              <button
                key={repo.full_name}
                onClick={() => handleScan(repo.full_name)}
                disabled={scanning}
                style={{
                  padding: "12px 16px",
                  background: "var(--md-surface-container-high)",
                  border: "1px solid var(--md-outline-variant)",
                  borderRadius: "var(--md-radius-list-item)",
                  color: "var(--md-on-surface)",
                  cursor: scanning ? "wait" : "pointer",
                  textAlign: "left",
                  fontSize: 14,
                }}
              >
                <div style={{ fontWeight: 500 }}>{repo.name}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--md-on-surface-variant)",
                    marginTop: 2,
                  }}
                >
                  {repo.language || "Unknown"} &middot;{" "}
                  {repo.private ? "Private" : "Public"}
                </div>
              </button>
            ))}
          </div>
          {scanMessage && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                background: "var(--md-surface-container-high)",
                borderRadius: 12,
                color: "var(--md-primary)",
                fontSize: 13,
              }}
            >
              {scanMessage}
            </div>
          )}
        </div>
      )}

      {/* Dependency Tree */}
      {dependencies.length > 0 && <DependencyTree dependencies={dependencies} />}

      {/* Results Row */}
      {scan && scan.scan_status === "completed" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <VulnerabilityList dependencies={dependencies} />
          <AiRemediationReport report={report} />
        </div>
      )}
    </div>
  );
}
