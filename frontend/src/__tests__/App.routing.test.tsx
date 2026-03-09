import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "../App";
import { getMe } from "../features/auth/api";
import { getGitHubStatus } from "../features/supply-chain/api";
import { getSettings } from "../features/settings/api";

vi.mock("../features/auth/api", () => ({ getMe: vi.fn(), logout: vi.fn() }));
vi.mock("../features/supply-chain/api", () => ({ getGitHubStatus: vi.fn() }));
vi.mock("../features/settings/api", () => ({ getSettings: vi.fn() }));
vi.mock("../services/api", () => ({ login: vi.fn(), register: vi.fn() }));

vi.mock("../hooks/useSocket", () => ({
  useSocket: () => ({ connected: false, emit: vi.fn() }),
}));

vi.mock("../pages/LiveMonitorPage", () => ({ default: () => <div data-testid="live-monitor">LiveMonitor</div> }));
vi.mock("../pages/SupplyChainPage", () => ({ default: () => <div data-testid="supply-chain">SupplyChain</div> }));
vi.mock("../pages/SettingsPage", () => ({ default: () => <div data-testid="settings-page">Settings</div> }));

const mockGetMe = vi.mocked(getMe);
const mockGetGitHubStatus = vi.mocked(getGitHubStatus);
const mockGetSettings = vi.mocked(getSettings);
const fakeUser = { id: 1, username: "testuser", email: "test@example.com" };

function renderApp(initialRoute = "/") {
  return render(<MemoryRouter initialEntries={[initialRoute]}><App /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mockGetMe.mockResolvedValue({ authenticated: false });
  mockGetGitHubStatus.mockResolvedValue({ connected: false });
  mockGetSettings.mockResolvedValue({ google_api_key_set: false, google_api_key_preview: "", gemini_model: "" });
});

describe("App routing", () => {
  it("shows loading state initially", () => {
    mockGetMe.mockReturnValue(new Promise(() => {}));
    renderApp();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("redirects unauthenticated users to login page", async () => {
    renderApp("/");
    await waitFor(() => expect(screen.getByText("Sign in to your account")).toBeInTheDocument());
  });

  it("shows login page at /login for unauthenticated users", async () => {
    renderApp("/login");
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument());
  });

  it("shows register page at /register for unauthenticated users", async () => {
    renderApp("/register");
    await waitFor(() => expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument());
  });

  it("shows dashboard for authenticated users", async () => {
    mockGetMe.mockResolvedValue({ authenticated: true, user: fakeUser });
    renderApp("/");
    await waitFor(() => {
      expect(screen.getByText("testuser")).toBeInTheDocument();
      expect(screen.getByTestId("live-monitor")).toBeInTheDocument();
    });
  });

  it("redirects authenticated users from /login and /register to dashboard", async () => {
    mockGetMe.mockResolvedValue({ authenticated: true, user: fakeUser });
    const loginView = renderApp("/login");
    await waitFor(() => expect(screen.getByTestId("live-monitor")).toBeInTheDocument());
    loginView.unmount();
    renderApp("/register");
    await waitFor(() => expect(screen.getByTestId("live-monitor")).toBeInTheDocument());
  });
});
