import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import { dashboardSummary, componentOptions, dataSourceSchema } from "./resources.js";
import { listDashboards } from "./storage.js";
import { toolStatsSnapshot } from "./logger.js";

/**
 * Thin read-only resources for agents: summaries first, heavy payload parts
 * addressed by URI. URIs:
 *   dashboards://{id}/summary
 *   dashboards://{id}/components/{index}/options
 *   dashboards://{id}/datasources/{index}/schema
 */

interface TemplateParams {
  id: string;
  index?: string;
}

type TemplateReader = (uri: URL, vars: Variables) => Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }>;

// URI templates use plain `{param}` captures (no explode), so match() yields
// single strings per variable — safe to decode + String() here.
function paramsOf(vars: Variables): TemplateParams {
  const id = decodeURIComponent(String(vars["id"]));
  const index = vars["index"] !== undefined ? String(vars["index"]) : undefined;
  return { id, index };
}

export function publishResources(server: McpServer): void {
  const template = (name: string, uri: string, meta: Record<string, unknown>, reader: TemplateReader) =>
    // SDK 1.32: template registration REQUIRES a ResourceTemplate instance —
    // a plain string goes through the static-resource path and never matches.
    // Meta must be cast (overload is untyped-generic in this SDK version), but
    // the reader callback is fully typed.
    server.resource(name, new ResourceTemplate(uri, { list: undefined }), meta as never, reader as never);

  template(
    "dashboard_summary",
    "dashboards://{id}/summary",
    {
      title: "Dashboard summary",
      description: "Thin view of a dashboard: components, types, data sources — a few hundred bytes.",
      mimeType: "application/json",
    },
    async (uri, { id }) => {
      const sid = decodeURIComponent(String(id));
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await dashboardSummary(sid), null, 2) }] };
    },
  );

  // Object-list entry point so MCP clients can enumerate without calling tools.
  server.registerResource(
    "dashboards_index",
    "dashboards://index",
    {
      title: "Dashboard index",
      description: "One-line summaries of every dashboard (defaults + custom).",
      mimeType: "application/json",
    },
    async () => {
      const metas = await listDashboards();
      return {
        contents: [
          {
            uri: new URL("dashboards://index").href,
            text: JSON.stringify(
              metas.map((m) => ({ id: m.id, name: m.name, isDefault: m.isDefault })),
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // Ops/observability surface: per-tool call counts, error counts, avg latency.
  server.registerResource(
    "dashboards_stats",
    "dashboards://stats",
    {
      title: "MCP server stats",
      description: "Per-tool call counters (count/errors/avg latency) since server start.",
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri: new URL("dashboards://stats").href,
          text: JSON.stringify({ tools: toolStatsSnapshot() }, null, 2),
        },
      ],
    }),
  );

  template(
    "dashboard_component_options",
    "dashboards://{id}/components/{index}/options",
    {
      title: "Component options",
      description: "Options/Interactivity of one component, decoded from JSON-in-JSON.",
      mimeType: "application/json",
    },
    async (uri, { id, index }) => {
      const sid = decodeURIComponent(String(id));
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(await componentOptions(sid, Number(index)), null, 2),
          },
        ],
      };
    },
  );

  template(
    "dashboard_datasource_schema",
    "dashboards://{id}/datasources/{index}/schema",
    {
      title: "Data source schema",
      description: "Query columns/tables of one data source without the full dashboard JSON.",
      mimeType: "application/json",
    },
    async (uri, { id, index }) => {
      const sid = decodeURIComponent(String(id));
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(await dataSourceSchema(sid, Number(index)), null, 2),
          },
        ],
      };
    },
  );
}
