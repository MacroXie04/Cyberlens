import { useState, useEffect } from "react";
import { getLocalProjects } from "../../services/api";
import type { LocalProject } from "../../types";

interface Props {
  onScan: (path: string) => void;
  scanning?: boolean;
}

export default function LocalProjectSelect({ onScan, scanning = false }: Props) {
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [customPath, setCustomPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    getLocalProjects()
      .then(setProjects)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to list projects"))
      .finally(() => setLoading(false));
  }, []);

  function handleCustomScan() {
    if (customPath.trim()) {
      onScan(customPath.trim());
    }
  }

  return (
    <div className="card">
      <h3
        style={{
          fontSize: 16,
          fontWeight: 500,
          marginBottom: 16,
          color: "var(--md-on-surface)",
        }}
      >
        Local Project Scan
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)" }}>
          Scan a local project directory for dependency vulnerabilities and code security issues.
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            placeholder="Enter directory path (e.g., frontend)"
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: "var(--md-radius-list-item)",
              border: "1px solid var(--md-outline-variant)",
              background: "var(--md-surface-container-high)",
              color: "var(--md-on-surface)",
              fontFamily: "var(--md-font-mono)",
              fontSize: 14,
              outline: "none",
            }}
            onKeyDown={(e) => e.key === "Enter" && handleCustomScan()}
          />
          <button
            onClick={handleCustomScan}
            disabled={scanning || !customPath.trim()}
            style={{
              padding: "12px 24px",
              borderRadius: "var(--md-radius-button)",
              border: "none",
              background: "var(--md-primary)",
              color: "var(--md-on-primary)",
              fontWeight: 500,
              fontSize: 14,
              cursor: scanning ? "wait" : "pointer",
              opacity: scanning || !customPath.trim() ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            Scan
          </button>
        </div>

        {error && (
          <div style={{ color: "var(--md-error)", fontSize: 13 }}>{error}</div>
        )}

        {loading ? (
          <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)" }}>
            Loading projects...
          </div>
        ) : projects.length > 0 ? (
          <>
            <div
              style={{
                fontSize: 13,
                color: "var(--md-on-surface-variant)",
                marginTop: 4,
              }}
            >
              Detected projects:
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 8,
              }}
            >
              {projects.map((project) => (
                <button
                  key={project.path}
                  onClick={() => onScan(project.path)}
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 500 }}>{project.name}</span>
                    {project.has_manifest && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          borderRadius: 8,
                          background: "var(--md-safe)",
                          color: "#000",
                        }}
                      >
                        deps
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--md-on-surface-variant)",
                      marginTop: 2,
                      fontFamily: "var(--md-font-mono)",
                    }}
                  >
                    {project.path}
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
