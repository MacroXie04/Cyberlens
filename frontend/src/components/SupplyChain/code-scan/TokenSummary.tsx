interface Props {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  filesScanned: number;
  filesTotal: number;
}

export default function TokenSummary({
  inputTokens,
  outputTokens,
  totalTokens,
  filesScanned,
  filesTotal,
}: Props) {
  return (
    <div
      className="card"
      style={{
        padding: 16,
        display: "flex",
        alignItems: "center",
        gap: 24,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--md-on-surface)",
        }}
      >
        Code Scan Summary
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--md-on-surface-variant)" }}>
        <span>
          Files:{" "}
          <strong style={{ color: "var(--md-on-surface)" }}>
            {filesScanned}/{filesTotal}
          </strong>
        </span>
        <span style={{ color: "var(--md-outline-variant)" }}>|</span>
        <span>
          Input:{" "}
          <strong style={{ color: "var(--md-on-surface)" }}>
            {inputTokens.toLocaleString()}
          </strong>
        </span>
        <span>
          Output:{" "}
          <strong style={{ color: "var(--md-on-surface)" }}>
            {outputTokens.toLocaleString()}
          </strong>
        </span>
        <span>
          Total:{" "}
          <strong style={{ color: "var(--md-primary)" }}>
            {totalTokens.toLocaleString()}
          </strong>{" "}
          tokens
        </span>
      </div>
    </div>
  );
}
