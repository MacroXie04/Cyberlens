import type { CodeMapData, CodeMapNode } from "../../../types";

interface Props {
  nodeId: string;
  data: CodeMapData;
  onNavigate: (nodeId: string) => void;
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  endpoint: "#041E49",
  view: "#c26401",
  service: "#B06000",
  model: "#137333",
  component: "#0b57d0",
  frontend_route: "#0B57D0",
  middleware: "#B06000",
  utility: "#5F6368",
};

function typeBadge(type: CodeMapNode["node_type"]) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 600,
        color: "#fff",
        background: TYPE_BADGE_COLORS[type] || "#5F6368",
        textTransform: "capitalize",
      }}
    >
      {type.replace("_", " ")}
    </span>
  );
}

export default function CodeMapDetail({ nodeId, data, onNavigate }: Props) {
  const node = data.nodes.find((n) => n.node_id === nodeId);
  if (!node) return null;

  const incoming = data.edges
    .filter((e) => e.target_node_id === nodeId)
    .map((e) => ({
      nodeId: e.source_node_id,
      type: e.edge_type,
      node: data.nodes.find((n) => n.node_id === e.source_node_id),
    }))
    .filter((e) => e.node);

  const outgoing = data.edges
    .filter((e) => e.source_node_id === nodeId)
    .map((e) => ({
      nodeId: e.target_node_id,
      type: e.edge_type,
      node: data.nodes.find((n) => n.node_id === e.target_node_id),
    }))
    .filter((e) => e.node);

  const sectionHeader: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--md-on-surface-variant)",
    marginBottom: 6,
    marginTop: 14,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };

  const linkStyle: React.CSSProperties = {
    padding: "4px 8px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "background 0.1s",
  };

  return (
    <div
      className="card"
      style={{
        padding: 18,
        minWidth: 280,
        maxHeight: 600,
        overflowY: "auto",
      }}
    >
      <div style={{ marginBottom: 8 }}>{typeBadge(node.node_type)}</div>
      <h4 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px", color: "var(--md-on-surface)", wordBreak: "break-word" }}>
        {node.label}
      </h4>
      {node.file_path && (
        <div style={{ fontSize: 12, color: "var(--md-on-surface-variant)", fontFamily: "var(--md-font-mono)", marginBottom: 4 }}>
          {node.file_path}
          {node.line_number > 0 && `:${node.line_number}`}
        </div>
      )}
      {node.http_methods.length > 0 && (
        <div style={{ fontSize: 12, color: "var(--md-primary)", fontWeight: 500, marginBottom: 4 }}>
          {node.http_methods.join(", ")}
        </div>
      )}

      {incoming.length > 0 && (
        <>
          <div style={sectionHeader}>Called by ({incoming.length})</div>
          {incoming.map((e) => (
            <div
              key={e.nodeId}
              style={linkStyle}
              onClick={() => onNavigate(e.nodeId)}
              onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.background = "var(--md-surface-container-highest)"; }}
              onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: 10, color: "var(--md-on-surface-variant)" }}>{e.type.replace("_", " ")}</span>
              <span style={{ fontWeight: 500 }}>{e.node!.label}</span>
            </div>
          ))}
        </>
      )}

      {outgoing.length > 0 && (
        <>
          <div style={sectionHeader}>Calls ({outgoing.length})</div>
          {outgoing.map((e) => (
            <div
              key={e.nodeId}
              style={linkStyle}
              onClick={() => onNavigate(e.nodeId)}
              onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.background = "var(--md-surface-container-highest)"; }}
              onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: 10, color: "var(--md-on-surface-variant)" }}>{e.type.replace("_", " ")}</span>
              <span style={{ fontWeight: 500 }}>{e.node!.label}</span>
            </div>
          ))}
        </>
      )}

      {incoming.length === 0 && outgoing.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--md-on-surface-variant)", marginTop: 12 }}>
          No connections found for this node.
        </div>
      )}
    </div>
  );
}
