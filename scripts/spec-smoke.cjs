const cp = require("child_process");
const p = cp.spawn(process.execPath, ["dist/index.js"], { stdio: ["pipe", "pipe", "pipe"] });
let buf = "";
let id = 0;
const map = {};
function rpc(m, params) {
  return new Promise((r) => {
    const i = ++id;
    map[i] = r;
    p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: i, method: m, params }) + "\n");
  });
}
p.stdout.on("data", (d) => {
  buf += d;
  let n;
  while ((n = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, n);
    buf = buf.slice(n + 1);
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && map[msg.id]) {
        map[msg.id](msg);
        delete map[msg.id];
      }
    } catch {
      /* partial */
    }
  }
});
(async () => {
  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0" },
  });
  p.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  const list = await rpc("tools/list", {});
  const tools = list.result.tools;
  console.log("tools:", tools.length);
  const names = tools.map((t) => t.name);
  console.log("deterministic order:", JSON.stringify(names) === JSON.stringify([...names].sort()) ? "SORTED" : "NOT SORTED: " + names.join(","));
  const v = tools.find((t) => t.name === "validate_dashboard");
  console.log("title:", v.title);
  console.log("annotations:", JSON.stringify(v.annotations));
  console.log("outputSchema present:", Boolean(v.outputSchema));
  const annotated = tools.filter((t) => t.annotations).length;
  console.log("tools with annotations:", annotated + "/" + tools.length);
  const c = await rpc("tools/call", {
    name: "validate_dashboard",
    arguments: { dashboard_json: '{"Title":{"Text":"x"},"DataSources":[],"Components":[],"Layout":"","Parameters":[]}' },
  });
  console.log("structuredContent:", JSON.stringify(c.result.structuredContent));
  console.log("isError:", Boolean(c.result.isError));
  p.kill();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  p.kill();
  process.exit(1);
});
