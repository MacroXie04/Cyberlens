import type { HttpRequest } from "../../types";

interface Props {
  requests: HttpRequest[];
  onSelect: (req: HttpRequest) => void;
}

function getThreatBadgeClass(level: string | undefined): string {
  switch (level) {
    case "malicious":
      return "badge badge--malicious";
    case "suspicious":
      return "badge badge--suspicious";
    default:
      return "badge badge--safe";
  }
}

export default function LiveRequestStream({ requests, onSelect }: Props) {
  return (
    <div className="card scan-line" style={{ minHeight: 400 }}>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 500,
          marginBottom: 16,
          color: "var(--md-on-surface)",
        }}
      >
        Live Request Stream
      </h3>
      <div
        style={{
          maxHeight: 340,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {requests.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: "var(--md-on-surface-variant)",
            }}
          >
            Waiting for incoming requests...
          </div>
        ) : (
          requests.map((req) => (
            <div
              key={req.id}
              onClick={() => onSelect(req)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
                background: "var(--md-surface-container-high)",
                borderRadius: "var(--md-radius-list-item)",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background =
                  "var(--md-surface-container-highest)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  "var(--md-surface-container-high)")
              }
            >
              <span
                className={getThreatBadgeClass(req.analysis?.threat_level)}
              >
                {req.analysis?.threat_level || "pending"}
              </span>
              <span className="mono" style={{ color: "var(--md-primary)", minWidth: 50 }}>
                {req.method}
              </span>
              <span
                className="mono"
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {req.path}
              </span>
              <span
                className="mono"
                style={{ color: "var(--md-on-surface-variant)", fontSize: 12 }}
              >
                {req.ip}
              </span>
              <span
                style={{ color: "var(--md-on-surface-variant)", fontSize: 12 }}
              >
                {new Date(req.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
