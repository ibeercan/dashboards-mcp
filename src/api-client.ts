import type { CommonResponse, DashboardDto } from "./types.js";

const API_BASE_PATH = "/api/Dashboards";

function apiBaseUrl(): string {
  const url = process.env["DASHBOARDS_API_URL"];
  if (!url) {
    throw new Error(
      "DASHBOARDS_API_URL is not set. Provide the running backend base URL (e.g. https://localhost:5001)."
    );
  }
  return url.replace(/\/+$/, "");
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(Number(process.env["DASHBOARDS_API_TIMEOUT_MS"] ?? 60000)),
  });
  if (!response.ok) {
    throw new Error(`${method} ${url} failed: HTTP ${response.status}`);
  }
  const envelope = (await response.json()) as CommonResponse<T>;
  if (envelope.Error?.Code) {
    throw new Error(`API error ${envelope.Error.Code} on ${method} ${url}`);
  }
  return envelope.Data as T;
}

export function apiListDashboards(): Promise<Array<{ Id: string; Name: string }>> {
  return request<Array<{ Id: string; Name: string }>>("GET", apiBaseUrl() + API_BASE_PATH);
}

export function apiGetDashboard(id: string): Promise<DashboardDto | null> {
  return request<DashboardDto | null>("GET", `${apiBaseUrl() + API_BASE_PATH}/${encodeURIComponent(id)}`);
}

export function apiCreateDashboard(dashboard: DashboardDto): Promise<DashboardDto | null> {
  return request<DashboardDto | null>("POST", apiBaseUrl() + API_BASE_PATH, dashboard);
}

export function apiUpdateDashboard(dashboard: DashboardDto): Promise<DashboardDto | null> {
  return request<DashboardDto | null>("PUT", apiBaseUrl() + API_BASE_PATH, dashboard);
}

export function apiDeleteDashboard(id: string): Promise<boolean> {
  return request<boolean>("DELETE", `${apiBaseUrl() + API_BASE_PATH}/${encodeURIComponent(id)}`);
}
