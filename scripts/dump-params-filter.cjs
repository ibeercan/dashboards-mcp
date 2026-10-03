const fs = require("fs");
const base = "C:/Users/roman.fetisov/Desktop/Box/industry/Web/Dashboards/mcp-server/scripts";
const d = JSON.parse(fs.readFileSync(base + "/get-4.1_WC_Piece_T_Control.json", "utf8"));
const q = d.dataSources[0].dataBase.queries[0];
console.log("query.parameters:", JSON.stringify(q.parameters, null, 1));
console.log("query.filter:", JSON.stringify(q.filter, null, 1).slice(0, 1500));
console.log("dashboard.parameters:", JSON.stringify(d.parameters, null, 1).slice(0, 600));
// find the table comp filter:
const t = d.components.find((c) => c.type === "table");
console.log("comp.filter:", JSON.stringify(t.filter, null, 1).slice(0, 900));
