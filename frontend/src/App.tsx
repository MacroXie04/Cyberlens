import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "./components/Layout/DashboardLayout";
import LiveMonitorPage from "./pages/LiveMonitorPage";
import SupplyChainPage from "./pages/SupplyChainPage";
import SettingsPage from "./pages/SettingsPage";
import { getGitHubStatus, getSettings, setMonitorBaseUrl } from "./services/api";
import type { GitHubUser, SelectedProject } from "./types";

type Tab = "monitor" | "supply-chain" | "settings";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(
    () => (sessionStorage.getItem("activeTab") as Tab) || "monitor"
  );
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [selectedProject, setSelectedProject] = useState<SelectedProject>(() => {
    try {
      const stored = sessionStorage.getItem("selectedProject");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [adkKeySet, setAdkKeySet] = useState(false);
  const [adkKeyPreview, setAdkKeyPreview] = useState("");
  const [cloudRunUrl, setCloudRunUrl] = useState<string | null>(
    () => sessionStorage.getItem("cloudRunUrl")
  );

  useEffect(() => {
    sessionStorage.setItem("activeTab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (selectedProject) {
      sessionStorage.setItem("selectedProject", JSON.stringify(selectedProject));
    } else {
      sessionStorage.removeItem("selectedProject");
    }
  }, [selectedProject]);

  // Sync Cloud Run URL to api module + sessionStorage
  useEffect(() => {
    setMonitorBaseUrl(cloudRunUrl);
    if (cloudRunUrl) {
      sessionStorage.setItem("cloudRunUrl", cloudRunUrl);
    } else {
      sessionStorage.removeItem("cloudRunUrl");
    }
  }, [cloudRunUrl]);

  // Restore state on mount
  useEffect(() => {
    getGitHubStatus().then((data) => {
      if (data.connected && data.user) setUser(data.user);
    }).catch(() => {});

    getSettings().then((data) => {
      setAdkKeySet(data.google_api_key_set);
      setAdkKeyPreview(data.google_api_key_preview);
    }).catch(() => {});
  }, []);

  const handleConnect = useCallback((userData: GitHubUser) => {
    setUser(userData);
  }, []);

  const handleDisconnect = useCallback(() => {
    setUser(null);
    setSelectedProject((prev) => (prev?.mode === "github" ? null : prev));
  }, []);

  const handleSelectProject = useCallback((project: SelectedProject) => {
    setSelectedProject(project);
  }, []);

  const handleAdkKeyChange = useCallback((keySet: boolean, preview: string) => {
    setAdkKeySet(keySet);
    setAdkKeyPreview(preview);
  }, []);

  const handleCloudRunConnect = useCallback((url: string) => {
    setCloudRunUrl(url);
  }, []);

  const handleCloudRunDisconnect = useCallback(() => {
    setCloudRunUrl(null);
  }, []);

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      selectedProject={selectedProject}
      adkKeySet={adkKeySet}
      cloudRunUrl={cloudRunUrl}
    >
      {activeTab === "monitor" ? (
        <LiveMonitorPage cloudRunUrl={cloudRunUrl} />
      ) : activeTab === "supply-chain" ? (
        <SupplyChainPage selectedProject={selectedProject} />
      ) : (
        <SettingsPage
          user={user}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          selectedProject={selectedProject}
          onSelectProject={handleSelectProject}
          adkKeySet={adkKeySet}
          adkKeyPreview={adkKeyPreview}
          onAdkKeyChange={handleAdkKeyChange}
          cloudRunUrl={cloudRunUrl}
          onCloudRunConnect={handleCloudRunConnect}
          onCloudRunDisconnect={handleCloudRunDisconnect}
        />
      )}
    </DashboardLayout>
  );
}

export default App;
