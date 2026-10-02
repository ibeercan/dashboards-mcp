#!/usr/bin/env node
/**
 * QA batch for dashboards-mcp (spawns the real server over stdio).
 * Run: node scripts/qa.cjs        (from mcp-server/)
 * Exit code 0 = all scenarios pass.
 */
const { spawn } = require("node:child_process");
const path = require("node:path");
const os = require("node:os");

const CWD = path.join(__dirname, "..");

const server = spawn(process.execPath, [path.join(CWD, "dist", "index.js")], {
  cwd: CWD,
  env: { ...process.env, DASHBOARDS_MCP_HTTP_PORT: "" },
});
server.stderr.on("data", (d) => {
  if (String(d).includes("is not valid JSON")) console.log("  [server]", String(d).trim());
});

let nextId = 0;
const pending = new Map();
let buffer = "";

server.stdout.on("data", (chunk) => {
  buffer += String(chunk);
  let nl;
  while ((nl = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

function rpc(method, params) {
  return new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve({ id, error: { message: "timeout" } });
      }
    }, 30000);
  });
}

async function tool(name, args) {
  const r = await rpc("tools/call", { name, arguments: args ?? {} });
  if (r.error) return { isError: true, text: r.error.message };
  const out = r.result ?? {};
  const item = (out.content ?? [])[0];
  return { isError: out.isError === true, text: item && item.text, raw: out };
}

function json(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const results = [];
function check(scenario, pass, detail) {
  results.push({ scenario, pass });
  console.log(`${pass ? "PASS" : "FAIL"} ${scenario}${pass ? "" : `: ${detail ?? ""}`}`);
}

function cleanup() {
  server.kill();
}

async function main() {
  const init = await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "qa-batch", version: "0.0.0" },
  });
  check("P0 initialize handshake", Boolean(init.result?.serverInfo?.name === "dashboards-mcp"), "no serverInfo");

  await rpc("notifications/initialized", {});
  const listed = await rpc("tools/list", {});
  const names = (listed.result?.tools ?? []).map((t) => t.name);
  check(
    "P0 tools list complete",
    names.length === 14 && names.includes("list_dashboards") && names.includes("query_data"),
    `got ${names.length}: ${names.join(",")}`
  );

  // -- resources / prompts (permanent surfaces) ------------------------------
  const resList = await rpc("resources/list", {});
  const resUris = (resList.result?.resources ?? []).map((r) => r.uri);
  check(
    "P0 static resources advertised",
    resUris.includes("dashboards://index"),
    JSON.stringify(resUris),
  );
  const resTemplates = await rpc("resources/templates/list", {});
  const templateUris = (resTemplates.result?.resourceTemplates ?? []).map((t) => pUri(t));
  function pUri(t) { return t.uriTemplate ?? t.uri ?? ""; }
  check(
    "P0 resource templates advertised",
    templateUris.includes("dashboards://{id}/summary") &&
      templateUris.includes("dashboards://{id}/components/{index}/options") &&
      templateUris.includes("dashboards://{id}/datasources/{index}/schema"),
    JSON.stringify(templateUris),
  );
  const idx = await rpc("resources/read", { uri: "dashboards://index" });
  const idxText = idx.result?.contents?.[0]?.text;
  check("P0 resources/read index", Boolean(idxText && idxText.includes("isDefault")), (idxText ?? "").slice(0, 120));
  const promptList = await rpc("prompts/list", {});
  const promptNames = (promptList.result?.prompts ?? []).map((p) => p.name);
  check("P0 prompt advertised", promptNames.includes("build_dashboard"), JSON.stringify(promptNames));
  const promptGet = await rpc("prompts/get", {
    name: "build_dashboard",
    arguments: { title: "QA TEMP prompt probe", componentType: "table" },
  });
  const promptMsg = promptGet.result?.messages?.[0]?.content?.text ?? "";
  check(
    "P0 prompts/get build_dashboard",
    promptMsg.includes("dry_run_dashboard") && promptMsg.includes("query_data"),
    promptMsg.slice(0, 120),
  );

  // -- list/get -------------------------------------------------------------
  const listRaw = json((await tool("list_dashboards")).text);
  const list = Array.isArray(listRaw) ? listRaw : listRaw?.dashboards ?? [];
  check("P0 list returns dashboards", Array.isArray(list) && list.length >= 10, `${list.length}`);
  check("P0 defaults hydrated with _default", list.some((m) => m.isDefault && m.id.endsWith("_default")), "no default meta");

  const getList = list.find((m) => m.isDefault);
  const sum = await rpc("resources/read", { uri: `dashboards://${encodeURIComponent(getList.id)}/summary` });
  const sumText = sum.result?.contents?.[0]?.text;
  check(
    "P0 resources/read summary template resolves",
    Boolean(sumText && sumText.includes(getList.id)),
    (sum.error ? JSON.stringify(sum.error) : (sumText ?? "empty")).slice(0, 200),
  );
  const got = json((await tool("get_dashboard", { id: getList.id })).text);
  check("P0 get default hydrates Id/IsDefault", got?.Id === getList.id && got?.IsDefault === true, JSON.stringify(got?.Id));

  // -- _default protection --------------------------------------------------
  const updDef = await tool("update_dashboard", { dashboard_json: JSON.stringify({ ...got, Title: { Text: getList.id.replace("_default", "") } }) });
  check("P1 update default rejected", updDef.isError === true, updDef.text);
  const defTitle = (await tool("get_dashboard", { id: getList.id }));
  check("P1 default untouched after rejected update", !defTitle.isError, defTitle.text);

  const dryDel = await tool("delete_dashboard", { id: getList.id });
  check("P1 delete default rejected", dryDel.isError === true, dryDel.text);
  const stillThere = json((await tool("get_dashboard", { id: getList.id })).text);
  check("P1 default still exists after rejected delete", Boolean(stillThere?.Id), "missing");

  const dryUpdDef = json((await tool("dry_run_dashboard", { dashboard_json: JSON.stringify(got) })).text);
  check("P0 dry_run update on default previews readOnly", dryUpdDef?.preview?.readOnly === true && dryUpdDef?.preview?.operation === "update", JSON.stringify(dryUpdDef?.preview));

  // -- CRUD round-trip ------------------------------------------------------
  const T = `QA TEMP roundtrip ${process.pid}`;
  const created = await tool("create_dashboard", {
    dashboard_json: JSON.stringify({ Title: { Text: T }, DataSources: [], Components: [], Parameters: [] }),
  });
  const created1 = json(created.text);
  check("P0 create returns id + path", !created.isError && created1?.id === T && typeof created1?.path === "string", created.text);
  const customRaw = json((await tool("list_dashboards")).text);
  const customList = Array.isArray(customRaw) ? customRaw : customRaw?.dashboards ?? [];
  check("P0 created appears in list", customList.some((m) => m.id === T), "missing in list");

  const upd = await tool("update_dashboard", {
    dashboard_json: JSON.stringify({ Id: T, Title: { Text: T }, DataSources: [], Components: [], Parameters: [], Options: "{}" }),
  });
  check("P0 update custom ok", !upd.isError, upd.text);

  const dupCreate = await tool("create_dashboard", {
    dashboard_json: JSON.stringify({ Title: { Text: T }, DataSources: [], Components: [], Parameters: [] }),
  });
  const dup1 = json(dupCreate.text);
  check("P0 collision id '(1)'", !dupCreate.isError && dup1?.id === `${T} (1)`, dupCreate.text);

  const dryNew = json((await tool("dry_run_dashboard", { dashboard_json: JSON.stringify({ Title: { Text: T }, DataSources: [], Components: [], Parameters: [] }) })).text);
  check("P0 dry_run create shows collision preview", dryNew?.preview?.id === `${T} (2)`, JSON.stringify(dryNew?.preview));

  const dryUpd = json((await tool("dry_run_dashboard", { dashboard_json: JSON.stringify({ Id: T, Title: { Text: T }, DataSources: [], Components: [], Parameters: [] }) })).text);
  check("P0 dry_run update existing previews exists", dryUpd?.preview?.exists === true, JSON.stringify(dryUpd?.preview));

  const rm = await tool("delete_dashboard", { id: T });
  check("P0 delete custom ok", !rm.isError && json(rm.text)?.deleted === true, rm.text);
  const afterDelete = await tool("get_dashboard", { id: T });
  const failed = (r) => r.isError === true || Boolean(json(r.text)?.error); // get_dashboard wraps failures as {error, hint}
  check("P0 get deleted fails", failed(afterDelete), afterDelete.text);
  const rmDup = await tool("delete_dashboard", { id: dup1.id });
  await tool("delete_dashboard", { id: dup1.id }).catch(() => {});
  check("P0 delete collision copy ok", !rmDup.isError && json(rmDup.text)?.deleted === true, rmDup.text);

  // -- validation -----------------------------------------------------------
  const badJson = await tool("create_dashboard", { dashboard_json: "{ nope" });
  check("P1 invalid JSON rejected", badJson.isError === true, badJson.text);
  const noTitle = await tool("create_dashboard", { dashboard_json: JSON.stringify({ DataSources: [] }) });
  check("P1 missing Title rejected", noTitle.isError === true, noTitle.text);
  const noIdUpd = await tool("update_dashboard", { dashboard_json: JSON.stringify({ Title: { Text: "x" }, DataSources: [] }) });
  check("P1 update without Id rejected", noIdUpd.isError === true, noIdUpd.text);
  const ghost = await tool("get_dashboard", { id: "no such dashboard ёж_424242" });
  check("P1 get nonexistent fails", failed(ghost), ghost.text);

  const unicodeTitle = `QA TEMP юникод ЁЖ ${process.pid}`;
  const uni = await tool("create_dashboard", { dashboard_json: JSON.stringify({ Title: { Text: unicodeTitle }, DataSources: [], Components: [], Parameters: [] }) });
  check("P1 unicode title ok", !uni.isError && json(uni.text)?.id === unicodeTitle, uni.text);
  if (!uni.isError) await tool("delete_dashboard", { id: unicodeTitle });

  const emptyTitle = await tool("create_dashboard", { dashboard_json: JSON.stringify({ Title: { Text: "   " }, DataSources: [], Components: [], Parameters: [] }) });
  check("P1 whitespace fallback id", !emptyTitle.isError && json(emptyTitle.text)?.id.length > 0, emptyTitle.text);
  const emptyId1 = json(emptyTitle.text)?.id;
  if (emptyId1) await tool("delete_dashboard", { id: emptyId1 });

  // -- security -------------------------------------------------------------
  const traversal = await tool("create_dashboard", { dashboard_json: JSON.stringify({ Title: { Text: `..${path.sep}evil` }, DataSources: [], Components: [], Parameters: [] }) });
  check("P2 traversal title rejected or contained", traversal.isError === true, traversal.text);

  const traversalId = await tool("get_dashboard", { id: `..${path.sep}package` });
  check("P2 traversal id rejected", failed(traversalId), traversalId.text);

  const unknown = await tool("get_component_schema", { type: "totallyUnknownType" });
  check("P2 unknown component returns zero examples", !unknown.isError && json(unknown.text)?.foundInDashboards === 0, unknown.text);

  const qd = await tool("query_data", { data_json: "{nope}" });
  check("P2 query_data invalid json fails as MCP error", qd.isError === true, qd.text);

  const st = await tool("get_tables_info", { connection_json: "{nope}" });
  check("P2 tables invalid json fails as MCP error", st.isError === true, st.text);

  cleanup();
  const pass = results.filter((r) => r.pass).length;
  console.log(`\nQA RESULT: PASS=${pass} FAIL=${results.length - pass}`);
  process.exit(results.some((r) => !r.pass) ? 1 : 0);
}

main().catch((e) => {
  console.error("QA crashed:", e);
  cleanup();
  process.exit(2);
});
