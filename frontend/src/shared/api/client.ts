const LOCAL_BASE = "/api";
let monitorBase = "/api";

export function getLocalBaseUrl() {
  return LOCAL_BASE;
}

export function setMonitorBaseUrl(url: string | null) {
  monitorBase = url ? `${url.replace(/\/$/, "")}/api` : "/api";
}

export function getMonitorBaseUrl(): string | null {
  return monitorBase === "/api" ? null : monitorBase;
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

let csrfBootstrapPromise: Promise<string> | null = null;

async function ensureCsrfToken(forceRefresh = false): Promise<string> {
  const existingToken = getCsrfToken();
  if (existingToken && !forceRefresh) {
    return existingToken;
  }

  if (!csrfBootstrapPromise || forceRefresh) {
    csrfBootstrapPromise = fetch(`${LOCAL_BASE}/auth/me/`, {
      credentials: "same-origin",
    })
      .catch(() => undefined)
      .then(() => getCsrfToken())
      .finally(() => {
        csrfBootstrapPromise = null;
      });
  }

  return csrfBootstrapPromise;
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const isRemote = !url.startsWith("/");
  const method = init?.method?.toUpperCase() || "GET";
  const needsCsrf = !isRemote && ["POST", "PUT", "DELETE", "PATCH"].includes(method);

  const doFetch = async (forceCsrfRefresh = false) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
    };

    if (needsCsrf) {
      const csrfToken = await ensureCsrfToken(forceCsrfRefresh);
      if (csrfToken) {
        headers["X-CSRFToken"] = csrfToken;
      }
    }

    return fetch(url, {
      ...init,
      headers,
      credentials: isRemote ? "omit" : "same-origin",
    });
  };

  let response = await doFetch();
  if (!isRemote && needsCsrf && response.status === 403) {
    response = await doFetch(true);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${response.status}`);
  }

  return response.json();
}
