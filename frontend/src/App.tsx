import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./components/Layout/DashboardLayout";
import LiveMonitorPage from "./pages/LiveMonitorPage";
import SupplyChainPage from "./pages/SupplyChainPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import {
  getGitHubStatus,
  getSettings,
  getMe,
  logout as apiLogout,
  setMonitorBaseUrl,
} from "./services/api";
import type { AuthUser, GitHubUser, SelectedProject } from "./types";

type Tab = "monitor" | "supply-chain" | "settings";

function Dashboard({
  authUser,
  onLogout,
}: {
  authUser: AuthUser;
  onLogout: () => void;
}) {
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

  useEffect(() => {
    setMonitorBaseUrl(cloudRunUrl);
    if (cloudRunUrl) {
      sessionStorage.setItem("cloudRunUrl", cloudRunUrl);
    } else {
      sessionStorage.removeItem("cloudRunUrl");
    }
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

  const handleModelChange = useCallback((model: string) => {
    setGeminiModel(model);
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
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          selectedProject={selectedProject}
          onSelectProject={handleSelectProject}
          adkKeySet={adkKeySet}
          adkKeyPreview={adkKeyPreview}
          onAdkKeyChange={handleAdkKeyChange}
          geminiModel={geminiModel}
          onModelChange={handleModelChange}
          cloudRunUrl={cloudRunUrl}
          onCloudRunConnect={handleCloudRunConnect}
          onCloudRunDisconnect={handleCloudRunDisconnect}
        />
      )}
    </DashboardLayout>
  );
}

function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((data) => {
        if (data.authenticated && data.user) {
          setAuthUser(data.user);
        }
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, []);

  const handleAuth = useCallback((user: AuthUser) => {
    setAuthUser(user);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // ignore
    }
    setAuthUser(null);
  }, []);

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--md-surface)",
          color: "var(--md-on-surface-variant)",
          fontSize: 14,
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          authUser ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage onAuth={handleAuth} />
          )
        }
      />
      <Route
        path="/register"
        element={
          authUser ? (
            <Navigate to="/" replace />
          ) : (
            <RegisterPage onAuth={handleAuth} />
          )
        }
      />
      <Route
        path="/*"
        element={
          authUser ? (
            <Dashboard authUser={authUser} onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;
