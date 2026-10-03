const cp = require("child_process");
const p = cp.spawn(process.execPath, ["dist/index.js"], { stdio: ["pipe", "pipe", "pipe"] });
let buf = "";
let id = 0;
const map = {};
const RPC_TIMEOUT_MS = 30_000;
function rpc(m, params) {
  return new Promise((r, reject) => {
    const i = ++id;
    const timer = setTimeout(() => reject(new Error(`rpc ${m} timed out after ${RPC_TIMEOUT_MS}ms`)), RPC_TIMEOUT_MS);
    map[i] = (msg) => { clearTimeout(timer); r(msg); };
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
const checks = [];
function assert(name, cond, detail) {
  checks.push({ name, ok: Boolean(cond), detail: detail ?? "" });
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}${cond ? "" : " — " + (detail ?? "")}`);
}
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
  assert("14 tools", tools.length === 14, `${tools.length}`);
  const names = tools.map((t) => t.name);
  const sorted = JSON.stringify(names) === JSON.stringify([...names].sort());
  assert("deterministic order", sorted, names.join(","));
  const v = tools.find((t) => t.name === "validate_dashboard");
  assert("title present", v?.title === "Validate dashboard JSON", v?.title);
  assert("annotations present", v?.annotations?.readOnlyHint === true && v?.annotations?.idempotentHint === true, JSON.stringify(v?.annotations));
  assert("outputSchema present", Boolean(v?.outputSchema));
  const annotated = tools.filter((t) => t.annotations).length;
  assert("all tools annotated", annotated === tools.length, `${annotated}/${tools.length}`);
  // resource templates + prompt must be advertised
  const resTemplates = await rpc("resources/templates/list", {});
  const templateUris = (resTemplates.result?.resourceTemplates ?? []).map((t) => t.uriTemplate ?? "");
  assert(
    "3 resource templates advertised",
    templateUris.includes("dashboards://{id}/summary") &&
      templateUris.includes("dashboards://{id}/components/{index}/options") &&
      templateUris.includes("dashboards://{id}/datasources/{index}/schema"),
    JSON.stringify(templateUris),
  );
  const resList = await rpc("resources/list", {});
  assert("static index advertised", (resList.result?.resources ?? []).some((r) => r.uri === "dashboards://index"), JSON.stringify(resList.result?.resources));
  const promptList = await rpc("prompts/list", {});
  assert("build_dashboard prompt advertised", (promptList.result?.prompts ?? []).some((p) => p.name === "build_dashboard"), JSON.stringify(promptList.result?.prompts));
  const c = await rpc("tools/call", {
    name: "validate_dashboard",
      arguments: { dashboard_json: '{"Title":{"Text":"x"},"DataSources":[],"Components":[],"Layout":"{\\"lg\\":[]}","Parameters":[],"Options":"{}"}' },
  });
  assert(
    "structuredContent round-trips",
    c.result?.structuredContent?.valid === true && c.result?.isError !== true,
    JSON.stringify(c.result?.structuredContent),
  );
  p.kill();
  const failed = checks.filter((k) => !k.ok);
  if (failed.length) {
    console.error(`SMOKE FAILED: ${failed.length}/${checks.length} checks`);
    process.exit(1);
  }
  console.log(`SMOKE PASSED: ${checks.length}/${checks.length} checks`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  p.kill();
  process.exit(1);
});
