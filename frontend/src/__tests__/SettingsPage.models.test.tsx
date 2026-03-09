import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import SettingsPage from "../pages/SettingsPage";
import { getAvailableModels, getRepos, updateSettings } from "../services/api";

vi.mock("../services/api", () => ({ updateSettings: vi.fn(), testApiKey: vi.fn(), getRepos: vi.fn(), getAvailableModels: vi.fn() }));
vi.mock("../components/SupplyChain/GitHubConnect", () => ({ default: () => <div data-testid="github-connect">GitHubConnect</div> }));
vi.mock("../components/Settings/GcpLoggingConfig", () => ({ default: () => <div data-testid="gcp-logging">GcpLoggingConfig</div> }));

const mockUpdateSettings = vi.mocked(updateSettings);
const mockGetAvailableModels = vi.mocked(getAvailableModels);
const mockGetRepos = vi.mocked(getRepos);

function renderSettings(props: Partial<Parameters<typeof SettingsPage>[0]> = {}) {
  return render(<MemoryRouter><SettingsPage user={null} onConnect={vi.fn()} onDisconnect={vi.fn()} selectedProject={null} onSelectProject={vi.fn()} adkKeySet={true} adkKeyPreview="AIza...1234" onAdkKeyChange={vi.fn()} geminiModel="" onModelChange={vi.fn()} {...props} /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRepos.mockResolvedValue([]);
});

describe("SettingsPage model selector", () => {
  it("shows model selector only when API key is set and fetches models", async () => {
    mockGetAvailableModels.mockResolvedValueOnce({ models: ["gemini-2.5-flash", "gemini-2.5-pro"] });
    renderSettings();
    await waitFor(() => expect(screen.getByText("Gemini Model")).toBeInTheDocument());
    expect(mockGetAvailableModels).toHaveBeenCalled();
  });

  it("renders default model option", async () => {
    mockGetAvailableModels.mockResolvedValueOnce({ models: [] });
    renderSettings({ geminiModel: "" });
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
    expect(screen.getByText("Default (gemini-2.5-flash)")).toBeInTheDocument();
  });

  it("updates the selected model and renders sub-components", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    mockGetAvailableModels.mockResolvedValueOnce({ models: ["gemini-2.5-flash", "gemini-2.5-pro"] });
    mockUpdateSettings.mockResolvedValueOnce({ google_api_key_set: true, google_api_key_preview: "AIza...1234", gemini_model: "gemini-2.5-pro" });
    renderSettings({ onModelChange });
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
    await user.selectOptions(screen.getByRole("combobox"), "gemini-2.5-pro");
    await waitFor(() => expect(onModelChange).toHaveBeenCalledWith("gemini-2.5-pro"));
    expect(screen.getByTestId("gcp-logging")).toBeInTheDocument();
    expect(screen.getByTestId("github-connect")).toBeInTheDocument();
  });
});
