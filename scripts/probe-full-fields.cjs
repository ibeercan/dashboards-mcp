// Replicate the REAL frontend request for 4.1's "Детальная" table component (all its dataFields).
// If this fails with 105 too -> the problem is the environment (DB schema/relations), not the request shape.
const BASE = "http://localhost:8014";
const DASH_ID = "QA Emulator Test"; // the clone of 4.1 (renders)

async function main() {
  const gres = await fetch(`${BASE}/api/Dashboards/${encodeURIComponent(DASH_ID)}`);
  const gj = await gres.json();
  const dash = gj.data ?? gj.Data;
  if (!dash) throw new Error("dashboard GET failed");
  const ds = dash.dataSources[0];

  // find the "Детальная" table component
  const comp = dash.components.find(
    (c) => c.type === "table" && JSON.parse(c.options).name === "Детальная"
  );
  if (!comp) throw new Error("component not found; types=" + dash.components.map((c) => c.type));

  // flatten dataFields like the frontend does (Delta/Hyperlink -> children)
  const flat = [];
  for (const f of comp.dataFields) {
    if ((f.typeEnum === 2 || f.typeEnum === 3) && Array.isArray(f.children)) {
      for (const ch of f.children) flat.push(ch);
    } else {
      flat.push(f);
    }
  }

  const dataFields = flat.map((f, i) => ({
    id: f.id,
    dataSourceFieldId: f.columnId,
    typeEnum: f.typeEnum === 2 || f.typeEnum === 3 ? 0 : f.typeEnum, // Delta/Hyperlink -> Dimension/Measure on wire
    aggregateType: f.aggregateType ?? null,
    dateTimeInterval: f.dateTimeInterval ?? null,
    sortOrder: f.order ?? i,
  }));
  const uniq = new Set(dataFields.map((d) => d.id));
  if (uniq.size !== dataFields.length) throw new Error("duplicate dataField ids!");

  const req = {
    dataSource: { sourceType: ds.sourceType, dataBase: { connection: ds.dataBase.connection, queries: ds.dataBase.queries } },
    dataFields,
    filter: { itemType: 0, logicType: 0, children: [] },
    sorting: [],
    datasets: [
      { name: "main", values: dataFields.map((d) => ({ dataFieldId: d.id })), ignoreDataRowsCountLimit: false },
    ],
    parameters: [],
  };

  const res = await fetch(`${BASE}/api/Data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const j = await res.json();
  if (j.error || j.Error) {
    console.log("FULL-FIELDS ERR:", JSON.stringify(j.error ?? j.Error), "| fields:", dataFields.length);
    process.exit(1);
  }
  const data = j.data ?? j.Data;
  const main = data.datasets.main;
  console.log("FULL-FIELDS DATA OK | values per row:", main ? main.values.length : "?");
  console.log("sample:", (main ? main.values : []).slice(0, 10).join(" | ").slice(0, 300));
}
main().catch((e) => {
  console.error("PROBE FAIL:", e.message);
  process.exit(1);
});
