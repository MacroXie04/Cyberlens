import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);
let api: typeof import("../services/api");

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(data) });
}

beforeEach(async () => {
  vi.resetModules();
  mockFetch.mockReset();
  api = await import("../services/api");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("API endpoint helpers", () => {
  it("switches monitor endpoints to remote URL and resets to local", async () => {
    api.setMonitorBaseUrl("https://remote.example.com/");
    mockFetch.mockReturnValueOnce(jsonResponse({ results: [], count: 0 }));
    await api.getRequests();
    expect(mockFetch.mock.calls[0][0]).toBe("https://remote.example.com/api/requests/");
    api.setMonitorBaseUrl(null);
    mockFetch.mockReturnValueOnce(jsonResponse({ results: [], count: 0 }));
    await api.getRequests();
    expect(mockFetch.mock.calls[1][0]).toBe("/api/requests/");
  });

  it("covers auth and scanner endpoints", async () => {
    Object.defineProperty(document, "cookie", { writable: true, value: "csrftoken=test-token" });
    mockFetch.mockReturnValueOnce(jsonResponse({ user: { id: 1, username: "new", email: "n@b.com" } }));
    await api.register("new", "n@b.com", "secret");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ username: "new", email: "n@b.com", password: "secret" });
    mockFetch.mockReturnValueOnce(jsonResponse({ status: "ok" }));
    await api.logout();
    mockFetch.mockReturnValueOnce(jsonResponse({ id: 1, repo_name: "org/repo", scan_status: "scanning" }));
    await api.triggerScan("org/repo");
    expect(JSON.parse(mockFetch.mock.calls[2][1].body)).toEqual({ repo: "org/repo", scan_mode: "fast" });
    mockFetch.mockReturnValueOnce(jsonResponse([]));
    await api.getScanHistory("org/repo");
    expect(mockFetch.mock.calls[3][0]).toBe("/api/github/scans/?repo=org%2Frepo");
  });

  it("covers scan detail and settings endpoints", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ id: 42 }));
    await api.getScanResults(42);
    mockFetch.mockReturnValueOnce(jsonResponse({ id: 1 }));
    await api.getAiReport(5);
    mockFetch.mockReturnValueOnce(jsonResponse({ phases: [], events: [], artifacts: {} }));
    await api.getAdkTraceSnapshot(7);
    Object.defineProperty(document, "cookie", { writable: true, value: "csrftoken=test-token" });
    mockFetch.mockReturnValueOnce(jsonResponse({ google_api_key_set: true, google_api_key_preview: "AIza...1234", gemini_model: "gemini-2.5-pro" }));
    const result = await api.updateSettings({ gemini_model: "gemini-2.5-pro" });
    expect(result.gemini_model).toBe("gemini-2.5-pro");
    mockFetch.mockReturnValueOnce(jsonResponse({ models: ["gemini-2.5-flash", "gemini-2.5-pro"] }));
    expect((await api.getAvailableModels()).models).toHaveLength(2);
  });
});
