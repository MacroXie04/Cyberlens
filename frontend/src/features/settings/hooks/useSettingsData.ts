import { useEffect, useState } from "react";

import { getAvailableModels, getRepos, testApiKey, updateSettings } from "../../../services/api";
import type { GitHubRepo, GitHubUser } from "../../../types";
import type { SettingsMessage } from "../types";

interface Props {
  keySet: boolean;
  user: GitHubUser | null;
  onAdkKeyChange: (keySet: boolean, preview: string) => void;
  onModelChange: (model: string) => void;
}

export function useSettingsData({ keySet, user, onAdkKeyChange, onModelChange }: Props) {
  const [inputKey, setInputKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<SettingsMessage | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);

  useEffect(() => {
    if (!keySet) {
      setAvailableModels([]);
      return;
    }
    setModelLoading(true);
    getAvailableModels()
      .then((data) => setAvailableModels(data.models))
      .catch(() => {})
      .finally(() => setModelLoading(false));
  }, [keySet]);

  useEffect(() => {
    if (!user) {
      setRepos([]);
      return;
    }
    getRepos().then(setRepos).catch(() => {});
  }, [user]);

  async function handleSaveKey() {
    if (!inputKey.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const data = await updateSettings({ google_api_key: inputKey.trim() });
      onAdkKeyChange(data.google_api_key_set, data.google_api_key_preview);
      setInputKey("");
      setMessage({ text: "Google ADK key saved successfully", error: false });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Failed to save",
        error: true,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleModelSelection(model: string) {
    try {
      await updateSettings({ gemini_model: model });
      onModelChange(model);
    } catch {
      // ignore
    }
  }

  async function handleTestKey() {
    setTesting(true);
    setMessage(null);
    try {
      const data = await testApiKey();
      setMessage(
        data.success
          ? {
              text: `Key is valid — connected to Gemini API (${data.models?.length ?? 0} models available)`,
              error: false,
            }
          : { text: data.error || "Key validation failed", error: true }
      );
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Test failed",
        error: true,
      });
    } finally {
      setTesting(false);
    }
  }

  function clearRepos() {
    setRepos([]);
  }

  return {
    availableModels,
    clearRepos,
    handleModelSelection,
    handleSaveKey,
    handleTestKey,
    inputKey,
    message,
    modelLoading,
    repos,
    saving,
    setInputKey,
    testing,
  };
}
