import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { z } from "zod";
import { buildTools } from "./tools.js";
import { publishResources } from "./resource-handlers.js";

const SERVER_VERSION = "1.3.2";
const server = new McpServer({
  name: "dashboards-mcp",
  version: SERVER_VERSION,
  title: "Dispather Dashboards MCP",
  websiteUrl: "https://github.com/ibeercan/dashboards-mcp",
});

// Deterministic tools/list order (spec 2026-07-28): sort by name before registering.
for (const tool of [...buildTools().tools].sort((a, b) => a.name.localeCompare(b.name))) {
  server.registerTool(tool.name, {
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
    ...(tool.annotations ? { annotations: tool.annotations } : {}),
  }, tool.run);
}

// Agent-friendly thin views: summaries first, heavy parts addressed by URI.
publishResources(server);

// Prompt recipes move the agent from inventing call sequences to following them.
server.registerPrompt(
  "build_dashboard",
  {
    title: "Build a dashboard",
    description:
      "Step-by-step recipe for building a dashboard: inspect component types and real Options examples, dry-run the draft, create it, verify the data source returns rows, and clean up if the data is wrong.",
    argsSchema: {
      title: z.string().describe("New dashboard title (Title.Text — it becomes the file ID verbatim)"),
      componentType: z.string().optional().describe("Primary component type, e.g. table, chart, pivotTable"),
    },
  },
  ({ title, componentType }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: [
            `Build a dashboard titled "${title}".`,
            componentType ? `The main component type is "${componentType}".` : "",
            "Follow these steps exactly:",
            "1. list_dashboards — learn existing IDs and avoid collisions.",
            componentType
              ? `2. get_component_schema type="${componentType}" — copy real-world Options/Interactivity shapes.`
              : "2. get_component_schema for your intended type — copy real-world Options/Interactivity shapes.",
            "3. Write the dashboard JSON: Title.Text = the title, one DataSource with Connection {\"Name\":\"Industry\"} and one Query built from get_tables_info columns, Components referencing that source.",
            "4. dry_run_dashboard on the draft — fix any validation or inner-JSON issues it reports.",
            "5. create_dashboard with the fixed JSON.",
            "6. query_data using the created dashboard's DataSource (dataFields need unique Ids 1,2,3…). If the data is wrong, tell the user the exact mismatch.",
            "Never write into _default dashboards; never guess Options — reuse shapes from step 2.",
          ].filter(Boolean).join("\n"),
        },
      },
    ],
  }),
);

const httpPort = process.env["DASHBOARDS_MCP_HTTP_PORT"];
const BOUND_HOST = process.env["DASHBOARDS_MCP_HTTP_HOST"] ?? "127.0.0.1";

if (httpPort) {
  const port = Number(httpPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`DASHBOARDS_MCP_HTTP_PORT '${httpPort}' is not a valid TCP port`);
  }
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  const httpServer = createServer(async (req, res) => {
    try {
      await transport.handleRequest(req, res);
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Internal error" }, id: null }));
      process.stderr.write(`[dashboards-mcp] request failed: ${(e as Error).message}\n`);
    }
  });
  await new Promise<void>((resolve, reject) => httpServer.listen(port, BOUND_HOST, () => resolve()).on("error", reject));
  process.stderr.write(
    `[dashboards-mcp] streamable HTTP on http://${BOUND_HOST}:${port}/ (auth-free — bind it to localhost or put it behind a reverse proxy)\n`
  );
} else {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("dashboards-mcp is running on stdio\n");
}
