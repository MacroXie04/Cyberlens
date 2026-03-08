import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SettingsPage from "../pages/SettingsPage";

vi.mock("../services/api", () => ({
  updateSettings: vi.fn(),
  testApiKey: vi.fn(),
  getRepos: vi.fn(),
  getAvailableModels: vi.fn(),
}));

vi.mock("../components/SupplyChain/GitHubConnect", () => ({
  default: () => <div data-testid="github-connect">GitHubConnect</div>,
}));

vi.mock("../components/Settings/GcpLoggingConfig", () => ({
  default: () => <div data-testid="gcp-logging">GcpLoggingConfig</div>,
}));

import { updateSettings, testApiKey, getAvailableModels, getRepos } from "../services/api";

const mockUpdateSettings = vi.mocked(updateSettings);
const mockTestApiKey = vi.mocked(testApiKey);
const mockGetAvailableModels = vi.mocked(getAvailableModels);
const mockGetRepos = vi.mocked(getRepos);

function renderSettings(props: Partial<Parameters<typeof SettingsPage>[0]> = {}) {
  const defaults = {
    user: null,
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    selectedProject: null,
    onSelectProject: vi.fn(),
    adkKeySet: false,
    adkKeyPreview: "",
    onAdkKeyChange: vi.fn(),
    geminiModel: "",
    onModelChange: vi.fn(),
  };
  return render(
    <MemoryRouter>
      <SettingsPage {...defaults} {...props} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRepos.mockResolvedValue([]);
  mockGetAvailableModels.mockResolvedValue({ models: [] });
});

describe("SettingsPage", () => {
  it("renders the settings heading", () => {
    renderSettings();

    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders ADK configuration card", () => {
    renderSettings();

    expect(screen.getByText("Google Agent Development Kit (ADK)")).toBeInTheDocument();
  });

  it("does not render the Cloud Run instance card", () => {
    renderSettings();

    expect(screen.queryByText("Cloud Run Instance")).not.toBeInTheDocument();
  });

  it("shows 'Not configured' when API key not set", () => {
    renderSettings({ adkKeySet: false });

    expect(screen.getByText("Not configured")).toBeInTheDocument();
  });

  it("shows configured status with preview when key is set", () => {
    renderSettings({ adkKeySet: true, adkKeyPreview: "AIza...1234" });

    expect(screen.getByText("Configured (AIza...1234)")).toBeInTheDocument();
  });

  it("saves API key on button click", async () => {
    const user = userEvent.setup();
    const onAdkKeyChange = vi.fn();
    mockUpdateSettings.mockResolvedValueOnce({
      google_api_key_set: true,
      google_api_key_preview: "AIza...new1",
      gemini_model: "",
    });

    renderSettings({ onAdkKeyChange });

    const input = screen.getByPlaceholderText("Enter Google API key (AIza...)");
    await user.type(input, "AIzaSyNewKey123");
    await user.click(screen.getByText("Save Key"));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({ google_api_key: "AIzaSyNewKey123" });
      expect(onAdkKeyChange).toHaveBeenCalledWith(true, "AIza...new1");
    });
  });

  it("shows error when saving fails", async () => {
    const user = userEvent.setup();
    mockUpdateSettings.mockRejectedValueOnce(new Error("Server error"));

    renderSettings();

    const input = screen.getByPlaceholderText("Enter Google API key (AIza...)");
    await user.type(input, "bad-key");
    await user.click(screen.getByText("Save Key"));

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("shows Test Key button when key is set", () => {
    renderSettings({ adkKeySet: true });

    expect(screen.getByText("Test Key")).toBeInTheDocument();
  });

  it("does not show Test Key button when key is not set", () => {
    renderSettings({ adkKeySet: false });

    expect(screen.queryByText("Test Key")).not.toBeInTheDocument();
  });

  it("tests API key and shows success", async () => {
    const user = userEvent.setup();
    mockTestApiKey.mockResolvedValueOnce({ success: true, models: ["m1", "m2"] });

    renderSettings({ adkKeySet: true });

    await user.click(screen.getByText("Test Key"));

    await waitFor(() => {
      expect(screen.getByText(/Key is valid/)).toBeInTheDocument();
    });
  });

  it("tests API key and shows error", async () => {
    const user = userEvent.setup();
    mockTestApiKey.mockResolvedValueOnce({ success: false, error: "Invalid API key" });

    renderSettings({ adkKeySet: true });

    await user.click(screen.getByText("Test Key"));

    await waitFor(() => {
      expect(screen.getByText("Invalid API key")).toBeInTheDocument();
    });
  });
});

describe("SettingsPage model selector", () => {
  it("shows model selector when API key is set", async () => {
    mockGetAvailableModels.mockResolvedValueOnce({
      models: ["gemini-2.5-flash", "gemini-2.5-pro"],
    });

    renderSettings({ adkKeySet: true });

    await waitFor(() => {
      expect(screen.getByText("Gemini Model")).toBeInTheDocument();
    });
  });

  it("does not show model selector when API key is not set", () => {
    renderSettings({ adkKeySet: false });

    expect(screen.queryByText("Gemini Model")).not.toBeInTheDocument();
  });

  it("fetches available models when key is set", async () => {
    mockGetAvailableModels.mockResolvedValueOnce({
      models: ["gemini-2.5-flash", "gemini-2.5-pro"],
    });

    renderSettings({ adkKeySet: true });

    await waitFor(() => {
      expect(mockGetAvailableModels).toHaveBeenCalled();
    });
  });

  it("renders default option in model dropdown", async () => {
    mockGetAvailableModels.mockResolvedValueOnce({ models: [] });

    renderSettings({ adkKeySet: true, geminiModel: "" });

    await waitFor(() => {
      const select = screen.getByRole("combobox");
      expect(select).toBeInTheDocument();
    });

    expect(screen.getByText("Default (gemini-2.5-flash)")).toBeInTheDocument();
  });

  it("calls updateSettings and onModelChange when model is changed", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    mockGetAvailableModels.mockResolvedValueOnce({
      models: ["gemini-2.5-flash", "gemini-2.5-pro"],
    });
    mockUpdateSettings.mockResolvedValueOnce({
      google_api_key_set: true,
      google_api_key_preview: "AIza...1234",
      gemini_model: "gemini-2.5-pro",
    });

    renderSettings({ adkKeySet: true, geminiModel: "", onModelChange });

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    // Wait for models to load
    await waitFor(() => {
      expect(screen.getByText("gemini-2.5-pro")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByRole("combobox"), "gemini-2.5-pro");

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({ gemini_model: "gemini-2.5-pro" });
      expect(onModelChange).toHaveBeenCalledWith("gemini-2.5-pro");
    });
  });
});

describe("SettingsPage sub-components", () => {
  it("renders GcpLoggingConfig component", () => {
    renderSettings();
    expect(screen.getByTestId("gcp-logging")).toBeInTheDocument();
  });

  it("renders GitHubConnect component", () => {
    renderSettings();
    expect(screen.getByTestId("github-connect")).toBeInTheDocument();
  });
});
