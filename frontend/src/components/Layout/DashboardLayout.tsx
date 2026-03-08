import type { ReactNode } from "react";
import { useSocket } from "../../hooks/useSocket";
import type { SelectedProject } from "../../types";

type Tab = "monitor" | "supply-chain" | "settings";

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  selectedProject: SelectedProject;
  adkKeySet: boolean;
  cloudRunUrl?: string | null;
  children: ReactNode;
}

export default function DashboardLayout({
  activeTab,
  onTabChange,
  selectedProject,
  adkKeySet,
  cloudRunUrl,
  children,
}: Props) {
  const { connected } = useSocket({}, cloudRunUrl);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Top App Bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          borderBottom: "1px solid var(--md-outline-variant)",
          gap: 16,
        }}
      >
        {/* Left: Logo + connection */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>&#128269;</span>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              fontFamily: "var(--md-font-display)",
              color: "var(--md-primary)",
            }}
          >
            CyberLens
          </h1>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: connected ? "var(--md-safe)" : "var(--md-error)",
              display: "inline-block",
            }}
            title={connected ? "Connected" : "Disconnected"}
          />
        </div>

        {/* Center: Tab Navigation */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === "monitor" ? "active" : ""}`}
            onClick={() => onTabChange("monitor")}
          >
            Live Monitor
          </button>
          <button
            className={`tab ${activeTab === "supply-chain" ? "active" : ""}`}
            onClick={() => onTabChange("supply-chain")}
          >
            Code Scan
          </button>
          <button
            className={`tab ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => onTabChange("settings")}
          >
            Settings
          </button>
        </div>

        {/* Right: ADK status + Selected project */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* ADK Key status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              background: "var(--md-surface-container)",
              border: "1px solid var(--md-outline-variant)",
              borderRadius: "var(--md-radius-chip)",
              fontSize: 12,
              color: "var(--md-on-surface-variant)",
            }}
            title={adkKeySet ? "Gemini API connected" : "Gemini API key not configured"}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: adkKeySet ? "var(--md-safe)" : "var(--md-error)",
                display: "inline-block",
              }}
            />
            <span style={{ fontWeight: 500 }}>Gemini</span>
          </div>

          {/* Cloud Run status */}
          {cloudRunUrl && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                background: "var(--md-surface-container)",
                border: "1px solid var(--md-outline-variant)",
                borderRadius: "var(--md-radius-chip)",
                fontSize: 12,
                color: "var(--md-on-surface-variant)",
              }}
              title={cloudRunUrl}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: connected ? "var(--md-safe)" : "var(--md-error)",
                  display: "inline-block",
                }}
              />
              <span style={{ fontWeight: 500 }}>Cloud Run</span>
            </div>
          )}

          {/* Selected project */}
          {selectedProject ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                background: "var(--md-surface-container)",
                border: "1px solid var(--md-outline-variant)",
                borderRadius: "var(--md-radius-chip)",
                fontSize: 13,
                color: "var(--md-on-surface)",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: "2px 8px",
                  borderRadius: 6,
                  background:
                    selectedProject.mode === "github"
                      ? "var(--md-primary)"
                      : "var(--md-safe)",
                  color:
                    selectedProject.mode === "github"
                      ? "var(--md-on-primary)"
                      : "#000",
                }}
              >
                {selectedProject.mode === "github" ? "GitHub" : "Local"}
              </span>
              <span style={{ fontWeight: 500 }}>
                {selectedProject.mode === "github"
                  ? selectedProject.repo.full_name
                  : selectedProject.name}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: "var(--md-on-surface-variant)" }}>
              No project selected
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
