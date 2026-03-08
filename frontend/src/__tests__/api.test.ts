import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Must import after mocking
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Dynamic import so module picks up the mocked fetch
let api: typeof import("../services/api");

beforeEach(async () => {
  vi.resetModules();
  mockFetch.mockReset();
  api = await import("../services/api");
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

describe("fetchJson / CSRF handling", () => {
  it("attaches CSRF token on POST to local endpoint", async () => {
    // Set a CSRF cookie
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "csrftoken=test-csrf-token",
    });

    mockFetch.mockReturnValueOnce(jsonResponse({ user: { id: 1, username: "a", email: "a@b.com" } }));

    await api.login("user", "pass");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/login/");
    expect(init.method).toBe("POST");
    expect(init.headers["X-CSRFToken"]).toBe("test-csrf-token");
    expect(init.credentials).toBe("same-origin");
  });

  it("bootstraps a CSRF cookie before unsafe local requests when missing", async () => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });

    mockFetch.mockImplementationOnce(async (url) => {
      expect(url).toBe("/api/auth/me/");
      document.cookie = "csrftoken=bootstrapped-token";
      return jsonResponse({ authenticated: false });
    });
    mockFetch.mockImplementationOnce(async (url, init) => {
      expect(url).toBe("/api/settings/");
      expect(init?.headers["X-CSRFToken"]).toBe("bootstrapped-token");
      return jsonResponse({
        google_api_key_set: true,
        google_api_key_preview: "AIza...1234",
        gemini_model: "",
      });
    });

    await api.updateSettings({ google_api_key: "AIzaSyBootstrapped" });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("refreshes the CSRF cookie and retries once after a 403", async () => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "csrftoken=stale-token",
    });

    mockFetch.mockImplementationOnce(async (url, init) => {
      expect(url).toBe("/api/settings/");
      expect(init?.headers["X-CSRFToken"]).toBe("stale-token");
      return {
        ok: false,
        status: 403,
        json: async () => ({ error: "CSRF Failed" }),
      };
    });
    mockFetch.mockImplementationOnce(async (url) => {
      expect(url).toBe("/api/auth/me/");
      document.cookie = "csrftoken=fresh-token";
      return jsonResponse({ authenticated: true, user: { id: 1, username: "a", email: "a@b.com" } });
    });
    mockFetch.mockImplementationOnce(async (url, init) => {
      expect(url).toBe("/api/settings/");
      expect(init?.headers["X-CSRFToken"]).toBe("fresh-token");
      return jsonResponse({
        google_api_key_set: false,
        google_api_key_preview: "",
        gemini_model: "gemini-2.5-flash",
      });
    });

    const result = await api.updateSettings({ gemini_model: "gemini-2.5-flash" });

    expect(result.gemini_model).toBe("gemini-2.5-flash");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("does not attach CSRF token on GET requests", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ authenticated: true, user: { id: 1, username: "a", email: "a@b.com" } }));

    await api.getMe();

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-CSRFToken"]).toBeUndefined();
  });

  it("throws Error with body.error message on non-ok response", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "Bad request details" }),
      })
    );

    await expect(api.getMe()).rejects.toThrow("Bad request details");
  });

  it("throws generic HTTP error when body has no error field", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })
    );

    await expect(api.getMe()).rejects.toThrow("HTTP 500");
  });
});

describe("setMonitorBaseUrl", () => {
  it("switches monitor endpoints to remote URL", async () => {
    api.setMonitorBaseUrl("https://remote.example.com/");

    mockFetch.mockReturnValueOnce(jsonResponse({ results: [], count: 0 }));
    await api.getRequests();

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://remote.example.com/api/requests/");
    // Remote calls should omit credentials
    expect(init.credentials).toBe("omit");
  });

  it("resets to local when null", async () => {
    api.setMonitorBaseUrl(null);

    mockFetch.mockReturnValueOnce(jsonResponse({ results: [], count: 0 }));
    await api.getRequests();

    expect(mockFetch.mock.calls[0][0]).toBe("/api/requests/");
  });
});

describe("auth API functions", () => {
  it("register sends correct payload", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ user: { id: 1, username: "new", email: "n@b.com" } }));

    const result = await api.register("new", "n@b.com", "secret");

    expect(result.user.username).toBe("new");
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/register/");
    expect(JSON.parse(init.body)).toEqual({ username: "new", email: "n@b.com", password: "secret" });
  });

  it("logout calls POST", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ status: "ok" }));

    await api.logout();

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/logout/");
    expect(init.method).toBe("POST");
  });
});

describe("scanner API functions", () => {
  it("triggerScan sends repo name", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ id: 1, repo_name: "org/repo", scan_status: "scanning" }));

    await api.triggerScan("org/repo");

    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ repo: "org/repo" });
  });

  it("getScanResults fetches correct URL", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ id: 42 }));

    await api.getScanResults(42);

    expect(mockFetch.mock.calls[0][0]).toBe("/api/github/scan/42/");
  });

  it("getAiReport fetches correct URL", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ id: 1 }));

    await api.getAiReport(5);

    expect(mockFetch.mock.calls[0][0]).toBe("/api/github/scan/5/ai-report/");
  });

  it("getAdkTraceSnapshot fetches correct URL", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ phases: [], events: [], artifacts: {} }));

    await api.getAdkTraceSnapshot(7);

    expect(mockFetch.mock.calls[0][0]).toBe("/api/github/scan/7/adk-trace/");
  });
});

describe("settings API functions", () => {
  it("updateSettings sends PUT with model", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ google_api_key_set: true, google_api_key_preview: "AIza...1234", gemini_model: "gemini-2.5-pro" })
    );

    const result = await api.updateSettings({ gemini_model: "gemini-2.5-pro" });

    expect(result.gemini_model).toBe("gemini-2.5-pro");
    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ gemini_model: "gemini-2.5-pro" });
  });

  it("getAvailableModels fetches models endpoint", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ models: ["gemini-2.5-flash", "gemini-2.5-pro"] }));

    const result = await api.getAvailableModels();

    expect(result.models).toHaveLength(2);
    expect(mockFetch.mock.calls[0][0]).toBe("/api/settings/models/");
  });
});
