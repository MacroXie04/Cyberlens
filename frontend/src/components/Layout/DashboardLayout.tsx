import type { ReactNode } from "react";
import { useSocket } from "../../hooks/useSocket";
import type { AuthUser, SelectedProject } from "../../types";
import DashboardHeader from "./DashboardHeader";

type Tab = "monitor" | "supply-chain" | "settings";

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  selectedProject: SelectedProject;
  adkKeySet: boolean;
  cloudRunUrl?: string | null;
  authUser?: AuthUser;
  onLogout?: () => void;
  children: ReactNode;
}

export default function DashboardLayout({
  activeTab,
  onTabChange,
  selectedProject,
  adkKeySet,
  cloudRunUrl,
  authUser,
  onLogout,
  children,
}: Props) {
  const { connected } = useSocket({}, cloudRunUrl);

  return (
    <div style={{ minHeight: "100vh" }}>
      <DashboardHeader
        activeTab={activeTab}
        onTabChange={onTabChange}
        selectedProject={selectedProject}
        adkKeySet={adkKeySet}
        cloudRunUrl={cloudRunUrl}
        connected={connected}
        authUser={authUser}
        onLogout={onLogout}
      />
      <main>{children}</main>
    </div>
  );
}
