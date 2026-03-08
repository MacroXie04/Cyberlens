import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LiveMonitorPage from "../pages/LiveMonitorPage";
import {
  ensureGcpCollection,
  ensureGcpHistory,
  getGcpEstateReplaySnapshot,
  getGcpEstateServices,
  getGcpEstateTimeline,
} from "../services/api";
import { useSocket } from "../hooks/useSocket";

vi.mock("../services/api", () => ({
  ensureGcpCollection: vi.fn(),
  ensureGcpHistory: vi.fn(),
  getGcpEstateReplaySnapshot: vi.fn(),
  getGcpEstateServices: vi.fn(),
  getGcpEstateTimeline: vi.fn(),
  triggerGcpRefresh: vi.fn(),
}));

vi.mock("../hooks/useSocket", () => ({
  useSocket: vi.fn(() => ({ connected: false, emit: vi.fn() })),
}));

vi.mock("../components/LiveMonitor/GeoAttackMap", () => ({
  default: () => <div data-testid="geo-map">Geo map</div>,
}));

vi.mock("../components/LiveMonitor/GlobalThreatTimeline", () => ({
  default: ({ points }: { points: unknown[] }) => (
    <div data-testid="timeline">Timeline {points.length}</div>
  ),
}));

vi.mock("../components/LiveMonitor/TriageDrawer", () => ({
  default: () => null,
}));

const mockEnsureGcpCollection = vi.mocked(ensureGcpCollection);
const mockEnsureGcpHistory = vi.mocked(ensureGcpHistory);
const mockGetGcpEstateServices = vi.mocked(getGcpEstateServices);
const mockGetGcpEstateTimeline = vi.mocked(getGcpEstateTimeline);
const mockGetGcpEstateReplaySnapshot = vi.mocked(getGcpEstateReplaySnapshot);
const mockUseSocket = vi.mocked(useSocket);

const NOW = new Date("2026-03-08T12:00:00.000Z");
const THIRTY_DAYS_START = new Date("2026-02-06T12:00:00.000Z").toISOString();
const FIFTEEN_MINUTES_START = new Date("2026-03-08T11:45:00.000Z").toISOString();
const END = NOW.toISOString();

function makeTimelineResponse(start = THIRTY_DAYS_START, end = END, bucket = "6h") {
  return {
    start,
    end,
    bucket,
    coverage_start: start,
    coverage_end: end,
    history_ready: true,
    backfill_status: { status: "complete", days: 30 },
    points: [
      { ts: start, requests: 5, errors: 0, incident_count: 0 },
      { ts: end, requests: 9, errors: 1, incident_count: 1 },
    ],
    markers: [
      {
        id: "incident-1",
        kind: "incident" as const,
        ts: "2026-03-08T11:55:00.000Z",
        severity: "p2",
        title: "Armor spike",
      },
    ],
  };
}

function makeSnapshot(cursor = END) {
  return {
    cursor,
    window_start: "2026-03-07T12:00:00.000Z",
    window_end: cursor,
    history_status: {
      coverage_start: THIRTY_DAYS_START,
      coverage_end: END,
      history_ready: true,
      backfill_status: { status: "complete", days: 30 },
    },
    summary: {
      project_id: "test-project",
      active_incidents: 1,
      services_under_attack: 1,
      armor_blocks_recent: 1,
      auth_failures_recent: 0,
      error_events_recent: 0,
      total_events_recent: 2,
      total_services: 1,
      unhealthy_revisions: 0,
      coverage_start: THIRTY_DAYS_START,
      coverage_end: END,
      history_ready: true,
      backfill_status: { status: "complete", days: 30 },
      collection_errors: {},
    },
    services: [
      {
        id: 1,
        project_id: "test-project",
        service_name: "mobileid",
        region: "us-west1",
        latest_revision: "mobileid-00031-rf6",
        instance_count: 2,
        url: "https://mobileid.run.app",
        last_deployed_at: null,
        risk_score: 0.42,
        risk_tags: ["armor"],
        request_rate: 9,
        error_rate: 0.05,
        p50_latency_ms: 120,
        p95_latency_ms: 240,
        p99_latency_ms: 0,
        updated_at: END,
        sample_missing: false,
      },
    ],
    map: [],
    perimeter: {
      cloud_armor: 1,
      load_balancer: 0,
      iam_audit: 0,
      iap: 0,
    },
    events: [
      {
        id: 9,
        source: "cloud_armor" as const,
        timestamp: "2026-03-08T11:56:00.000Z",
        project_id: "test-project",
        region: "us-west1",
        service: "mobileid",
        revision: "mobileid-00031-rf6",
        severity: "high" as const,
        category: "armor_block" as const,
        source_ip: "1.2.3.4",
        principal: "",
        path: "/login",
        method: "GET",
        status_code: 403,
        trace_id: "",
        request_id: "",
        country: "US",
        geo_lat: null,
        geo_lng: null,
        evidence_refs: [],
        raw_payload_preview: "",
        fact_fields: {},
        inference_fields: {},
        incident: 1,
      },
    ],
    incidents: [
      {
        id: 1,
        project_id: "test-project",
        incident_type: "armor_spike",
        priority: "p2" as const,
        status: "open" as const,
        confidence: 0.82,
        evidence_count: 3,
        services_affected: ["mobileid"],
        regions_affected: ["us-west1"],
        title: "Armor spike",
        narrative: "",
        likely_cause: "",
        next_steps: [],
        ai_inference: {},
        first_seen: "2026-03-08T11:30:00.000Z",
        last_seen: "2026-03-08T11:55:00.000Z",
        acknowledged_by: "",
        acknowledged_at: null,
        created_at: "2026-03-08T11:30:00.000Z",
        updated_at: "2026-03-08T11:55:00.000Z",
      },
    ],
  };
}

describe("LiveMonitorPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();

    mockEnsureGcpCollection.mockResolvedValue({ triggered: true });
    mockEnsureGcpHistory.mockResolvedValue({
      triggered: true,
      history_status: {
        coverage_start: THIRTY_DAYS_START,
        coverage_end: END,
        history_ready: true,
        backfill_status: { status: "complete", days: 30 },
      },
    });
    mockGetGcpEstateServices.mockResolvedValue(makeSnapshot().services);
    mockGetGcpEstateTimeline.mockResolvedValue(makeTimelineResponse());
    mockGetGcpEstateReplaySnapshot.mockResolvedValue(makeSnapshot());
    mockUseSocket.mockReturnValue({ connected: false, emit: vi.fn() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function settlePage() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("defaults to 30-day history mode and requests a 6h bucket timeline", async () => {
    render(<LiveMonitorPage />);
    await settlePage();

    expect(mockGetGcpEstateTimeline).toHaveBeenCalledWith({
      start: THIRTY_DAYS_START,
      end: END,
      bucket: "6h",
    });

    expect(mockGetGcpEstateReplaySnapshot).toHaveBeenCalledWith({
      start: THIRTY_DAYS_START,
      end: END,
      cursor: END,
      window_minutes: 1440,
    });

    expect(mockEnsureGcpHistory).toHaveBeenCalledWith(30);
    expect(screen.getByText("Historical posture")).toBeInTheDocument();
    expect(screen.getByText("Armor spike")).toBeInTheDocument();
  });

  it("switches to live mode with a 15-minute window and enables the socket", async () => {
    render(<LiveMonitorPage cloudRunUrl="https://monitor.example.com" />);
    await settlePage();

    fireEvent.click(screen.getByRole("button", { name: "live" }));
    await settlePage();

    expect(mockGetGcpEstateTimeline).toHaveBeenLastCalledWith({
      start: FIFTEEN_MINUTES_START,
      end: END,
      bucket: "5m",
    });
    expect(mockGetGcpEstateReplaySnapshot).toHaveBeenLastCalledWith({
      start: FIFTEEN_MINUTES_START,
      end: END,
      cursor: END,
      window_minutes: 60,
    });
    expect(mockUseSocket).toHaveBeenLastCalledWith(
      expect.any(Object),
      "https://monitor.example.com",
      true
    );
  });

  it("moves the replay cursor when the scrubber changes", async () => {
    render(<LiveMonitorPage />);
    await settlePage();

    fireEvent.change(screen.getByLabelText("Replay cursor"), {
      target: { value: String(new Date("2026-03-01T12:00:00.000Z").getTime()) },
    });
    await settlePage();

    expect(mockGetGcpEstateReplaySnapshot).toHaveBeenLastCalledWith({
      start: THIRTY_DAYS_START,
      end: END,
      cursor: "2026-03-01T12:00:00.000Z",
      window_minutes: 1440,
    });
  });

  it("jumps replay to the incident timestamp when an incident is selected", async () => {
    render(<LiveMonitorPage />);
    await settlePage();

    fireEvent.click(screen.getAllByText("Armor spike")[0]);
    await settlePage();

    expect(mockGetGcpEstateReplaySnapshot).toHaveBeenLastCalledWith({
      start: THIRTY_DAYS_START,
      end: END,
      cursor: "2026-03-08T11:55:00.000Z",
      window_minutes: 1440,
    });
  });
});
