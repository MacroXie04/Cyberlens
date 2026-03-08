import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CloudRunLogs from "../components/LiveMonitor/CloudRunLogs";
import { getCloudRunLogs } from "../services/api";

vi.mock("../services/api", () => ({
  getCloudRunLogs: vi.fn(),
}));

const mockGetCloudRunLogs = vi.mocked(getCloudRunLogs);

describe("CloudRunLogs", () => {
  beforeEach(() => {
    mockGetCloudRunLogs.mockReset();
    mockGetCloudRunLogs.mockResolvedValue({
      entries: [
        {
          timestamp: "2026-03-07T12:00:00Z",
          severity: "ERROR",
          message: "Unhandled exception while connecting to database",
          log_name: "stdout",
          trace: "",
          labels: {},
        },
        {
          timestamp: "2026-03-07T12:01:00Z",
          severity: "ERROR",
          message: "Unhandled exception while connecting to database",
          log_name: "stdout",
          trace: "",
          labels: {},
        },
        {
          timestamp: "2026-03-07T12:02:00Z",
          severity: "WARNING",
          message: "Rate limit exceeded for /api/login",
          log_name: "stdout",
          trace: "",
          labels: {},
        },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-loads logs, exposes 30-day filtering, and renders analysis", async () => {
    const user = userEvent.setup();

    render(<CloudRunLogs />);

    await waitFor(() =>
      expect(mockGetCloudRunLogs).toHaveBeenCalledWith({
        hours: 24,
        severity: undefined,
        q: undefined,
        limit: 200,
      })
    );

    expect(await screen.findByText("Log Analysis")).toBeInTheDocument();
    expect(screen.getByText("Operational issues detected")).toBeInTheDocument();
    expect(screen.getAllByText("Server exceptions").length).toBeGreaterThan(0);
    expect(screen.getByText(/Repeated pattern:/)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Last 30 days" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Time window"), "720");
    await user.click(screen.getByRole("button", { name: "Refresh Cloud Run logs" }));

    await waitFor(() =>
      expect(mockGetCloudRunLogs).toHaveBeenLastCalledWith({
        hours: 720,
        severity: undefined,
        q: undefined,
        limit: 200,
      })
    );
  });

  it("polls logs automatically while mounted", async () => {
    vi.useFakeTimers();

    const { unmount } = render(<CloudRunLogs />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetCloudRunLogs).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(mockGetCloudRunLogs).toHaveBeenCalledTimes(2);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    expect(mockGetCloudRunLogs).toHaveBeenCalledTimes(2);
  });
});
