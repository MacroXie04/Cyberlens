export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string;
}

export interface GitHubRepo {
  full_name: string;
  name: string;
  private: boolean;
  language: string | null;
  updated_at: string;
  description: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  html_url: string;
}

export type SelectedProject = { mode: "github"; repo: GitHubRepo } | null;
