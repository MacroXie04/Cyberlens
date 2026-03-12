import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import DashboardLayout from "../../components/Layout/DashboardLayout";

vi.mock("../../hooks/useSocket", () => ({
  useSocket: () => ({ connected: true, emit: vi.fn() }),
}));

// Also mock at the correct relative path from the component
vi.mock("../../hooks/useSocket", () => ({
  useSocket: () => ({ connected: true, emit: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderLayout(props: Partial<Parameters<typeof DashboardLayout>[0]> = {}) {
  const defaults = {
    activeTab: "supply-chain" as const,
    onTabChange: vi.fn(),
    selectedProject: null,
    adkKeySet: false,
    children: <div data-testid="child-content">Content</div>,
  };
  return {
    ...render(
      <MemoryRouter>
        <DashboardLayout {...defaults} {...props} />
      </MemoryRouter>
    ),
    onTabChange: (props.onTabChange ?? defaults.onTabChange) as ReturnType<typeof vi.fn>,
  };
}

describe("DashboardLayout", () => {
  it("renders CyberLens branding", () => {
    renderLayout();

    expect(screen.getByText("CyberLens")).toBeInTheDocument();
  });

  it("renders child content", () => {
    renderLayout();

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("renders two tab buttons", () => {
    renderLayout();

    expect(screen.getByText("Code Scan")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("calls onTabChange when clicking a tab", async () => {
    const user = userEvent.setup();
    const { onTabChange } = renderLayout({ activeTab: "settings" });

    await user.click(screen.getByText("Code Scan"));

    expect(onTabChange).toHaveBeenCalledWith("supply-chain");
  });

  it("displays auth user and logout button", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    renderLayout({
      authUser: { id: 1, username: "alice", email: "alice@example.com" },
      onLogout,
    });

    expect(screen.getByText("alice")).toBeInTheDocument();

    const logoutBtn = screen.getByTitle("Sign out");
    await user.click(logoutBtn);

    expect(onLogout).toHaveBeenCalled();
  });

  it("shows Gemini status indicator (not configured)", () => {
    renderLayout({ adkKeySet: false });

    expect(screen.getByText("Gemini")).toBeInTheDocument();
  });

  it("shows Gemini status indicator (configured)", () => {
    renderLayout({ adkKeySet: true });

    expect(screen.getByTitle("Gemini API connected")).toBeInTheDocument();
  });

  it("shows 'No project selected' when no project", () => {
    renderLayout({ selectedProject: null });

    expect(screen.getByText("No project selected")).toBeInTheDocument();
  });

  it("shows selected GitHub project name", () => {
    renderLayout({
      selectedProject: {
        mode: "github",
        repo: {
          full_name: "org/my-repo",
          name: "my-repo",
          private: false,
          language: "TypeScript",
          updated_at: "2024-01-01",
          description: "desc",
          stargazers_count: 10,
          forks_count: 2,
          open_issues_count: 3,
          default_branch: "main",
          html_url: "https://github.com/org/my-repo",
        },
      },
    });

    expect(screen.getByText("org/my-repo")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
  });
});
