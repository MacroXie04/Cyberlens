interface Props {
  snippet: string;
  lineNumber: number;
  lines: Array<{ lineNum: number; text: string }>;
}

export default function CodeFindingSnippet({ snippet, lineNumber, lines }: Props) {
  if (!snippet || lines.length === 0) {
    return null;
  }

  const maxLineNum = Math.max(...lines.map((line) => line.lineNum), 0);
  const gutterWidth = `${String(maxLineNum).length + 1}ch`;

  return (
    <div style={{ background: "var(--md-surface-container)", borderRadius: 8, overflow: "auto", margin: 0 }}>
      <pre style={{ margin: 0, padding: 0, fontSize: 12, fontFamily: "var(--md-font-mono)", lineHeight: 1.6 }}>
        {lines.map((line, index) => {
          const isVulnerable = line.lineNum === lineNumber;
          return (
            <div key={index} style={{ display: "flex", background: isVulnerable ? "rgba(198,40,40,0.12)" : "transparent", borderLeft: isVulnerable ? "3px solid var(--md-error)" : "3px solid transparent", paddingRight: 12 }}>
              <span
                style={{
                  width: gutterWidth,
                  minWidth: gutterWidth,
                  textAlign: "right",
                  paddingRight: 8,
                  paddingLeft: 8,
                  color: isVulnerable ? "var(--md-error)" : "var(--md-on-surface-variant)",
                  opacity: isVulnerable ? 1 : 0.5,
                  userSelect: "none",
                  flexShrink: 0,
                }}
              >
                {line.lineNum > 0 ? line.lineNum : ""}
              </span>
              <span style={{ color: isVulnerable ? "var(--md-on-surface)" : "var(--md-on-surface-variant)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {line.text}
              </span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}
