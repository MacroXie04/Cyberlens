import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import RegisterPage from "../pages/RegisterPage";

vi.mock("../services/api", () => ({
  register: vi.fn(),
}));

import { register } from "../services/api";

const mockRegister = vi.mocked(register);

function renderRegister(onAuth = vi.fn()) {
  return render(
    <MemoryRouter>
      <RegisterPage onAuth={onAuth} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RegisterPage", () => {
  it("renders registration form with all inputs", () => {
    renderRegister();

    expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Confirm password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
  });

  it("renders link to login page", () => {
    renderRegister();

    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("shows password mismatch error without calling API", async () => {
    const user = userEvent.setup();
    const onAuth = vi.fn();

    renderRegister(onAuth);

    await user.type(screen.getByPlaceholderText("Username"), "newuser");
    await user.type(screen.getByPlaceholderText("Email"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "pass123");
    await user.type(screen.getByPlaceholderText("Confirm password"), "different");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    });
    expect(mockRegister).not.toHaveBeenCalled();
    expect(onAuth).not.toHaveBeenCalled();
  });

  it("calls register API and onAuth on successful submit", async () => {
    const user = userEvent.setup();
    const onAuth = vi.fn();
    const mockUser = { id: 2, username: "newuser", email: "new@example.com" };
    mockRegister.mockResolvedValueOnce({ user: mockUser });

    renderRegister(onAuth);

    await user.type(screen.getByPlaceholderText("Username"), "newuser");
    await user.type(screen.getByPlaceholderText("Email"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "strongpass");
    await user.type(screen.getByPlaceholderText("Confirm password"), "strongpass");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith("newuser", "new@example.com", "strongpass");
      expect(onAuth).toHaveBeenCalledWith(mockUser);
    });
  });

  it("displays error from API on registration failure", async () => {
    const user = userEvent.setup();
    mockRegister.mockRejectedValueOnce(new Error("Username already taken"));

    renderRegister();

    await user.type(screen.getByPlaceholderText("Username"), "taken");
    await user.type(screen.getByPlaceholderText("Email"), "t@b.com");
    await user.type(screen.getByPlaceholderText("Password"), "pass");
    await user.type(screen.getByPlaceholderText("Confirm password"), "pass");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(screen.getByText("Username already taken")).toBeInTheDocument();
    });
  });

  it("shows loading state while submitting", async () => {
    const user = userEvent.setup();
    mockRegister.mockReturnValueOnce(new Promise(() => {}));

    renderRegister();

    await user.type(screen.getByPlaceholderText("Username"), "u");
    await user.type(screen.getByPlaceholderText("Email"), "u@b.com");
    await user.type(screen.getByPlaceholderText("Password"), "p");
    await user.type(screen.getByPlaceholderText("Confirm password"), "p");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Creating account..." })).toBeDisabled();
    });
  });

  it("displays CyberLens branding", () => {
    renderRegister();

    expect(screen.getByText("CyberLens")).toBeInTheDocument();
    expect(screen.getByText("Create a new account")).toBeInTheDocument();
  });
});
