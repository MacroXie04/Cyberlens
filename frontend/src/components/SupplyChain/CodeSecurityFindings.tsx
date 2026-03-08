import { useState, useMemo } from "react";
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

type SeverityFilter = "all" | "critical" | "high" | "medium" | "low" | "info";

const SEVERITY_FILTERS: SeverityFilter[] = [
  "all",
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

/** Detect whether a snippet already has embedded line numbers like "42 |" or "42:" */
function hasEmbeddedLineNumbers(snippet: string): boolean {
  const lines = snippet.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return false;
  const numbered = lines.filter((l) => /^\s*\d+\s*[|:]/.test(l));
  return numbered.length >= lines.length * 0.6;
}

/** Parse a code snippet into lines with optional line numbers */
function parseSnippetLines(
  snippet: string,
  baseLineNumber: number
): { lineNum: number; text: string }[] {
  const raw = snippet.split("\n");
  if (hasEmbeddedLineNumbers(snippet)) {
    return raw.map((line) => {
      const match = line.match(/^\s*(\d+)\s*[|:]\s?(.*)/);
      if (match) {
        return { lineNum: parseInt(match[1], 10), text: match[2] };
      }
      return { lineNum: 0, text: line };
    });
  }
  const start = baseLineNumber > 0 ? baseLineNumber : 1;
  return raw.map((line, i) => ({ lineNum: start + i, text: line }));
}

export default function CodeSecurityFindings({ findings }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [groupByFile, setGroupByFile] = useState(false);

  const sorted = useMemo(
    () =>
      [...findings].sort(
        (a, b) =>
          (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5)
      ),
    [findings]
  );

  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of findings) {
      counts[f.severity] = (counts[f.severity] || 0) + 1;
    }
    return counts;
  }, [findings]);

  const filtered = useMemo(
    () =>
      severityFilter === "all"
        ? sorted
        : sorted.filter((f) => f.severity === severityFilter),
    [sorted, severityFilter]
  );

  const grouped = useMemo(() => {
    if (!groupByFile) return null;
    const map = new Map<string, CodeFinding[]>();
    for (const f of filtered) {
      const arr = map.get(f.file_path) || [];
      arr.push(f);
      map.set(f.file_path, arr);
    }
    return map;
  }, [filtered, groupByFile]);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(filtered.map((f) => f.id)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  function renderFindingCard(finding: CodeFinding) {
    const isExpanded = expanded.has(finding.id);
    const snippetLines = finding.code_snippet
      ? parseSnippetLines(finding.code_snippet, finding.line_number)
      : [];
    const maxLineNum =
      snippetLines.length > 0
        ? Math.max(...snippetLines.map((l) => l.lineNum))
        : 0;
    const gutterWidth = `${String(maxLineNum).length + 1}ch`;

    return (
      <div
        key={finding.id}
        style={{
          background: "var(--md-surface-container-high)",
          borderRadius: "var(--md-radius-list-item)",
          borderLeft: `3px solid ${severityColors[finding.severity] || "var(--md-outline)"}`,
          overflow: "hidden",
        }}
      >
        {/* Header row */}
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
              background:
                severityColors[finding.severity] || "var(--md-outline)",
              color:
                finding.severity === "critical" || finding.severity === "high"
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
          <span style={{ fontSize: 12 }}>{isExpanded ? "\u25BC" : "\u25B6"}</span>
        </button>

        {/* Expanded detail */}
        {isExpanded && (
          <div
            style={{
              padding: "0 16px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Description */}
            <div
              style={{ fontSize: 13, color: "var(--md-on-surface-variant)" }}
            >
              {finding.description}
            </div>

            {/* Code block with line numbers */}
            {snippetLines.length > 0 && (
              <div
                style={{
                  background: "var(--md-surface-container)",
                  borderRadius: 8,
                  overflow: "auto",
                  margin: 0,
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    padding: 0,
                    fontSize: 12,
                    fontFamily: "var(--md-font-mono)",
                    lineHeight: 1.6,
                  }}
                >
                  {snippetLines.map((line, i) => {
                    const isVulnerable = line.lineNum === finding.line_number;
                    return (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          background: isVulnerable
                            ? "rgba(198,40,40,0.12)"
                            : "transparent",
                          borderLeft: isVulnerable
                            ? "3px solid var(--md-error)"
                            : "3px solid transparent",
                          paddingRight: 12,
                        }}
                      >
                        <span
                          style={{
                            width: gutterWidth,
                            minWidth: gutterWidth,
                            textAlign: "right",
                            paddingRight: 8,
                            paddingLeft: 8,
                            color: isVulnerable
                              ? "var(--md-error)"
                              : "var(--md-on-surface-variant)",
                            opacity: isVulnerable ? 1 : 0.5,
                            userSelect: "none",
                            flexShrink: 0,
                          }}
                        >
                          {line.lineNum > 0 ? line.lineNum : ""}
                        </span>
                        <span
                          style={{
                            color: isVulnerable
                              ? "var(--md-on-surface)"
                              : "var(--md-on-surface-variant)",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          {line.text}
                        </span>
                      </div>
                    );
                  })}
                </pre>
              </div>
            )}

            {/* Why This Is Vulnerable */}
            {finding.explanation && (
              <div
                style={{
                  padding: 12,
                  background: "rgba(198,40,40,0.06)",
                  borderRadius: 8,
                  borderLeft: "3px solid var(--md-error)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--md-error)",
                    marginBottom: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Why This Is Vulnerable
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--md-on-surface)",
                    lineHeight: 1.5,
                  }}
                >
                  {finding.explanation}
                </div>
              </div>
            )}

            {/* Recommendation */}
            {finding.recommendation && (
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
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--md-on-surface)",
                    lineHeight: 1.5,
                  }}
                >
                  {finding.recommendation}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
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
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* Expand/Collapse */}
          {filtered.length > 0 && (
            <>
              <button
                onClick={expandAll}
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: "var(--md-surface-container-high)",
                  color: "var(--md-on-surface-variant)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: "var(--md-surface-container-high)",
                  color: "var(--md-on-surface-variant)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Collapse All
              </button>
            </>
          )}
          {/* Group by file toggle */}
          <button
            onClick={() => setGroupByFile((v) => !v)}
            style={{
              fontSize: 11,
              padding: "3px 8px",
              borderRadius: 6,
              background: groupByFile
                ? "var(--md-primary)"
                : "var(--md-surface-container-high)",
              color: groupByFile
                ? "var(--md-on-primary)"
                : "var(--md-on-surface-variant)",
              border: "none",
              cursor: "pointer",
            }}
          >
            Group by File
          </button>
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

      {/* Severity filter bar */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {SEVERITY_FILTERS.map((sev) => {
          const count = sev === "all" ? findings.length : (severityCounts[sev] || 0);
          const isActive = severityFilter === sev;
          return (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 12,
                background: isActive
                  ? "var(--md-primary)"
                  : "var(--md-surface-container-high)",
                color: isActive
                  ? "var(--md-on-primary)"
                  : "var(--md-on-surface-variant)",
                border: "none",
                cursor: "pointer",
                fontWeight: isActive ? 600 : 400,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ textTransform: "capitalize" }}>{sev}</span>
              <span
                style={{
                  fontSize: 10,
                  padding: "0 4px",
                  borderRadius: 6,
                  background: isActive
                    ? "rgba(255,255,255,0.2)"
                    : "var(--md-surface-container)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Findings list */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 24,
            color: "var(--md-on-surface-variant)",
            fontSize: 14,
          }}
        >
          {findings.length === 0
            ? "No code security issues found"
            : "No findings match the selected filter"}
        </div>
      ) : grouped ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {Array.from(grouped.entries()).map(([filePath, fileFindings]) => (
            <div key={filePath}>
              <div
                style={{
                  fontSize: 12,
                  fontFamily: "var(--md-font-mono)",
                  color: "var(--md-on-surface-variant)",
                  padding: "6px 0",
                  borderBottom:
                    "1px solid var(--md-surface-container-highest)",
                  marginBottom: 8,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{filePath}</span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "1px 6px",
                    borderRadius: 6,
                    background: "var(--md-surface-container-high)",
                  }}
                >
                  {fileFindings.length}{" "}
                  {fileFindings.length === 1 ? "finding" : "findings"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {fileFindings.map((f) => renderFindingCard(f))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((finding) => renderFindingCard(finding))}
        </div>
      )}
    </div>
  );
}
