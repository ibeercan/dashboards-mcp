import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildTools } from "./tools.js";

const server = new McpServer({ name: "dashboards-mcp", version: "1.0.0" });

for (const tool of buildTools().tools) {
  server.registerTool(tool.name, {
    title: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }, tool.run);
}

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("dashboards-mcp is running on stdio\n");
