import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dashboardSummary, componentOptions, dataSourceSchema } from "./resources.js";
import { listDashboards } from "./storage.js";

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

export function publishResources(server: McpServer): void {
  const template = (name: string, uri: string, meta: Record<string, unknown>, reader: (uri: URL, params: TemplateParams) => Promise<{ contents: unknown[] }>) =>
    // SDK 1.32: template registration goes through resource(); a template string
    // argument (contains "{param}") selects the template overload.
    server.resource(name, uri, meta as never, reader as never);

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
