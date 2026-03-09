import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import SettingsPage from "../pages/SettingsPage";
import { getAvailableModels, getRepos, testApiKey, updateSettings } from "../services/api";

vi.mock("../services/api", () => ({ updateSettings: vi.fn(), testApiKey: vi.fn(), getRepos: vi.fn(), getAvailableModels: vi.fn() }));
vi.mock("../components/SupplyChain/GitHubConnect", () => ({ default: () => <div data-testid="github-connect">GitHubConnect</div> }));
vi.mock("../components/Settings/GcpLoggingConfig", () => ({ default: () => <div data-testid="gcp-logging">GcpLoggingConfig</div> }));

const mockUpdateSettings = vi.mocked(updateSettings);
const mockTestApiKey = vi.mocked(testApiKey);
const mockGetAvailableModels = vi.mocked(getAvailableModels);
const mockGetRepos = vi.mocked(getRepos);

function renderSettings(props: Partial<Parameters<typeof SettingsPage>[0]> = {}) {
  return render(<MemoryRouter><SettingsPage user={null} onConnect={vi.fn()} onDisconnect={vi.fn()} selectedProject={null} onSelectProject={vi.fn()} adkKeySet={false} adkKeyPreview="" onAdkKeyChange={vi.fn()} geminiModel="" onModelChange={vi.fn()} {...props} /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRepos.mockResolvedValue([]);
  mockGetAvailableModels.mockResolvedValue({ models: [] });
});

describe("SettingsPage ADK card", () => {
  it("renders the settings heading and ADK card", () => {
    renderSettings();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Google Agent Development Kit (ADK)")).toBeInTheDocument();
    expect(screen.queryByText("Cloud Run Instance")).not.toBeInTheDocument();
  });

  it("shows configuration status", async () => {
    renderSettings({ adkKeySet: false });
    expect(screen.getByText("Not configured")).toBeInTheDocument();
    renderSettings({ adkKeySet: true, adkKeyPreview: "AIza...1234" });
    await waitFor(() => expect(mockGetAvailableModels).toHaveBeenCalled());
    expect(screen.getByText("Configured (AIza...1234)")).toBeInTheDocument();
  });

  it("saves API key and handles errors", async () => {
    const user = userEvent.setup();
    const onAdkKeyChange = vi.fn();
    mockUpdateSettings.mockResolvedValueOnce({ google_api_key_set: true, google_api_key_preview: "AIza...new1", gemini_model: "" });
    renderSettings({ onAdkKeyChange });
    await user.type(screen.getByPlaceholderText("Enter Google API key (AIza...)"), "AIzaSyNewKey123");
    await user.click(screen.getByText("Save Key"));
    await waitFor(() => expect(onAdkKeyChange).toHaveBeenCalledWith(true, "AIza...new1"));

    mockUpdateSettings.mockRejectedValueOnce(new Error("Server error"));
    renderSettings();
    await user.type(screen.getAllByPlaceholderText("Enter Google API key (AIza...)")[1], "bad-key");
    await user.click(screen.getAllByText("Save Key")[1]);
    await waitFor(() => expect(screen.getByText("Server error")).toBeInTheDocument());
  });

  it("tests API key and shows status feedback", async () => {
    const user = userEvent.setup();
    mockTestApiKey.mockResolvedValueOnce({ success: true, models: ["m1", "m2"] });
    renderSettings({ adkKeySet: true });
    await user.click(screen.getByText("Test Key"));
    await waitFor(() => expect(screen.getByText(/Key is valid/)).toBeInTheDocument());

    mockTestApiKey.mockResolvedValueOnce({ success: false, error: "Invalid API key" });
    renderSettings({ adkKeySet: true });
    await user.click(screen.getAllByText("Test Key")[1]);
    await waitFor(() => expect(screen.getByText("Invalid API key")).toBeInTheDocument());
  });
});
