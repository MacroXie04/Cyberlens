import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import App from "../../App";
import { getMe, logout as apiLogout } from "../../features/auth/api";
import { getGitHubStatus } from "../../features/supply-chain/api";
import { getSettings } from "../../features/settings/api";
import { login } from "../../services/api";

vi.mock("../../features/auth/api", () => ({ getMe: vi.fn(), logout: vi.fn() }));
vi.mock("../../features/supply-chain/api", () => ({ getGitHubStatus: vi.fn() }));
vi.mock("../../features/settings/api", () => ({ getSettings: vi.fn() }));
vi.mock("../../services/api", () => ({ login: vi.fn(), register: vi.fn() }));

vi.mock("../../hooks/useSocket", () => ({
  useSocket: () => ({ connected: false, emit: vi.fn() }),
}));

vi.mock("../../pages/SupplyChainPage", () => ({ default: () => <div data-testid="supply-chain">SupplyChain</div> }));
vi.mock("../../pages/SettingsPage", () => ({ default: () => <div data-testid="settings-page">Settings</div> }));

const mockGetMe = vi.mocked(getMe);
const mockGetGitHubStatus = vi.mocked(getGitHubStatus);
const mockGetSettings = vi.mocked(getSettings);
const mockLogout = vi.mocked(apiLogout);
const mockLogin = vi.mocked(login);
const fakeUser = { id: 1, username: "testuser", email: "test@example.com" };

function renderApp(initialRoute = "/") {
  return render(<MemoryRouter initialEntries={[initialRoute]}><App /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mockGetMe.mockResolvedValue({ authenticated: true, user: fakeUser });
  mockGetGitHubStatus.mockResolvedValue({ connected: false });
  mockGetSettings.mockResolvedValue({ google_api_key_set: false, google_api_key_preview: "", gemini_model: "" });
});

describe("App authentication flow", () => {
  it("transitions from login to dashboard after successful login", async () => {
    const user = userEvent.setup();
    mockGetMe.mockResolvedValueOnce({ authenticated: false });
    mockLogin.mockResolvedValueOnce({ user: fakeUser });
    renderApp("/login");
    await waitFor(() => expect(screen.getByPlaceholderText("Username")).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText("Username"), "testuser");
    await user.type(screen.getByPlaceholderText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    await waitFor(() => expect(screen.getByTestId("supply-chain")).toBeInTheDocument());
  });

  it("logs out and returns to login page", async () => {
    const user = userEvent.setup();
    mockLogout.mockResolvedValue({ status: "ok" });
    renderApp("/");
    await waitFor(() => expect(screen.getByTestId("supply-chain")).toBeInTheDocument());
    await user.click(screen.getByTitle("Sign out"));
    await waitFor(() => expect(screen.getByText("Sign in to your account")).toBeInTheDocument());
  });
});

describe("Dashboard tabs", () => {
  it("shows Code Scan tab by default", async () => {
    renderApp("/");
    await waitFor(() => expect(screen.getByTestId("supply-chain")).toBeInTheDocument());
  });

  it("switches to Settings tab", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await waitFor(() => expect(screen.getByTestId("supply-chain")).toBeInTheDocument());
    await user.click(screen.getAllByText("Settings")[0]);
    await waitFor(() => expect(screen.getByTestId("settings-page")).toBeInTheDocument());
  });
});
