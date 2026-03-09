import GcpLoggingConfig from "../../../components/Settings/GcpLoggingConfig";
import type { SettingsPageProps } from "../types";
import GeminiSettingsCard from "../components/GeminiSettingsCard";
import RepoSourceCard from "../components/RepoSourceCard";
import RepositorySelectionCard from "../components/RepositorySelectionCard";
import SelectedProjectCard from "../components/SelectedProjectCard";
import { useSettingsData } from "../hooks/useSettingsData";

export default function SettingsPage({
  user,
  onConnect,
  onDisconnect,
  selectedProject,
  onSelectProject,
  adkKeySet,
  adkKeyPreview,
  onAdkKeyChange,
  geminiModel,
  onModelChange,
}: SettingsPageProps) {
  const settingsData = useSettingsData({
    keySet: adkKeySet,
    user,
    onAdkKeyChange,
    onModelChange,
  });

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--md-on-surface)", marginBottom: 8 }}>
        Settings
      </h2>
      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 500, color: "var(--md-on-surface)", marginBottom: 4 }}>
          GCP Cloud Logging
        </h3>
        <p style={{ fontSize: 13, color: "var(--md-on-surface-variant)", marginBottom: 16 }}>
          Connect Google Cloud so Live Monitor can discover Cloud Run services,
          read Cloud Logging, and fetch Cloud Monitoring metrics. Recommended
          roles: <code>roles/logging.viewer</code>, <code>roles/monitoring.viewer</code>, and{" "}
          <code>roles/run.viewer</code>. Also ensure the Cloud Run Admin API and
          Cloud Monitoring API are enabled.
        </p>
        <GcpLoggingConfig />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <GeminiSettingsCard
          availableModels={settingsData.availableModels}
          geminiModel={geminiModel}
          inputKey={settingsData.inputKey}
          keyPreview={adkKeyPreview}
          keySet={adkKeySet}
          message={settingsData.message}
          modelLoading={settingsData.modelLoading}
          onInputKeyChange={settingsData.setInputKey}
          onModelChange={settingsData.handleModelSelection}
          onSaveKey={settingsData.handleSaveKey}
          onTestKey={settingsData.handleTestKey}
          saving={settingsData.saving}
          testing={settingsData.testing}
        />
        <RepoSourceCard
          user={user}
          onConnect={onConnect}
          onDisconnect={() => {
            onDisconnect();
            settingsData.clearRepos();
          }}
        />
      </div>
      {user ? (
        <RepositorySelectionCard
          repos={settingsData.repos}
          selectedProject={selectedProject}
          onSelectProject={onSelectProject}
        />
      ) : null}
      <SelectedProjectCard selectedProject={selectedProject} />
    </div>
  );
}
