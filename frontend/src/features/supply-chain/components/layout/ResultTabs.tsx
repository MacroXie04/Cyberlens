type ResultTab = "overview" | "architecture" | "dependencies" | "vulnerabilities" | "code" | "pipeline";

function TabButton({ active, onClick, label, count, alert }: { active: boolean; onClick: () => void; label: string; count?: number; alert?: boolean; }) {
  return (
    <button onClick={onClick} style={{ padding: "12px 20px", border: "none", borderBottom: active ? "2px solid var(--md-primary)" : "2px solid transparent", background: "transparent", color: active ? "var(--md-primary)" : "var(--md-on-surface-variant)", fontWeight: active ? 700 : 500, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s ease", fontFamily: "var(--md-font-body)" }}>
      {label}
      {count != null && <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 10, fontWeight: 700, background: alert ? "var(--md-error)" : active ? "var(--md-primary)" : "var(--md-surface-container-highest)", color: alert || active ? "#fff" : "var(--md-on-surface-variant)" }}>{count}</span>}
    </button>
  );
}

interface Props {
  codeMapNodeCount: number;
  dependenciesCount: number;
  eventsCount: number;
  findingsCount: number;
  hasPipelineError: boolean | undefined;
  onChange: (tab: ResultTab) => void;
  selected: ResultTab;
  totalVulns: number;
  urgentFindings: boolean;
}

export default function ResultTabs({ codeMapNodeCount, dependenciesCount, eventsCount, findingsCount, hasPipelineError, onChange, selected, totalVulns, urgentFindings }: Props) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--md-outline-variant)", flexWrap: "wrap" }}>
      <TabButton active={selected === "overview"} onClick={() => onChange("overview")} label="Overview" />
      <TabButton active={selected === "architecture"} onClick={() => onChange("architecture")} label="Architecture" count={codeMapNodeCount || undefined} />
      <TabButton active={selected === "dependencies"} onClick={() => onChange("dependencies")} label="Dependencies" count={dependenciesCount} />
      <TabButton active={selected === "vulnerabilities"} onClick={() => onChange("vulnerabilities")} label="Vulnerabilities" count={totalVulns} alert={totalVulns > 0} />
      <TabButton active={selected === "code"} onClick={() => onChange("code")} label="Code Security" count={findingsCount} alert={urgentFindings} />
      <TabButton active={selected === "pipeline"} onClick={() => onChange("pipeline")} label="ADK Pipeline" count={eventsCount} alert={hasPipelineError} />
    </div>
  );
}
