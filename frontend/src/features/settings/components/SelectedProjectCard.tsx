import type { SelectedProject } from "../../../types";

interface Props {
  selectedProject: SelectedProject;
}

export default function SelectedProjectCard({ selectedProject }: Props) {
  if (selectedProject?.mode !== "github") {
    return null;
  }

  const details = [
    { label: "Language", value: selectedProject.repo.language || "—" },
    { label: "Stars", value: String(selectedProject.repo.stargazers_count) },
    { label: "Forks", value: String(selectedProject.repo.forks_count) },
    { label: "Open Issues", value: String(selectedProject.repo.open_issues_count) },
    { label: "Default Branch", value: selectedProject.repo.default_branch },
    { label: "Visibility", value: selectedProject.repo.private ? "Private" : "Public" },
    { label: "Last Updated", value: new Date(selectedProject.repo.updated_at).toLocaleDateString() },
  ];

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--md-on-surface)", marginBottom: 4 }}>
            {selectedProject.repo.full_name}
          </h3>
          {selectedProject.repo.description ? (
            <p style={{ fontSize: 13, color: "var(--md-on-surface-variant)", margin: 0 }}>
              {selectedProject.repo.description}
            </p>
          ) : null}
        </div>
        <a href={selectedProject.repo.html_url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          Open on GitHub
        </a>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
        {details.map((item) => (
          <div key={item.label} style={{ padding: "10px 14px", background: "var(--md-surface-container-high)", borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: "var(--md-on-surface-variant)", marginBottom: 2 }}>{item.label}</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--md-on-surface)" }}>{item.value}</div>
          </div>
        ))}
      </div>
      <div style={hintStyle}>
        Go to the <strong>Code Scan</strong> tab to scan this repository.
      </div>
    </div>
  );
}

const linkStyle = {
  padding: "6px 14px",
  borderRadius: "var(--md-radius-button)",
  border: "1px solid var(--md-outline-variant)",
  background: "transparent",
  color: "var(--md-on-surface)",
  fontSize: 12,
  fontWeight: 500,
  textDecoration: "none",
  whiteSpace: "nowrap",
} as const;

const hintStyle = {
  marginTop: 12,
  padding: "10px 14px",
  background: "rgba(129, 199, 132, 0.08)",
  borderRadius: 10,
  fontSize: 13,
  color: "var(--md-safe)",
} as const;
