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

describe("fetchJson / CSRF handling", () => {
  it("attaches CSRF token on POST to local endpoint", async () => {
    Object.defineProperty(document, "cookie", { writable: true, value: "csrftoken=test-csrf-token" });
    mockFetch.mockReturnValueOnce(jsonResponse({ user: { id: 1, username: "a", email: "a@b.com" } }));
    await api.login("user", "pass");
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/login/");
    expect(init.headers["X-CSRFToken"]).toBe("test-csrf-token");
  });

  it("bootstraps and refreshes CSRF cookies for unsafe requests", async () => {
    Object.defineProperty(document, "cookie", { writable: true, value: "" });
    mockFetch.mockImplementationOnce(async () => {
      document.cookie = "csrftoken=bootstrapped-token";
      return jsonResponse({ authenticated: false });
    });
    mockFetch.mockImplementationOnce(async (_url, init) => {
      expect(init?.headers["X-CSRFToken"]).toBe("bootstrapped-token");
      return jsonResponse({ google_api_key_set: true, google_api_key_preview: "AIza...1234", gemini_model: "" });
    });
    await api.updateSettings({ google_api_key: "AIzaSyBootstrapped" });

    Object.defineProperty(document, "cookie", { writable: true, value: "csrftoken=stale-token" });
    mockFetch.mockImplementationOnce(async () => ({ ok: false, status: 403, json: async () => ({ error: "CSRF Failed" }) }));
    mockFetch.mockImplementationOnce(async () => {
      document.cookie = "csrftoken=fresh-token";
      return jsonResponse({ authenticated: true, user: { id: 1, username: "a", email: "a@b.com" } });
    });
    mockFetch.mockImplementationOnce(async (_url, init) => {
      expect(init?.headers["X-CSRFToken"]).toBe("fresh-token");
      return jsonResponse({ google_api_key_set: false, google_api_key_preview: "", gemini_model: "gemini-2.5-flash" });
    });
    const result = await api.updateSettings({ gemini_model: "gemini-2.5-flash" });
    expect(result.gemini_model).toBe("gemini-2.5-flash");
  });

  it("does not attach CSRF token on GET requests and surfaces errors", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ authenticated: true, user: { id: 1, username: "a", email: "a@b.com" } }));
    await api.getMe();
    expect(mockFetch.mock.calls[0][1].headers["X-CSRFToken"]).toBeUndefined();

    mockFetch.mockReturnValueOnce(Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: "Bad request details" }) }));
    await expect(api.getMe()).rejects.toThrow("Bad request details");

    mockFetch.mockReturnValueOnce(Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }));
    await expect(api.getMe()).rejects.toThrow("HTTP 500");
  });
});
