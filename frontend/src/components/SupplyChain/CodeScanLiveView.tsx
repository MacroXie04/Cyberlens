import { useRef, useEffect, useState, useCallback } from "react";
import type { CodeScanStreamEvent } from "../../types";

interface Props {
  streamEvents: CodeScanStreamEvent[];
}

interface FileStatus {
  path: string;
  status: "pending" | "scanning" | "done" | "error";
  findingsCount?: number;
}

export default function CodeScanLiveView({ streamEvents }: Props) {
  const outputRef = useRef<HTMLDivElement>(null);
  const [aiOutput, setAiOutput] = useState("");
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [currentFile, setCurrentFile] = useState("");
  const [fileIndex, setFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [tokens, setTokens] = useState({ input: 0, output: 0, total: 0 });
  const [filesScanned, setFilesScanned] = useState(0);

  // Batch chunk text updates via requestAnimationFrame
  const pendingChunksRef = useRef<string[]>([]);
  const rafIdRef = useRef<number | null>(null);

  const flushChunks = useCallback(() => {
    if (pendingChunksRef.current.length > 0) {
      const text = pendingChunksRef.current.join("");
      pendingChunksRef.current = [];
      setAiOutput((prev) => prev + text);
    }
    rafIdRef.current = null;
  }, []);

  // Process stream events
  const lastProcessedRef = useRef(0);
  useEffect(() => {
    const newEvents = streamEvents.slice(lastProcessedRef.current);
    lastProcessedRef.current = streamEvents.length;

    for (const event of newEvents) {
      switch (event.type) {
        case "scan_start":
          setTotalFiles(event.total_files || 0);
          setAiOutput("");
          setFiles([]);
          break;

        case "file_start":
          setCurrentFile(event.file_path || "");
          setFileIndex(event.file_index || 0);
          setAiOutput("");
          setFiles((prev) => {
            const exists = prev.find((f) => f.path === event.file_path);
            if (exists) {
              return prev.map((f) =>
                f.path === event.file_path ? { ...f, status: "scanning" as const } : f
              );
            }
            return [...prev, { path: event.file_path || "", status: "scanning" as const }];
          });
          break;

        case "chunk":
          pendingChunksRef.current.push(event.text || "");
          if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(flushChunks);
          }
          break;

        case "file_complete":
          setFiles((prev) =>
            prev.map((f) =>
              f.path === event.file_path
                ? { ...f, status: "done" as const, findingsCount: event.findings_count }
                : f
            )
          );
          break;

        case "file_error":
          setFiles((prev) =>
            prev.map((f) =>
              f.path === event.file_path ? { ...f, status: "error" as const } : f
            )
          );
          break;

        case "token_update":
          setTokens({
            input: event.input_tokens || 0,
            output: event.output_tokens || 0,
            total: event.total_tokens || 0,
          });
          setFilesScanned(event.files_scanned || 0);
          break;
      }
    }
  }, [streamEvents, flushChunks]);

  // Auto-scroll AI output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [aiOutput]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const progress = totalFiles > 0 ? Math.round((filesScanned / totalFiles) * 100) : 0;

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: "var(--md-on-surface)",
          margin: "0 0 16px 0",
        }}
      >
        Code Security Scan
      </h3>

      {/* Current file + progress */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          fontSize: 13,
          color: "var(--md-on-surface-variant)",
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            border: "2px solid var(--md-primary)",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 500, color: "var(--md-on-surface)" }}>
          Analyzing{" "}
          <span style={{ fontFamily: "var(--md-font-mono)", fontSize: 12 }}>
            {currentFile || "..."}
          </span>
        </span>
        {totalFiles > 0 && (
          <span style={{ marginLeft: "auto", fontSize: 12 }}>
            ({fileIndex + 1}/{totalFiles})
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: "var(--md-surface-container-high)",
          marginBottom: 16,
          overflow: "hidden",
        }}
      >
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

      {/* AI output stream */}
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

      {/* File list */}
      {files.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--md-on-surface-variant)",
              marginBottom: 8,
            }}
          >
            Files:
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {files.map((file) => (
              <span
                key={file.path}
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 6,
                  fontFamily: "var(--md-font-mono)",
                  background:
                    file.status === "done"
                      ? "rgba(129, 199, 132, 0.15)"
                      : file.status === "error"
                        ? "rgba(239, 83, 80, 0.15)"
                        : file.status === "scanning"
                          ? "rgba(66, 165, 245, 0.15)"
                          : "var(--md-surface-container-high)",
                  color:
                    file.status === "done"
                      ? "var(--md-safe)"
                      : file.status === "error"
                        ? "var(--md-error)"
                        : file.status === "scanning"
                          ? "var(--md-primary)"
                          : "var(--md-on-surface-variant)",
                }}
              >
                {file.status === "done"
                  ? "\u2713"
                  : file.status === "error"
                    ? "\u2717"
                    : file.status === "scanning"
                      ? "\u23F3"
                      : "\u25CB"}{" "}
                {file.path.split("/").pop()}
                {file.status === "done" && file.findingsCount
                  ? ` (${file.findingsCount})`
                  : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Token counter */}
      <div
        style={{
          display: "flex",
          gap: 16,
          fontSize: 12,
          color: "var(--md-on-surface-variant)",
          padding: "8px 12px",
          background: "var(--md-surface-container-high)",
          borderRadius: 8,
        }}
      >
        <span>
          Tokens:{" "}
          <strong style={{ color: "var(--md-on-surface)" }}>
            {tokens.input.toLocaleString()}
          </strong>{" "}
          in
        </span>
        <span>
          <strong style={{ color: "var(--md-on-surface)" }}>
            {tokens.output.toLocaleString()}
          </strong>{" "}
          out
        </span>
        <span>
          <strong style={{ color: "var(--md-on-surface)" }}>
            {tokens.total.toLocaleString()}
          </strong>{" "}
          total
        </span>
      </div>

      <style>{`
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
