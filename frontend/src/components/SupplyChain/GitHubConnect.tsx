import { useState } from "react";
import { connectGitHub, disconnectGitHub } from "../../services/api";
import type { GitHubUser } from "../../types";

interface Props {
  user: GitHubUser | null;
  onConnect: (user: GitHubUser) => void;
  onDisconnect: () => void;
}

export default function GitHubConnect({ user, onConnect, onDisconnect }: Props) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    if (!token.trim()) return;
    setLoading(true);
    setError("");
    try {
      const userData = await connectGitHub(token);
      onConnect(userData);
      setToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    await disconnectGitHub();
    onDisconnect();
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
        GitHub Connection
      </h3>

      {user ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src={user.avatar_url}
            alt={user.login}
            style={{ width: 40, height: 40, borderRadius: "50%" }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>{user.name || user.login}</div>
            <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)" }}>
              @{user.login}
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--md-radius-button)",
              border: "1px solid var(--md-outline)",
              background: "transparent",
              color: "var(--md-on-surface)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)" }}>
            Enter a GitHub Personal Access Token with <code>repo</code> scope
            to scan private repositories.
          </div>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxx"
            style={{
              padding: "12px 16px",
              borderRadius: "var(--md-radius-list-item)",
              border: "1px solid var(--md-outline-variant)",
              background: "var(--md-surface-container-high)",
              color: "var(--md-on-surface)",
              fontFamily: "var(--md-font-mono)",
              fontSize: 14,
              outline: "none",
            }}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          />
          {error && (
            <div style={{ color: "var(--md-error)", fontSize: 13 }}>{error}</div>
          )}
          <button
            onClick={handleConnect}
            disabled={loading || !token.trim()}
            style={{
              padding: "12px 24px",
              borderRadius: "var(--md-radius-button)",
              border: "none",
              background: "var(--md-primary)",
              color: "var(--md-on-primary)",
              fontWeight: 500,
              fontSize: 14,
              cursor: loading ? "wait" : "pointer",
              opacity: loading || !token.trim() ? 0.6 : 1,
            }}
          >
            {loading ? "Connecting..." : "Connect GitHub"}
          </button>
        </div>
      )}
    </div>
  );
}
