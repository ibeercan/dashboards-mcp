// MCP stdio smoke test: initialize + tools/list + tools/call
const { spawn } = require("node:child_process");
const path = require("node:path");

const server = spawn("node", [path.join(__dirname, "..", "dist", "index.js")], {
  env: { ...process.env },
});
let buffer = "";
const pending = new Map();

server.stdout.on("data", (d) => {
  buffer += d;
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
      }
    } catch {
      // ignore partial
    }
  }
});
server.stderr.on("data", (d) => process.stderr.write(d));

function send(msg) { server.stdin.write(JSON.stringify(msg) + "\n"); return new Promise((r) => pending.set(msg.id, r)); }

(async () => {
  const init = await send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "1" } } });
  console.log("SERVER:", init.result.serverInfo.name, init.result.serverInfo.version);
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  const list = await send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  console.log("TOOLS:", list.result.tools.map((t) => t.name).join(", "));

  // tools/call: list_dashboards
  const call = await send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "list_dashboards", arguments: {} } });
  const dashboards = JSON.parse(call.result.content[0].text);
  console.log("list_dashboards ->", dashboards.length, "dashboards");

  // tools/call: validate_dashboard with bad JSON
  const bad = await send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "validate_dashboard", arguments: { dashboard_json: "{ not json" } } });
  console.log("validate bad -> has error:", /error/i.test(bad.result.content[0].text));

  server.kill();
  process.exit(0);
})().catch((e) => { console.error(e); server.kill(); process.exit(1); });
