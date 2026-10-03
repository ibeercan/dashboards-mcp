const fs = require("fs");
const base = "C:/Users/roman.fetisov/Desktop/Box/industry/Web/Dashboards/mcp-server/scripts";
const ref = JSON.parse(fs.readFileSync(base + "/get-4.1_WC_Piece_T_Control.json", "utf8"));
const out = "C:/Users/roman.fetisov/Desktop/Emulator/Dispather/Dashboards/App_Data/Dashboards/QA Emulator Data.json";
const dash = JSON.parse(fs.readFileSync(out, "utf8").replace(/^\uFEFF/, ""));
// query parameter WorkflowChartId references ?ID (dashboard param) via isExpression formula:
// without the dashboard parameter the frontend request cannot resolve it -> 105 in browser too
dash.Parameters = ref.parameters.map((p) => ({
  Id: p.id,
  Name: p.name,
  Description: p.description || "",
  Visible: p.visible,
  Nullable: p.nullable,
  ValueType: p.valueType,
  DefaultValue: p.defaultValue,
}));
fs.writeFileSync(out, JSON.stringify(dash, null, 2));
console.log("Parameters set:", JSON.stringify(dash.Parameters));
