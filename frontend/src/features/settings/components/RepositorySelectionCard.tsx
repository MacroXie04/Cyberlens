import type { GitHubRepo, SelectedProject } from "../../../types";

interface Props {
  onSelectProject: (project: SelectedProject) => void;
  repos: GitHubRepo[];
  selectedProject: SelectedProject;
}

export default function RepositorySelectionCard({
  onSelectProject,
  repos,
  selectedProject,
}: Props) {
  if (repos.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16, color: "var(--md-on-surface)" }}>
        Select Repository
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
        {repos.map((repo) => {
          const isSelected =
            selectedProject?.mode === "github" &&
            selectedProject.repo.full_name === repo.full_name;
          return (
            <button
              key={repo.full_name}
              onClick={() => onSelectProject({ mode: "github", repo })}
              style={repoButtonStyle(isSelected)}
            >
              <div style={{ fontWeight: 500 }}>{repo.name}</div>
              <div style={repoMetaStyle(isSelected)}>
                {repo.language || "Unknown"} &middot; {repo.private ? "Private" : "Public"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function repoButtonStyle(isSelected: boolean) {
  return {
    padding: "12px 16px",
    background: isSelected ? "var(--md-primary)" : "var(--md-surface-container-high)",
    border: isSelected ? "2px solid var(--md-primary)" : "1px solid var(--md-outline-variant)",
    borderRadius: "var(--md-radius-list-item)",
    color: isSelected ? "var(--md-on-primary)" : "var(--md-on-surface)",
    cursor: "pointer",
    textAlign: "left",
    fontSize: 14,
  } as const;
}

function repoMetaStyle(isSelected: boolean) {
  return {
    fontSize: 12,
    color: isSelected ? "var(--md-on-primary)" : "var(--md-on-surface-variant)",
    marginTop: 2,
  } as const;
}
