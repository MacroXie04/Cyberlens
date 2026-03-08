import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "../pages/LoginPage";

vi.mock("../services/api", () => ({
  login: vi.fn(),
}));

import { login } from "../services/api";

const mockLogin = vi.mocked(login);

function renderLogin(onAuth = vi.fn()) {
  return render(
    <MemoryRouter>
      <LoginPage onAuth={onAuth} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LoginPage", () => {
  it("renders sign-in form with inputs and button", () => {
    renderLogin();

    expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("renders link to register page", () => {
    renderLogin();

    const link = screen.getByRole("link", { name: "Register" });
    expect(link).toHaveAttribute("href", "/register");
  });

  it("calls login API and onAuth on successful submit", async () => {
    const user = userEvent.setup();
    const onAuth = vi.fn();
    const mockUser = { id: 1, username: "testuser", email: "test@example.com" };
    mockLogin.mockResolvedValueOnce({ user: mockUser });

    renderLogin(onAuth);

    await user.type(screen.getByPlaceholderText("Username"), "testuser");
    await user.type(screen.getByPlaceholderText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("testuser", "password123");
      expect(onAuth).toHaveBeenCalledWith(mockUser);
    });
  });

  it("displays error message on login failure", async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce(new Error("Invalid credentials"));

    renderLogin();

    await user.type(screen.getByPlaceholderText("Username"), "bad");
    await user.type(screen.getByPlaceholderText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("shows loading state while submitting", async () => {
    const user = userEvent.setup();
    // Never resolve to keep loading state
    mockLogin.mockReturnValueOnce(new Promise(() => {}));

    renderLogin();

    await user.type(screen.getByPlaceholderText("Username"), "user");
    await user.type(screen.getByPlaceholderText("Password"), "pass");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Signing in..." })).toBeDisabled();
    });
  });

  it("displays CyberLens branding", () => {
    renderLogin();

    expect(screen.getByText("CyberLens")).toBeInTheDocument();
    expect(screen.getByText("Sign in to your account")).toBeInTheDocument();
  });
});
