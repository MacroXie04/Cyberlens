import type { ReactNode } from "react";
import { useSocket } from "../../hooks/useSocket";

interface Props {
  activeTab: "monitor" | "supply-chain";
  onTabChange: (tab: "monitor" | "supply-chain") => void;
  children: ReactNode;
}

export default function DashboardLayout({
  activeTab,
  onTabChange,
  children,
}: Props) {
  const { connected } = useSocket();

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Top App Bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid var(--md-outline-variant)",
        }}
      >
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

        {/* Tab Navigation */}
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
            Supply Chain
          </button>
        </div>

        <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)" }}>
          Intelligent Security Monitoring
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
