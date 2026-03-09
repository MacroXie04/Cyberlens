import { fetchJson, getLocalBaseUrl } from "../../../shared/api/client";
import type { GcpSettings } from "../types";

const LOCAL_BASE = getLocalBaseUrl();

type SettingsResponse = {
  google_api_key_set: boolean;
  google_api_key_preview: string;
  gemini_model: string;
};

export const getSettings = () => fetchJson<SettingsResponse>(`${LOCAL_BASE}/settings/`);

export const updateSettings = (data: {
  google_api_key?: string;
  gemini_model?: string;
}) =>
  fetchJson<SettingsResponse>(`${LOCAL_BASE}/settings/`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const getAvailableModels = () =>
  fetchJson<{ models: string[] }>(`${LOCAL_BASE}/settings/models/`);

export const testApiKey = () =>
  fetchJson<{ success: boolean; models?: string[]; error?: string }>(
    `${LOCAL_BASE}/settings/test-key/`,
    { method: "POST" }
  );

export const getGcpSettings = () => fetchJson<GcpSettings>(`${LOCAL_BASE}/settings/gcp/`);

export const updateGcpSettings = (data: {
  gcp_project_id?: string;
  gcp_service_name?: string;
  gcp_region?: string;
  gcp_service_account_key?: string;
}) =>
  fetchJson<GcpSettings>(`${LOCAL_BASE}/settings/gcp/`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
