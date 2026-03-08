import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../services/api";
import type { AuthUser } from "../types";

interface Props {
  onAuth: (user: AuthUser) => void;
}

export default function LoginPage({ onAuth }: Props) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(username, password);
      onAuth(data.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--md-surface)",
      }}
    >
      <div
        style={{
          width: 400,
          padding: 32,
          background: "var(--md-surface-container)",
          borderRadius: "var(--md-radius-card)",
          border: "1px solid var(--md-outline-variant)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <span style={{ fontSize: 32 }}>&#128269;</span>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--md-primary)",
              fontFamily: "var(--md-font-display)",
              margin: "8px 0 4px",
            }}
          >
            CyberLens
          </h1>
          <p style={{ fontSize: 14, color: "var(--md-on-surface-variant)", margin: 0 }}>
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{
              padding: "12px 14px",
              borderRadius: "var(--md-radius-button)",
              border: "1px solid var(--md-outline-variant)",
              background: "var(--md-surface-container-high)",
              color: "var(--md-on-surface)",
              fontSize: 14,
              outline: "none",
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: "12px 14px",
              borderRadius: "var(--md-radius-button)",
              border: "1px solid var(--md-outline-variant)",
              background: "var(--md-surface-container-high)",
              color: "var(--md-on-surface)",
              fontSize: 14,
              outline: "none",
            }}
          />

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

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 24px",
              borderRadius: "var(--md-radius-button)",
              border: "none",
              background: loading ? "var(--md-surface-container-high)" : "var(--md-primary)",
              color: loading ? "var(--md-on-surface-variant)" : "var(--md-on-primary)",
              fontWeight: 600,
              fontSize: 14,
              cursor: loading ? "default" : "pointer",
              marginTop: 4,
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p
          style={{
            textAlign: "center",
            marginTop: 16,
            fontSize: 13,
            color: "var(--md-on-surface-variant)",
          }}
        >
          Don't have an account?{" "}
          <Link
            to="/register"
            style={{ color: "var(--md-primary)", textDecoration: "none", fontWeight: 500 }}
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
