import "@testing-library/jest-dom/vitest";

// Mock socket.io-client globally
vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  })),
}));
