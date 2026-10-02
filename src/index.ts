import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { buildTools } from "./tools.js";

const server = new McpServer({ name: "dashboards-mcp", version: "1.1.0" });

for (const tool of buildTools().tools) {
  server.registerTool(tool.name, {
    title: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }, tool.run);
}

const httpPort = process.env["DASHBOARDS_MCP_HTTP_PORT"];

if (httpPort) {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  const httpServer = createServer(async (req, res) => {
    await transport.handleRequest(req, res);
  });
  await new Promise<void>((resolve) => httpServer.listen(Number(httpPort), () => resolve()));
  process.stderr.write(`dashboards-mcp is running on streamable HTTP at http://localhost:${httpPort}/\n`);
} else {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("dashboards-mcp is running on stdio\n");
}
