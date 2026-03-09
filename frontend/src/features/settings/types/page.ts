import type { GitHubRepo, GitHubUser, SelectedProject } from "../../supply-chain/types";

export interface SettingsPageProps {
  user: GitHubUser | null;
  onConnect: (user: GitHubUser) => void;
  onDisconnect: () => void;
  selectedProject: SelectedProject;
  onSelectProject: (project: SelectedProject) => void;
  adkKeySet: boolean;
  adkKeyPreview: string;
  onAdkKeyChange: (keySet: boolean, preview: string) => void;
  geminiModel: string;
  onModelChange: (model: string) => void;
}

export interface SettingsMessage {
  text: string;
  error: boolean;
}

export interface SettingsDataState {
  availableModels: string[];
  inputKey: string;
  message: SettingsMessage | null;
  modelLoading: boolean;
  repos: GitHubRepo[];
  saving: boolean;
  testing: boolean;
}
