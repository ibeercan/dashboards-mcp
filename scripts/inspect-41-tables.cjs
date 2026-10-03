const fs = require("fs");
const base = "C:/Users/roman.fetisov/Desktop/Box/industry/Web/Dashboards/mcp-server/scripts";
const d = JSON.parse(fs.readFileSync(base + "/get-4.1_WC_Piece_T_Control.json", "utf8"));
const ds = d.dataSources[0];
const q = ds.dataBase.queries[0];
const colById = new Map(q.columns.map((c) => [c.id, c]));
const tables = new Map(q.tables.map((t) => [t.id, t]));

for (const c of d.components.filter((x) => x.type === "table")) {
  console.log("=== table comp", c.id, "| options.name:", c.options && (JSON.parse(c.options).name));
  for (const df of c.dataFields || []) {
    const col = colById.get(df.columnId);
    const t = col ? tables.get(col.tableId) : null;
    console.log(
      `  df id=${df.id} typeEnum=${df.typeEnum} aggregate=${df.aggregateType} col=${df.columnId}` +
        (col ? ` -> ${t ? t.name : t} . ${col.name} (${col.valueType && col.valueType.name})` : " -> NOT IN QUERY COLUMNS")
    );
    if (df.children) {
      for (const ch of df.children) {
        const cc = colById.get(ch.columnId);
        console.log(`      child id=${ch.id} col=${ch.columnId}${cc ? ` -> ${cc.name}` : " -> not-found"}`);
      }
    }
  }
}
console.log("---");
console.log("query tables:", q.tables.map((t) => `${t.id}:${t.name}`).join(", "));
console.log("query columns with real tableId:", q.columns.filter((c) => c.tableId >= 0).length);
