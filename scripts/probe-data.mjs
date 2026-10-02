// Diagnose /api/Data error 105 by comparing request variants from real dashboard files.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appData = path.resolve(here, "..", "..", "Dashboards", "App_Data");
const apiUrl = process.env["DASHBOARDS_API_URL"] ?? "http://localhost:8014";

const load = (rel) =>
  JSON.parse(fs.readFileSync(path.join(appData, rel), "utf8").replace(/^\uFEFF/, ""));

const ncFile = load(path.join("DefaultDashboards", "3.2 NC Execution Analysis.json"));
const mineFile = load(path.join("Dashboards", "QA MCP Демо 9.1.json"));

const ncDs = ncFile.DataSources[0];
const mineDs = mineFile.DataSources[0];

// Working variant reconstructed from the live-probed shape: DataSource + DataBase wrapper.
const ncRequest = {
  dataSource: {
    Id: ncDs.Id,
    Name: ncDs.Name,
    SourceType: 0,
    DataBase: { Connection: ncDs.Connection, Queries: ncDs.Queries },
  },
  dataFields: [{ DataSourceFieldId: 2108387233, TypeEnum: 0, SortOrder: 0 }],
  filter: null,
  sorting: [],
  datasets: [],
  parameters: [],
};

// Mine as stored (DataBase wrapper).
const mineRequest = {
  dataSource: {
    Id: mineDs.Id,
    Name: mineDs.Name,
    SourceType: mineDs.SourceType ?? 0,
    DataBase: { Connection: mineDs.DataBase.Connection, Queries: mineDs.DataBase.Queries },
  },
  dataFields: [
    { DataSourceFieldId: 1784451349, TypeEnum: 0, SortOrder: 0 },
    { DataSourceFieldId: 482680917, TypeEnum: 0, SortOrder: 1 },
  ],
  filter: null,
  sorting: [],
  datasets: [],
  parameters: [],
};

const run = async (label, body) => {
  try {
    const r = await fetch(`${apiUrl}/api/Data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const text = await r.text();
    console.log(`[${label}] HTTP ${r.status} :: ${text.slice(0, 200)}`);
  } catch (e) {
    console.log(`[${label}] FAILED ${e.message}`);
  }
};

await run("NC baseline (known-good shape)", ncRequest);
await run("Mine (ds fields + DataBase)", mineRequest);

// Variant: mine but bare Connection/Queries at DataSource level (legacy PascalCase layout).
await run("Mine legacy layout (Connection/Queries direct)", {
  ...mineRequest,
  dataSource: {
    Id: mineDs.Id,
    Name: mineDs.Name,
    SourceType: mineDs.SourceType ?? 0,
    Connection: mineDs.DataBase.Connection,
    Queries: mineDs.DataBase.Queries,
  },
});
