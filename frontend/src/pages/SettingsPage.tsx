import { useState, useEffect } from "react";
import { updateSettings, testApiKey, getRepos } from "../services/api";
import type { GitHubUser, GitHubRepo, SelectedProject } from "../types";
import GitHubConnect from "../components/SupplyChain/GitHubConnect";
import LocalProjectSelect from "../components/SupplyChain/LocalProjectSelect";
import CloudRunConnect from "../components/Settings/CloudRunConnect";

interface Props {
  user: GitHubUser | null;
  onConnect: (user: GitHubUser) => void;
  onDisconnect: () => void;
  selectedProject: SelectedProject;
  onSelectProject: (project: SelectedProject) => void;
  adkKeySet: boolean;
  adkKeyPreview: string;
  onAdkKeyChange: (keySet: boolean, preview: string) => void;
  cloudRunUrl: string | null;
  onCloudRunConnect: (url: string) => void;
  onCloudRunDisconnect: () => void;
}

export default function SettingsPage({
  user,
  onConnect,
  onDisconnect,
  selectedProject,
  onSelectProject,
  adkKeySet: keySet,
  adkKeyPreview: keyPreview,
  onAdkKeyChange,
  cloudRunUrl,
  onCloudRunConnect,
  onCloudRunDisconnect,
}: Props) {
  const [inputKey, setInputKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  // Project source state
  const [scanMode, setScanMode] = useState<"github" | "local">(
    selectedProject?.mode ?? "github"
  );
  const [repos, setRepos] = useState<GitHubRepo[]>([]);

  // Fetch repos when user connects
  useEffect(() => {
    if (user) {
      getRepos().then(setRepos).catch(() => {});
    } else {
      setRepos([]);
    }
  }, [user]);

  async function handleSaveKey() {
    if (!inputKey.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const data = await updateSettings(inputKey.trim());
      onAdkKeyChange(data.google_api_key_set, data.google_api_key_preview);
      setInputKey("");
      setMessage({ text: "Google ADK key saved successfully", error: false });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Failed to save",
        error: true,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestKey() {
    setTesting(true);
    setMessage(null);
    try {
      const data = await testApiKey();
      if (data.success) {
        setMessage({
          text: `Key is valid — connected to Gemini API (${data.models?.length ?? 0} models available)`,
          error: false,
        });
      } else {
        setMessage({ text: data.error || "Key validation failed", error: true });
      }
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Test failed",
        error: true,
      });
    } finally {
      setTesting(false);
    }
  }

  function handleGitHubConnect(userData: GitHubUser) {
    onConnect(userData);
  }

  function handleGitHubDisconnect() {
    onDisconnect();
    setRepos([]);
  }

  function handleSelectLocal(path: string) {
    const name = path.split("/").pop() || path;
    onSelectProject({ mode: "local", path, name });
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: "var(--md-on-surface)",
          marginBottom: 8,
        }}
      >
        Settings
      </h2>

      {/* Cloud Run Instance */}
      <div className="card">
        <h3
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: "var(--md-on-surface)",
            marginBottom: 4,
          }}
        >
          Cloud Run Instance
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "var(--md-on-surface-variant)",
            marginBottom: 16,
          }}
        >
          Connect to a remote CyberLens instance on Google Cloud Run for live
          monitoring data.
        </p>
        <CloudRunConnect
          cloudRunUrl={cloudRunUrl}
          onConnect={onCloudRunConnect}
          onDisconnect={onCloudRunDisconnect}
        />
      </div>

      {/* Top Row: ADK Key + Project Source side by side */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Card 1: Google ADK Key */}
        <div className="card">
          <h3
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: "var(--md-on-surface)",
              marginBottom: 4,
            }}
          >
            Google Agent Development Kit (ADK)
          </h3>
          <p
            style={{
              fontSize: 13,
              color: "var(--md-on-surface-variant)",
              marginBottom: 16,
            }}
          >
            Required for AI-powered vulnerability analysis, code security scanning,
            and threat analysis. Uses Gemini via Google ADK.
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: keySet ? "var(--md-safe)" : "var(--md-error)",
                display: "inline-block",
              }}
            />
            <span style={{ color: "var(--md-on-surface-variant)" }}>
              {keySet ? `Configured (${keyPreview})` : "Not configured"}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="password"
              placeholder="Enter Google API key (AIza...)"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
              style={{
                flex: 1,
                minWidth: 0,
                padding: "10px 14px",
                borderRadius: "var(--md-radius-button)",
                border: "1px solid var(--md-outline-variant)",
                background: "var(--md-surface-container-high)",
                color: "var(--md-on-surface)",
                fontSize: 14,
                fontFamily: "var(--md-font-mono)",
                outline: "none",
              }}
            />
            <button
              onClick={handleSaveKey}
              disabled={saving || !inputKey.trim()}
              style={{
                padding: "10px 24px",
                borderRadius: "var(--md-radius-button)",
                border: "none",
                background:
                  saving || !inputKey.trim()
                    ? "var(--md-surface-container-high)"
                    : "var(--md-primary)",
                color:
                  saving || !inputKey.trim()
                    ? "var(--md-on-surface-variant)"
                    : "var(--md-on-primary)",
                fontWeight: 500,
                fontSize: 14,
                cursor: saving || !inputKey.trim() ? "default" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {saving ? "Saving..." : keySet ? "Update Key" : "Save Key"}
            </button>
            {keySet && (
              <button
                onClick={handleTestKey}
                disabled={testing}
                style={{
                  padding: "10px 24px",
                  borderRadius: "var(--md-radius-button)",
                  border: "1px solid var(--md-outline-variant)",
                  background: "transparent",
                  color: "var(--md-on-surface)",
                  fontWeight: 500,
                  fontSize: 14,
                  cursor: testing ? "wait" : "pointer",
                  opacity: testing ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {testing ? "Testing..." : "Test Key"}
              </button>
            )}
          </div>

          {message && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 13,
                background: message.error
                  ? "rgba(239, 83, 80, 0.1)"
                  : "rgba(129, 199, 132, 0.1)",
                color: message.error ? "var(--md-error)" : "var(--md-safe)",
              }}
            >
              {message.text}
            </div>
          )}
        </div>

        {/* Card 2: Project Source */}
        <div className="card">
          <h3
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: "var(--md-on-surface)",
              marginBottom: 16,
            }}
          >
            Project Source
          </h3>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {(["github", "local"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setScanMode(mode)}
                style={{
                  padding: "10px 24px",
                  borderRadius: "var(--md-radius-button)",
                  border: "none",
                  background:
                    scanMode === mode
                      ? "var(--md-primary)"
                      : "var(--md-surface-container-high)",
                  color:
                    scanMode === mode
                      ? "var(--md-on-primary)"
                      : "var(--md-on-surface-variant)",
                  fontWeight: 500,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {mode === "github" ? "GitHub" : "Local"}
              </button>
            ))}
          </div>

          {scanMode === "github" ? (
            <GitHubConnect
              user={user}
              onConnect={handleGitHubConnect}
              onDisconnect={handleGitHubDisconnect}
            />
          ) : (
            <LocalProjectSelect
              onScan={handleSelectLocal}
              scanning={false}
            />
          )}
        </div>
      </div>

      {/* Full-width: GitHub Repo Selection (when connected) */}
      {scanMode === "github" && user && repos.length > 0 && (
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
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 8,
            }}
          >
            {repos.map((repo) => {
              const isSelected =
                selectedProject?.mode === "github" &&
                selectedProject.repo.full_name === repo.full_name;
              return (
                <button
                  key={repo.full_name}
                  onClick={() =>
                    onSelectProject({ mode: "github", repo })
                  }
                  style={{
                    padding: "12px 16px",
                    background: isSelected
                      ? "var(--md-primary)"
                      : "var(--md-surface-container-high)",
                    border: isSelected
                      ? "2px solid var(--md-primary)"
                      : "1px solid var(--md-outline-variant)",
                    borderRadius: "var(--md-radius-list-item)",
                    color: isSelected
                      ? "var(--md-on-primary)"
                      : "var(--md-on-surface)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 14,
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{repo.name}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: isSelected
                        ? "var(--md-on-primary)"
                        : "var(--md-on-surface-variant)",
                      marginTop: 2,
                    }}
                  >
                    {repo.language || "Unknown"} &middot;{" "}
                    {repo.private ? "Private" : "Public"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected project detail */}
      {selectedProject?.mode === "github" && (
        <div className="card">
          <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--md-on-surface)", marginBottom: 4 }}>
                {selectedProject.repo.full_name}
              </h3>
              {selectedProject.repo.description && (
                <p style={{ fontSize: 13, color: "var(--md-on-surface-variant)", margin: 0 }}>
                  {selectedProject.repo.description}
                </p>
              )}
            </div>
            <a
              href={selectedProject.repo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "6px 14px",
                borderRadius: "var(--md-radius-button)",
                border: "1px solid var(--md-outline-variant)",
                background: "transparent",
                color: "var(--md-on-surface)",
                fontSize: 12,
                fontWeight: 500,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Open on GitHub
            </a>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 12,
            }}
          >
            {[
              { label: "Language", value: selectedProject.repo.language || "—" },
              { label: "Stars", value: String(selectedProject.repo.stargazers_count) },
              { label: "Forks", value: String(selectedProject.repo.forks_count) },
              { label: "Open Issues", value: String(selectedProject.repo.open_issues_count) },
              { label: "Default Branch", value: selectedProject.repo.default_branch },
              { label: "Visibility", value: selectedProject.repo.private ? "Private" : "Public" },
              { label: "Last Updated", value: new Date(selectedProject.repo.updated_at).toLocaleDateString() },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "10px 14px",
                  background: "var(--md-surface-container-high)",
                  borderRadius: 10,
                }}
              >
                <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", marginBottom: 2 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--md-on-surface)" }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              background: "rgba(129, 199, 132, 0.08)",
              borderRadius: 10,
              fontSize: 13,
              color: "var(--md-safe)",
            }}
          >
            Go to the <strong>Code Scan</strong> tab to scan this repository.
          </div>
        </div>
      )}

      {selectedProject?.mode === "local" && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(129, 199, 132, 0.1)",
            borderRadius: 12,
            fontSize: 13,
            color: "var(--md-safe)",
          }}
        >
          Selected: <strong>{selectedProject.name}</strong> (Local)
          {" — "}Go to the <strong>Code Scan</strong> tab to view scan results.
        </div>
      )}
    </div>
  );
}
