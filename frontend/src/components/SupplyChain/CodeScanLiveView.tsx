import { useEffect, useRef } from "react";

import type { AdkTraceEvent, CodeScanStreamEvent } from "../../types";

import CodeScanAgentRequestsCompact from "./CodeScanAgentRequestsCompact";
import CodeScanFileList from "./CodeScanFileList";
import { useCodeScanLiveState } from "./useCodeScanLiveState";

interface Props {
  streamEvents: CodeScanStreamEvent[];
  agentRequests?: AdkTraceEvent[];
}

export default function CodeScanLiveView({ streamEvents, agentRequests }: Props) {
  const outputRef = useRef<HTMLDivElement>(null);
  const { aiOutput, currentFile, fileIndex, files, filesScanned, totalFiles } =
    useCodeScanLiveState(streamEvents);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [aiOutput]);

  const progress = totalFiles > 0 ? Math.round((filesScanned / totalFiles) * 100) : 0;
  const isRunning = Boolean(currentFile);
  const statusText = isRunning
    ? "Analyzing"
    : totalFiles > 0 && filesScanned >= totalFiles
      ? "Analysis complete"
      : "Preparing analysis";

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: 16, fontWeight: 500, color: "var(--md-on-surface)", margin: "0 0 16px 0" }}>
        Code Security Scan
      </h3>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13, color: "var(--md-on-surface-variant)" }}>
        <div
          style={{
            width: 14,
            height: 14,
            border: isRunning ? "2px solid var(--md-primary)" : "2px solid var(--md-outline)",
            borderTopColor: isRunning ? "transparent" : "var(--md-outline)",
            borderRadius: "50%",
            animation: isRunning ? "spin 0.8s linear infinite" : "none",
            background: !isRunning && totalFiles > 0 && filesScanned >= totalFiles ? "var(--md-safe)" : "transparent",
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 500, color: "var(--md-on-surface)" }}>
          {statusText} <span style={{ fontFamily: "var(--md-font-mono)", fontSize: 12 }}>{currentFile || (totalFiles > 0 && filesScanned >= totalFiles ? "completed" : "...")}</span>
        </span>
        {totalFiles > 0 && <span style={{ marginLeft: "auto", fontSize: 12 }}>({fileIndex + 1}/{totalFiles})</span>}
      </div>

      <div style={{ height: 6, borderRadius: 3, background: "var(--md-surface-container-high)", marginBottom: 16, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "var(--md-primary)",
            borderRadius: 3,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      <div
        ref={outputRef}
        style={{
          background: "var(--md-surface-container)",
          borderRadius: 8,
          padding: 12,
          fontSize: 12,
          fontFamily: "var(--md-font-mono)",
          color: "var(--md-on-surface-variant)",
          maxHeight: 200,
          overflowY: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          marginBottom: 16,
          minHeight: 60,
          lineHeight: 1.5,
        }}
      >
        {aiOutput || "Waiting for AI analysis..."}
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: 14,
            background: "var(--md-primary)",
            marginLeft: 2,
            animation: "blink 1s step-end infinite",
            verticalAlign: "text-bottom",
          }}
        />
      </div>

      <CodeScanFileList files={files} />

      {agentRequests && agentRequests.length > 0 && (
        <CodeScanAgentRequestsCompact requests={agentRequests} />
      )}

      <style>{`
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
