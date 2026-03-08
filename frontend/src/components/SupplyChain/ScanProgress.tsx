const STEPS = [
  { key: "fetching", label: "Fetching files" },
  { key: "parsing", label: "Parsing dependencies" },
  { key: "scanning", label: "Vulnerability scan" },
  { key: "analyzing", label: "AI assessment" },
  { key: "code_scan", label: "Code security" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

interface Props {
  currentStep: StepKey | "starting" | "completed" | "failed" | "";
  message: string;
  codeScanDetail?: string;
}

export default function ScanProgress({ currentStep, message, codeScanDetail }: Props) {
  if (!currentStep && !message) return null;

  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);
  const isCompleted = currentStep === "completed";
  const isFailed = currentStep === "failed";

  return (
    <div
      className="card"
      style={{ padding: 20 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {!isCompleted && !isFailed && (
          <div
            style={{
              width: 16,
              height: 16,
              border: "2px solid var(--md-primary)",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
        )}
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: isFailed
              ? "var(--md-error)"
              : isCompleted
                ? "var(--md-safe)"
                : "var(--md-primary)",
          }}
        >
          {message || "Starting scan..."}
        </span>
      </div>

      {/* Step indicators */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {STEPS.map((step, i) => {
          let status: "done" | "active" | "pending";
          if (isCompleted) {
            status = "done";
          } else if (isFailed) {
            status = i < currentIdx ? "done" : i === currentIdx ? "active" : "pending";
          } else if (i < currentIdx) {
            status = "done";
          } else if (i === currentIdx) {
            status = "active";
          } else {
            status = "pending";
          }

          return (
            <div key={step.key} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Progress bar segment */}
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background:
                    status === "done"
                      ? "var(--md-primary)"
                      : status === "active"
                        ? "var(--md-primary)"
                        : "var(--md-outline-variant)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {status === "active" && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      height: "100%",
                      width: "40%",
                      background: "var(--md-on-primary)",
                      opacity: 0.4,
                      borderRadius: 2,
                      animation: "shimmer 1.2s ease-in-out infinite",
                    }}
                  />
                )}
              </div>

              {/* Label */}
              <span
                style={{
                  fontSize: 11,
                  color:
                    status === "done"
                      ? "var(--md-primary)"
                      : status === "active"
                        ? "var(--md-on-surface)"
                        : "var(--md-on-surface-variant)",
                  fontWeight: status === "active" ? 600 : 400,
                  textAlign: "center",
                }}
              >
                {step.key === "code_scan" && status === "active" && codeScanDetail
                  ? codeScanDetail
                  : step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
