import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { buildTools } from "./tools.js";

const SERVER_VERSION = "1.2.0";
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
