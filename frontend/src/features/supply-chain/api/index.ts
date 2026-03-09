import { fetchJson, getLocalBaseUrl } from "../../../shared/api/client";
import type {
  AdkTraceSnapshot,
  AiReport,
  CodeFinding,
  GitHubRepo,
  GitHubScan,
  GitHubScanHistoryItem,
  GitHubUser,
} from "../types";

const LOCAL_BASE = getLocalBaseUrl();

export const getGitHubStatus = () =>
  fetchJson<{ connected: boolean; user?: GitHubUser }>(`${LOCAL_BASE}/github/status/`);

export const connectGitHub = (token: string) =>
  fetchJson<GitHubUser>(`${LOCAL_BASE}/github/connect/`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });

export const disconnectGitHub = () =>
  fetchJson<{ status: string }>(`${LOCAL_BASE}/github/disconnect/`, {
    method: "DELETE",
  });

export const getRepos = () => fetchJson<GitHubRepo[]>(`${LOCAL_BASE}/github/repos/`);

export const triggerScan = (repo: string, scanMode: "fast" | "full" = "fast") =>
  fetchJson<GitHubScan>(`${LOCAL_BASE}/github/scan/`, {
    method: "POST",
    body: JSON.stringify({ repo, scan_mode: scanMode }),
  });

export const getScanHistory = (repo: string) =>
  fetchJson<GitHubScanHistoryItem[]>(
    `${LOCAL_BASE}/github/scans/?repo=${encodeURIComponent(repo)}`
  );

export const getScanResults = (id: number) =>
  fetchJson<GitHubScan>(`${LOCAL_BASE}/github/scan/${id}/`);

export const getAiReport = (id: number) =>
  fetchJson<AiReport>(`${LOCAL_BASE}/github/scan/${id}/ai-report/`);

export const getCodeFindings = (id: number) =>
  fetchJson<CodeFinding[]>(`${LOCAL_BASE}/github/scan/${id}/code-findings/`);

export const getAdkTraceSnapshot = (id: number) =>
  fetchJson<AdkTraceSnapshot>(`${LOCAL_BASE}/github/scan/${id}/adk-trace/`);
