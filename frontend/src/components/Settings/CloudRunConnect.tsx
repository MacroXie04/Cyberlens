import { useState } from "react";

interface Props {
  cloudRunUrl: string | null;
  onConnect: (url: string) => void;
  onDisconnect: () => void;
}

export default function CloudRunConnect({ cloudRunUrl, onConnect, onDisconnect }: Props) {
  const [inputUrl, setInputUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    const url = inputUrl.trim().replace(/\/$/, "");
    if (!url) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${url}/api/stats/overview/`, {
        mode: "cors",
        credentials: "omit",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onConnect(url);
      setInputUrl("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setError("Unable to reach the server. Check the URL and ensure CORS is enabled.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  if (cloudRunUrl) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--md-safe)",
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 14, color: "var(--md-on-surface)" }}>
            Connected
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--md-on-surface-variant)",
              fontFamily: "var(--md-font-mono)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {cloudRunUrl}
          </div>
        </div>
        <button
          onClick={onDisconnect}
          style={{
            padding: "8px 16px",
            borderRadius: "var(--md-radius-button)",
            border: "1px solid var(--md-outline)",
            background: "transparent",
            color: "var(--md-on-surface)",
            cursor: "pointer",
            fontSize: 13,
            whiteSpace: "nowrap",
          }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)" }}>
        Enter the URL of a CyberLens instance running on Google Cloud Run to stream
        live monitor data from it.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="url"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          placeholder="https://cyberlens-xxxxx-uc.a.run.app"
          onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "10px 14px",
            borderRadius: "var(--md-radius-button)",
            border: "1px solid var(--md-outline-variant)",
            background: "var(--md-surface-container-high)",
            color: "var(--md-on-surface)",
            fontFamily: "var(--md-font-mono)",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          onClick={handleConnect}
          disabled={loading || !inputUrl.trim()}
          style={{
            padding: "10px 24px",
            borderRadius: "var(--md-radius-button)",
            border: "none",
            background:
              loading || !inputUrl.trim()
                ? "var(--md-surface-container-high)"
                : "var(--md-primary)",
            color:
              loading || !inputUrl.trim()
                ? "var(--md-on-surface-variant)"
                : "var(--md-on-primary)",
            fontWeight: 500,
            fontSize: 14,
            cursor: loading || !inputUrl.trim() ? "default" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Connecting..." : "Connect"}
        </button>
      </div>
      {error && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 13,
            background: "rgba(239, 83, 80, 0.1)",
            color: "var(--md-error)",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
