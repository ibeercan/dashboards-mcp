// Structured observability: one JSON line per event on stderr (stdout carries the
// protocol). DASHBOARDS_MCP_LOG=off silences everything; default "info".
// Counter state lives here so both tools and the HTTP handler record against it.

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const LOG_ENV = (process.env["DASHBOARDS_MCP_LOG"] ?? "").toLowerCase();

function isEnabled(level: LogLevel): boolean {
  if (LOG_ENV === "off" || LOG_ENV === "none") return false;
  if (LOG_ENV === "") return LEVELS[level] >= LEVELS.info;
  const min = (LEVELS[LOG_ENV as LogLevel] ?? LEVELS.info);
  return LEVELS[level] >= min;
}

export function log(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  if (!isEnabled(level)) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  process.stderr.write(`${line}\n`);
}

// --- tool-call counters -------------------------------------------------------

const toolCounters = new Map<string, { count: number; errors: number; totalMs: number }>();

export function recordToolCall(tool: string, durationMs: number, isError: boolean): void {
  const entry = toolCounters.get(tool) ?? { count: 0, errors: 0, totalMs: 0 };
  entry.count += 1;
  if (isError) entry.errors += 1;
  entry.totalMs += durationMs;
  toolCounters.set(tool, entry);
}

export function toolStatsSnapshot(): Array<{ tool: string; count: number; errors: number; avgMs: number }> {
  return [...toolCounters.entries()]
    .map(([tool, s]) => ({ tool, count: s.count, errors: s.errors, avgMs: Math.round(s.totalMs / s.count) }))
    .sort((a, b) => b.count - a.count);
}

export const obs = {
  toolCall(tool: string, durationMs: number, isError: boolean): void {
    log(isError ? "warn" : "info", "tool_call", { tool, durationMs, isError });
    recordToolCall(tool, durationMs, isError);
  },
  httpRequest(method: string, path: string, status: number, durationMs: number): void {
    log(status >= 500 ? "error" : "info", "http_request", { method, path, status, durationMs });
  },
};
