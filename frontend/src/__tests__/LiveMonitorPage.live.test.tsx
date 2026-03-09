import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LiveMonitorPage from "../pages/LiveMonitorPage";
import { ensureGcpCollection, ensureGcpHistory, getGcpEstateReplaySnapshot, getGcpEstateServices, getGcpEstateTimeline } from "../features/monitor/api";
import { useSocket } from "../hooks/useSocket";

vi.mock("../features/monitor/api", () => ({ ensureGcpCollection: vi.fn(), ensureGcpHistory: vi.fn(), getGcpEstateReplaySnapshot: vi.fn(), getGcpEstateServices: vi.fn(), getGcpEstateTimeline: vi.fn(), triggerGcpRefresh: vi.fn() }));
vi.mock("../hooks/useSocket", () => ({ useSocket: vi.fn(() => ({ connected: false, emit: vi.fn() })) }));
vi.mock("../components/LiveMonitor/GeoAttackMap", () => ({ default: () => <div /> }));
vi.mock("../components/LiveMonitor/GlobalThreatTimeline", () => ({ default: () => <div /> }));
vi.mock("../components/LiveMonitor/TriageDrawer", () => ({ default: () => null }));

const mockEnsureGcpCollection = vi.mocked(ensureGcpCollection);
const mockEnsureGcpHistory = vi.mocked(ensureGcpHistory);
const mockGetGcpEstateServices = vi.mocked(getGcpEstateServices);
const mockGetGcpEstateTimeline = vi.mocked(getGcpEstateTimeline);
const mockGetGcpEstateReplaySnapshot = vi.mocked(getGcpEstateReplaySnapshot);
const mockUseSocket = vi.mocked(useSocket);
const NOW = new Date("2026-03-08T12:00:00.000Z");
const FIFTEEN_MINUTES_START = new Date("2026-03-08T11:45:00.000Z").toISOString();
const THIRTY_DAYS_START = new Date("2026-02-06T12:00:00.000Z").toISOString();
const END = NOW.toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  mockEnsureGcpCollection.mockResolvedValue({ triggered: true });
  mockEnsureGcpHistory.mockResolvedValue({ triggered: true, history_status: { coverage_start: THIRTY_DAYS_START, coverage_end: END, history_ready: true, backfill_status: { status: "complete", days: 30 } } });
  mockGetGcpEstateServices.mockResolvedValue([]);
  mockGetGcpEstateTimeline.mockResolvedValue({ start: THIRTY_DAYS_START, end: END, bucket: "6h", coverage_start: THIRTY_DAYS_START, coverage_end: END, history_ready: true, backfill_status: { status: "complete", days: 30 }, points: [], markers: [] });
  mockGetGcpEstateReplaySnapshot.mockResolvedValue({ cursor: END, window_start: THIRTY_DAYS_START, window_end: END, history_status: { coverage_start: THIRTY_DAYS_START, coverage_end: END, history_ready: true, backfill_status: { status: "complete", days: 30 } }, summary: { project_id: "test-project", active_incidents: 0, services_under_attack: 0, armor_blocks_recent: 0, auth_failures_recent: 0, error_events_recent: 0, total_events_recent: 0, total_services: 0, unhealthy_revisions: 0, coverage_start: THIRTY_DAYS_START, coverage_end: END, history_ready: true, backfill_status: { status: "complete", days: 30 }, collection_errors: {} }, services: [], map: [], perimeter: { cloud_armor: 0, load_balancer: 0, iam_audit: 0, iap: 0 }, events: [], incidents: [] });
  mockUseSocket.mockReturnValue({ connected: false, emit: vi.fn() });
});

async function settlePage() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("LiveMonitorPage live mode", () => {
  it("switches to live mode with a 15-minute window and enables the socket", async () => {
    render(<LiveMonitorPage cloudRunUrl="https://monitor.example.com" />);
    await settlePage();
    fireEvent.click(screen.getByRole("button", { name: /^live$/i }));
    await settlePage();
    expect(mockGetGcpEstateTimeline).toHaveBeenLastCalledWith({ start: FIFTEEN_MINUTES_START, end: END, bucket: "5m" });
    expect(mockGetGcpEstateReplaySnapshot).toHaveBeenLastCalledWith({ start: FIFTEEN_MINUTES_START, end: END, cursor: END, window_minutes: 60 });
    expect(mockUseSocket).toHaveBeenLastCalledWith(expect.any(Object), "https://monitor.example.com", true);
  });
});
