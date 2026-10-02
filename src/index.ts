import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { buildTools } from "./tools.js";
import { publishResources } from "./resource-handlers.js";
import { log, toolStatsSnapshot } from "./logger.js";

const SERVER_VERSION = "1.4.0";
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
// Optional static bearer token: when set, every HTTP request must carry
// `Authorization: Bearer <token>` (RFC 6750) and RFC 9728 protected-resource
// metadata is served so OAuth-aware clients can discover the requirement.
const HTTP_TOKEN = process.env["DASHBOARDS_MCP_HTTP_TOKEN"] ?? "";

function bearerOf(req: IncomingMessage): string | undefined {
  const header = req.headers["authorization"];
  if (typeof header !== "string") return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : undefined;
}

function authorize(req: IncomingMessage): boolean {
  if (HTTP_TOKEN === "") return true;
  return bearerOf(req) === HTTP_TOKEN;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

if (httpPort) {
  const port = Number(httpPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`DASHBOARDS_MCP_HTTP_PORT '${httpPort}' is not a valid TCP port`);
  }
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  const httpServer = createServer(async (req, res) => {
    const startedAt = Date.now();
    const eventPath = req.url ?? "/";
    // RFC 9728 protected-resource metadata — served unauthenticated by design;
    // it only ADVERTISES the token requirement, it grants nothing.
    if (HTTP_TOKEN !== "" && eventPath === "/.well-known/oauth-protected-resource") {
      json(res, 200, {
        resource: `http://${BOUND_HOST}:${port}/`,
        authorization_servers: [],
        bearer_methods_supported: ["header"],
        resource_documentation: "https://github.com/ibeercan/dashboards-mcp#connecting-an-agent",
      });
      log("info", "http_request", { method: req.method, path: eventPath, status: 200, durationMs: Date.now() - startedAt });
      return;
    }
    if (!authorize(req)) {
      // RFC 6750 §3.1: challenge the client, never disclose which part was wrong.
      res.writeHead(401, { "WWW-Authenticate": 'Bearer realm="dashboards-mcp"', "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized: bearer token required" }, id: null }));
      log("warn", "http_request", { method: req.method, path: eventPath, status: 401, durationMs: Date.now() - startedAt });
      return;
    }
    try {
      await transport.handleRequest(req, res);
      log("info", "http_request", { method: req.method, path: eventPath, status: res.statusCode, durationMs: Date.now() - startedAt });
    } catch (e) {
      json(res, 500, { jsonrpc: "2.0", error: { code: -32700, message: "Internal error" }, id: null });
      log("error", "http_request_failed", { method: req.method, path: eventPath, message: (e as Error).message, durationMs: Date.now() - startedAt });
    }
  });
  await new Promise<void>((resolve, reject) => httpServer.listen(port, BOUND_HOST, () => resolve()).on("error", reject));
  const authTag = HTTP_TOKEN !== "" ? "bearer-token required" : "auth-free — bind it to localhost or set DASHBOARDS_MCP_HTTP_TOKEN";
  log("info", "server_started", { transport: "http", url: `http://${BOUND_HOST}:${port}/`, auth: HTTP_TOKEN !== "" ? "bearer" : "none" });
  process.stderr.write(`[dashboards-mcp] streamable HTTP on http://${BOUND_HOST}:${port}/ (${authTag})\n`);
} else {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("info", "server_started", { transport: "stdio" });
  process.stderr.write("dashboards-mcp is running on stdio\n");
}

// liveness surface for ops: how much work the server has done since start
setInterval(() => {
  const stats = toolStatsSnapshot();
  if (stats.length > 0) log("debug", "tool_stats", { stats });
}, 60_000).unref();
