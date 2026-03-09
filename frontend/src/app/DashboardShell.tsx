import { useCallback, useEffect, useState } from "react";

import DashboardLayout from "../components/Layout/DashboardLayout";
import LiveMonitorPage from "../pages/LiveMonitorPage";
import SettingsPage from "../pages/SettingsPage";
import SupplyChainPage from "../pages/SupplyChainPage";
import { getGitHubStatus } from "../features/supply-chain/api";
import { getSettings } from "../features/settings/api";
import type { AuthUser } from "../features/auth/types";
import type { GitHubUser, SelectedProject } from "../features/supply-chain/types";
import { setMonitorBaseUrl } from "../shared/api/client";

type Tab = "monitor" | "supply-chain" | "settings";

interface Props {
  authUser: AuthUser;
  onLogout: () => void;
}

export default function DashboardShell({ authUser, onLogout }: Props) {
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
  const [geminiModel, setGeminiModel] = useState("");
  const [cloudRunUrl] = useState<string | null>(() => sessionStorage.getItem("cloudRunUrl"));

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

  useEffect(() => {
    setMonitorBaseUrl(cloudRunUrl);
    if (cloudRunUrl) {
      sessionStorage.setItem("cloudRunUrl", cloudRunUrl);
      return;
    }
    sessionStorage.removeItem("cloudRunUrl");
  }, [cloudRunUrl]);

  useEffect(() => {
    getGitHubStatus()
      .then((data) => {
        if (data.connected && data.user) setUser(data.user);
      })
      .catch(() => {});

    getSettings()
      .then((data) => {
        setAdkKeySet(data.google_api_key_set);
        setAdkKeyPreview(data.google_api_key_preview);
        setGeminiModel(data.gemini_model || "");
      })
      .catch(() => {});
  }, []);

  const handleDisconnect = useCallback(() => {
    setUser(null);
    setSelectedProject((previous) => (previous?.mode === "github" ? null : previous));
  }, []);

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      selectedProject={selectedProject}
      adkKeySet={adkKeySet}
      cloudRunUrl={cloudRunUrl}
      authUser={authUser}
      onLogout={onLogout}
    >
      {activeTab === "monitor" ? (
        <LiveMonitorPage cloudRunUrl={cloudRunUrl} />
      ) : activeTab === "supply-chain" ? (
        <SupplyChainPage selectedProject={selectedProject} />
      ) : (
        <SettingsPage
          user={user}
          onConnect={setUser}
          onDisconnect={handleDisconnect}
          selectedProject={selectedProject}
          onSelectProject={setSelectedProject}
          adkKeySet={adkKeySet}
          adkKeyPreview={adkKeyPreview}
          onAdkKeyChange={(keySet, preview) => {
            setAdkKeySet(keySet);
            setAdkKeyPreview(preview);
          }}
          geminiModel={geminiModel}
          onModelChange={setGeminiModel}
        />
      )}
    </DashboardLayout>
  );
}
