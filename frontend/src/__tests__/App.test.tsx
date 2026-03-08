import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

vi.mock("../services/api", () => ({
  getMe: vi.fn(),
  getGitHubStatus: vi.fn(),
  getSettings: vi.fn(),
  setMonitorBaseUrl: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}));

vi.mock("../hooks/useSocket", () => ({
  useSocket: () => ({ connected: false, emit: vi.fn() }),
}));

// Mock the heavy child pages to keep tests focused
vi.mock("../pages/LiveMonitorPage", () => ({
  default: () => <div data-testid="live-monitor">LiveMonitor</div>,
}));

vi.mock("../pages/SupplyChainPage", () => ({
  default: () => <div data-testid="supply-chain">SupplyChain</div>,
}));

vi.mock("../pages/SettingsPage", () => ({
  default: () => <div data-testid="settings-page">Settings</div>,
}));

import { getMe, getGitHubStatus, getSettings, logout as apiLogout, login } from "../services/api";

const mockGetMe = vi.mocked(getMe);
const mockGetGitHubStatus = vi.mocked(getGitHubStatus);
const mockGetSettings = vi.mocked(getSettings);
const mockLogout = vi.mocked(apiLogout);
const mockLogin = vi.mocked(login);

const fakeUser = { id: 1, username: "testuser", email: "test@example.com" };

function renderApp(initialRoute = "/") {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  // Default: not authenticated
  mockGetMe.mockResolvedValue({ authenticated: false });
  mockGetGitHubStatus.mockResolvedValue({ connected: false });
  mockGetSettings.mockResolvedValue({
    google_api_key_set: false,
    google_api_key_preview: "",
    gemini_model: "",
  });
});

describe("App routing", () => {
  it("shows loading state initially", () => {
    // getMe never resolves
    mockGetMe.mockReturnValue(new Promise(() => {}));
    renderApp();

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("redirects unauthenticated users to login page", async () => {
    renderApp("/");

    await waitFor(() => {
      expect(screen.getByText("Sign in to your account")).toBeInTheDocument();
    });
  });

  it("shows login page at /login for unauthenticated users", async () => {
    renderApp("/login");

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
    });
  });

  it("shows register page at /register for unauthenticated users", async () => {
    renderApp("/register");

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Confirm password")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
    });
  });

  it("shows dashboard for authenticated users", async () => {
    mockGetMe.mockResolvedValue({ authenticated: true, user: fakeUser });

    renderApp("/");

    await waitFor(() => {
      expect(screen.getByText("testuser")).toBeInTheDocument();
      expect(screen.getByTestId("live-monitor")).toBeInTheDocument();
    });
  });

  it("redirects authenticated users from /login to dashboard", async () => {
    mockGetMe.mockResolvedValue({ authenticated: true, user: fakeUser });

    renderApp("/login");

    await waitFor(() => {
      expect(screen.getByTestId("live-monitor")).toBeInTheDocument();
    });
  });

  it("redirects authenticated users from /register to dashboard", async () => {
    mockGetMe.mockResolvedValue({ authenticated: true, user: fakeUser });

    renderApp("/register");

    await waitFor(() => {
      expect(screen.getByTestId("live-monitor")).toBeInTheDocument();
    });
  });
});

describe("App authentication flow", () => {
  it("transitions from login to dashboard after successful login", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce({ user: fakeUser });

    renderApp("/login");

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("Username"), "testuser");
    await user.type(screen.getByPlaceholderText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.getByText("testuser")).toBeInTheDocument();
    });
  });

  it("logs out and returns to login page", async () => {
    const user = userEvent.setup();
    mockGetMe.mockResolvedValue({ authenticated: true, user: fakeUser });
    mockLogout.mockResolvedValue({ status: "ok" });

    renderApp("/");

    await waitFor(() => {
      expect(screen.getByText("testuser")).toBeInTheDocument();
    });

    await user.click(screen.getByTitle("Sign out"));

    await waitFor(() => {
      expect(screen.getByText("Sign in to your account")).toBeInTheDocument();
    });
  });
});

describe("Dashboard tabs", () => {
  beforeEach(() => {
    mockGetMe.mockResolvedValue({ authenticated: true, user: fakeUser });
  });

  it("shows Live Monitor tab by default", async () => {
    renderApp("/");

    await waitFor(() => {
      expect(screen.getByTestId("live-monitor")).toBeInTheDocument();
    });
  });

  it("switches to Code Scan tab", async () => {
    const user = userEvent.setup();
    renderApp("/");

    await waitFor(() => {
      expect(screen.getByText("Code Scan")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Code Scan"));

    expect(screen.getByTestId("supply-chain")).toBeInTheDocument();
  });

  it("switches to Settings tab", async () => {
    const user = userEvent.setup();
    renderApp("/");

    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    await user.click(screen.getAllByText("Settings")[0]);

    await waitFor(() => {
      expect(screen.getByTestId("settings-page")).toBeInTheDocument();
    });
  });
});
