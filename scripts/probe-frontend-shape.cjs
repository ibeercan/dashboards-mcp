// Probe /api/Data with the EXACT request shape the frontend builds (src/features/dataRequest/utils.ts):
// dataSource = { sourceType, dataBase: { connection, queries } } (camelCase runtime model from GET)
// dataFields = { id, dataSourceFieldId, typeEnum, aggregateType, dateTimeInterval, sortOrder }
// filter = { itemType: 0 (Group), logicType: 0 (And), children: [] }  — NEVER null
// datasets = [ { name: "main", values: [{ dataFieldId }], ignoreDataRowsCountLimit: false } ]
const BASE = "http://localhost:8014";
const DASH_ID = "QA Emulator Data";

async function main() {
  const gres = await fetch(`${BASE}/api/Dashboards/${encodeURIComponent(DASH_ID)}`);
  const gj = await gres.json();
  const dash = gj.data ?? gj.Data;
  if (!dash) throw new Error("dashboard GET failed: " + JSON.stringify(gj).slice(0, 200));
  const ds = dash.dataSources[0];

  const req = {
    dataSource: {
      sourceType: ds.sourceType,
      dataBase: {
        connection: ds.dataBase.connection,
        queries: ds.dataBase.queries,
      },
    },
    dataFields: [
      { id: 1, dataSourceFieldId: -19, typeEnum: 0, aggregateType: null, dateTimeInterval: null, sortOrder: 0 },
      { id: 2, dataSourceFieldId: -51, typeEnum: 1, aggregateType: 1, dateTimeInterval: null, sortOrder: 1 },
    ],
    filter: { itemType: 0, logicType: 0, children: [] },
    sorting: [],
    datasets: [
      { name: "main", values: [{ dataFieldId: 1 }, { dataFieldId: 2 }], ignoreDataRowsCountLimit: false },
    ],
    parameters: [
      // dashboard parameters (query parameter WorkflowChartId references ?ID via isExpression formula)
      { id: 1537456954, name: "ID", value: "3041", valueType: 1 },
    ],
  };

  const res = await fetch(`${BASE}/api/Data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const j = await res.json();
  const err = j.error ?? j.Error;
  const hasErr = err && (err.code != null || err.Code != null || (err.message && String(err.message).length > 0));
  if (hasErr) {
    console.log("DATA ERR:", JSON.stringify(err));
    process.exit(1);
  }
  const data = j.data ?? j.Data;
  if (!data || !data.datasets) {
    console.log("NO DATA:", JSON.stringify(j).slice(0, 300));
    process.exit(1);
  }
  const names = Object.keys(data.datasets);
  console.log("DATA OK datasets:", names.join(","));
  const main = data.datasets.main;
  if (main) {
    const sample = (main.values || []).slice(0, 8).join(" | ");
    console.log("sample:", sample.slice(0, 240));
    console.log("row count values:", (main.values || []).length);
  }
}

main().catch((e) => {
  console.error("PROBE FAIL:", e.message);
  process.exit(1);
});
