// Minimal single-table /api/Data probe against the EMULATOR's own DB schema:
// 1) POST /api/TablesInfo/tablesInfo {dataSourceConnection:{name:'Industry'}, tables:[machine]} -> real columns
// 2) build a synthetic single-table query (negative column ids like the working dashboards use)
// 3) POST /api/Data with the exact frontend request shape
const BASE = "http://localhost:8014";

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${path} -> HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
}

const valueTypeName = (n) => ({ 0: "String", 1: "Integer", 2: "Decimal", 3: "Boolean", 4: "DateTime", 5: "Double", 255: "Auto" }[n] ?? "Custom");

async function main() {
  // 1) real machine columns
  const tj = await post("/api/TablesInfo/tablesInfo", {
    dataSourceConnection: { name: "Industry" },
    tables: [{ schema: "dbo", name: "machine", type: 0 }],
  });
  if (tj.error || tj.Error) throw new Error("TablesInfo err: " + JSON.stringify(tj.error ?? tj.Error));
  const tdata = tj.data ?? tj.Data;
  const tableInfo = (Array.isArray(tdata) ? tdata : tdata.tables || [])[0];
  if (!tableInfo || !tableInfo.columns || tableInfo.columns.length === 0) {
    throw new Error("machine columns empty: " + JSON.stringify(tdata).slice(0, 300));
  }
  console.log("machine columns:", tableInfo.columns.map((c) => `${c.name}:${c.dataTypeName}(dt=${c.dataType},null=${c.allowNull})`).join(", "));

  // 2) synthetic single-table query
  let cid = 0;
  const columns = tableInfo.columns.map((c) => ({
    id: --cid,
    name: c.name,
    tableId: 1,
    tableName: null,
    formulaText: null,
    formulaValueTypeValidated: null,
    formulaAggregated: false,
    displayedName: c.name,
    valueType: { name: valueTypeName(c.dataType), valueType: c.dataType, isNullable: c.allowNull, charsMaxLength: 1000 },
    aggregate: null,
  }));
  const query = {
    id: 0,
    name: "Query",
    tables: [{ id: 1, name: "machine", schema: "dbo", displayedName: "Оборудование", type: 0 }],
    columns,
    relations: [],
    grouping: [],
    filter: null,
    groupFilter: null,
    rowsLimit: 100,
    sorting: [],
    parameters: [],
  };

  // pick: first String column as dimension, first Integer/Decimal/Double as measure
  const dim = columns.find((c) => c.valueType.valueType === 0) || columns[0];
  const measure = columns.find((c) => [1, 2, 5].includes(c.valueType.valueType));
  const dataFields = [
    { id: 1, dataSourceFieldId: dim.id, typeEnum: 0, aggregateType: null, dateTimeInterval: null, sortOrder: 0 },
  ];
  if (measure) dataFields.push({ id: 2, dataSourceFieldId: measure.id, typeEnum: 1, aggregateType: 1, dateTimeInterval: null, sortOrder: 1 });
  console.log("dim:", dim.name, "| measure:", measure ? measure.name : "(none)");

  // 3) exact frontend request shape
  const req = {
    dataSource: {
      sourceType: 0,
      dataBase: { connection: { name: "Industry" }, queries: [query] },
    },
    dataFields,
    filter: { itemType: 0, logicType: 0, children: [] },
    sorting: [],
    datasets: [
      { name: "main", values: dataFields.map((d) => ({ dataFieldId: d.id })), ignoreDataRowsCountLimit: false },
    ],
    parameters: [],
  };
  const dj = await post("/api/Data", req);
  if (dj.error || dj.Error) {
    console.log("MINIMAL ERR:", JSON.stringify(dj.error ?? dj.Error));
    process.exit(1);
  }
  const data = dj.data ?? dj.Data;
  const main = data.datasets.main;
  console.log("MINIMAL DATA OK | cols per row:", main ? main.values.length : "?");
  console.log("sample:", (main ? main.values : []).slice(0, 10).join(" | ").slice(0, 300));
}
main().catch((e) => {
  console.error("PROBE FAIL:", e.message);
  process.exit(1);
});
