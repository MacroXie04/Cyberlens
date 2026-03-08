import { useState } from "react";
import type { CodeFinding } from "../../types";

interface Props {
  findings: CodeFinding[];
}

const severityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const severityColors: Record<string, string> = {
  critical: "var(--md-error)",
  high: "var(--md-warning)",
  medium: "var(--md-primary)",
  low: "var(--md-on-surface-variant)",
  info: "var(--md-outline)",
};

const categoryLabels: Record<string, string> = {
  sql_injection: "SQL Injection",
  xss: "XSS",
  hardcoded_secret: "Hardcoded Secret",
  path_traversal: "Path Traversal",
  command_injection: "Command Injection",
  insecure_crypto: "Insecure Crypto",
  insecure_deserialization: "Insecure Deserialization",
  ssrf: "SSRF",
  broken_auth: "Broken Auth",
  sensitive_data: "Sensitive Data",
  missing_validation: "Missing Validation",
  insecure_file_ops: "Insecure File Ops",
  other: "Other",
};

export default function CodeSecurityFindings({ findings }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const sorted = [...findings].sort(
    (a, b) =>
      (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5)
  );

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;

  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h3
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: "var(--md-on-surface)",
            margin: 0,
          }}
        >
          Code Security Findings
        </h3>
        <div style={{ display: "flex", gap: 8 }}>
          {criticalCount > 0 && (
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 8,
                background: "var(--md-error)",
                color: "#fff",
              }}
            >
              {criticalCount} critical
            </span>
          )}
          {highCount > 0 && (
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 8,
                background: "var(--md-warning)",
                color: "#000",
              }}
            >
              {highCount} high
            </span>
          )}
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 8,
              background: "var(--md-surface-container-high)",
              color: "var(--md-on-surface-variant)",
            }}
          >
            {findings.length} total
          </span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 24,
            color: "var(--md-on-surface-variant)",
            fontSize: 14,
          }}
        >
          No code security issues found
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((finding) => (
            <div
              key={finding.id}
              style={{
                background: "var(--md-surface-container-high)",
                borderRadius: "var(--md-radius-list-item)",
                borderLeft: `3px solid ${severityColors[finding.severity] || "var(--md-outline)"}`,
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => toggle(finding.id)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "transparent",
                  border: "none",
                  color: "var(--md-on-surface)",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    borderRadius: 6,
                    background: severityColors[finding.severity] || "var(--md-outline)",
                    color: finding.severity === "critical" || finding.severity === "high"
                      ? "#fff"
                      : finding.severity === "medium"
                      ? "var(--md-on-primary)"
                      : "var(--md-on-surface)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {finding.severity}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 6px",
                    borderRadius: 6,
                    background: "var(--md-surface-container)",
                    color: "var(--md-on-surface-variant)",
                  }}
                >
                  {categoryLabels[finding.category] || finding.category}
                </span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
                  {finding.title}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--md-on-surface-variant)",
                    fontFamily: "var(--md-font-mono)",
                  }}
                >
                  {finding.file_path}:{finding.line_number}
                </span>
                <span style={{ fontSize: 12 }}>
                  {expanded.has(finding.id) ? "▼" : "▶"}
                </span>
              </button>

              {expanded.has(finding.id) && (
                <div
                  style={{
                    padding: "0 16px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)" }}>
                    {finding.description}
                  </div>

                  {finding.code_snippet && (
                    <pre
                      style={{
                        padding: 12,
                        background: "var(--md-surface-container)",
                        borderRadius: 8,
                        fontSize: 12,
                        fontFamily: "var(--md-font-mono)",
                        color: "var(--md-error)",
                        overflow: "auto",
                        margin: 0,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {finding.code_snippet}
                    </pre>
                  )}

                  <div
                    style={{
                      padding: 12,
                      background: "rgba(129, 199, 132, 0.1)",
                      borderRadius: 8,
                      borderLeft: "3px solid var(--md-safe)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--md-safe)",
                        marginBottom: 4,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Recommendation
                    </div>
                    <div style={{ fontSize: 13, color: "var(--md-on-surface)" }}>
                      {finding.recommendation}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
