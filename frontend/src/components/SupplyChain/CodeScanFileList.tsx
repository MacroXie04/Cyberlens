import type { FileStatus } from "./useCodeScanLiveState";

interface Props {
  files: FileStatus[];
}

export default function CodeScanFileList({ files }: Props) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--md-on-surface-variant)", marginBottom: 8 }}>
        Files:
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
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
            {file.status === "done" ? "\u2713" : file.status === "error" ? "\u2717" : file.status === "scanning" ? "\u23F3" : "\u25CB"}{" "}
            {file.path.split("/").pop()}
            {file.status === "done" && file.findingsCount ? ` (${file.findingsCount})` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
