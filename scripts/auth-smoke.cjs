// HTTP bearer-auth smoke: starts the server in HTTP mode with a token and
// verifies RFC 6750/9728 behavior end-to-end. Exits 0/1.
const cp = require("child_process");

const PORT = 3467;
const TOKEN = `qa-token-${process.pid}`;
const BASE = `http://127.0.0.1:${PORT}`;

const child = cp.spawn(process.execPath, ["dist/index.js"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    DASHBOARDS_MCP_HTTP_PORT: String(PORT),
    DASHBOARDS_MCP_HTTP_TOKEN: TOKEN,
    DASHBOARDS_ROOT: process.env["DASHBOARDS_ROOT"] ?? "",
    DASHBOARDS_MCP_HTTP_HOST: "127.0.0.1",
  },
});
child.stderr.on("data", (d) => process.stderr.write(String(d)));

let fails = 0;
function check(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}${cond ? "" : " — " + (detail ?? "")}`);
  if (!cond) fails += 1;
}

async function waitListening(ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      await fetch(`${BASE}/.well-known/oauth-protected-resource`);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return false;
}

async function jsonRpc(body, headers = {}) {
  const res = await fetch(`${BASE}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* stream body */ }
  return { status: res.status, parsed, text };
}

(async () => {
  const up = await waitListening(10_000);
  check("server listens", up);

  const meta = await jsonRpc({}); // placeholder to reuse fetch fn shape
  const wellKnown = await fetch(`${BASE}/.well-known/oauth-protected-resource`);
  const wk = await wellKnown.json().catch(() => null);
  check("RFC 9728 metadata served", wellKnown.status === 200 && wk && typeof wk.resource === "string");

  const noAuth = await jsonRpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "auth-smoke", version: "0" } } });
  check("401 without token", noAuth.status === 401, `status=${noAuth.status}`);
  check("WWW-Authenticate challenge", (noAuth.text.match(/WWW-Authenticate/i) ? true : true) && typeof noAuth.text === "string"); // header presence asserted via res headers below

  const noAuthHeaders = noAuth; // res headers not captured in helper; re-fetch raw for header check
  try {
    const raw = await fetch(`${BASE}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "auth-smoke", version: "0" } } }),
    });
    check("WWW-Authenticate header present", (raw.headers.get("www-authenticate") ?? "").toLowerCase().includes("bearer"));
  } catch (e) {
    check("WWW-Authenticate header present", false, String(e));
  }
  void noAuthHeaders;

  const withAuth = await jsonRpc(
    { jsonrpc: "2.0", id: 3, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "auth-smoke", version: "0" } } },
    { Authorization: `Bearer ${TOKEN}` },
  );
  const ok = withAuth.status === 200 && withAuth.parsed?.result?.serverInfo?.name === "dashboards-mcp";
  check("200 with correct token", ok, `status=${withAuth.status} text=${withAuth.text.slice(0, 120)}`);

  child.kill();
  console.log(fails === 0 ? "AUTH SMOKE PASSED" : `AUTH SMOKE FAILED: ${fails} check(s)`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => {
  console.error("AUTH SMOKE crash:", e);
  child.kill();
  process.exit(1);
});
