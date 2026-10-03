const fs = require("fs");
const base = "C:/Users/roman.fetisov/Desktop/Box/industry/Web/Dashboards/mcp-server/scripts";
const ref = JSON.parse(fs.readFileSync(base + "/get-4.1_WC_Piece_T_Control.json", "utf8"));
const ds = ref.dataSources[0];
const refTable = ref.components.find((c) => c.type === "table" && (JSON.parse(c.options).name === "Детальная"));

// resolved plain columns from the ref query (real DB columns of THIS emulator backend)
const wanted = [
  { columnId: -2 },  // rep_technologyoperationanalitic.calcdate (DateTime)
  { columnId: -19 }, // dept.maindeptname (String)
  { columnId: -27 }, // workflowchart.id (Integer)
  { columnId: -57 }, // technologyoperationinworkflowchart.partplancount (Integer)
  { columnId: -51, typeEnum: 1, aggregateType: 1 }, // decimalfactcount (Decimal, measure SUM)
];
const dataFields = [];
let id = 1;
for (const w of wanted) {
  const src = (refTable.dataFields || []).find((df) => df.columnId === w.columnId);
  if (!src) {
    console.error("ref dataField not found for column", w.columnId);
    process.exit(1);
  }
  dataFields.push({ ...src, id: id++, typeEnum: w.typeEnum || 0, aggregateType: w.typeEnum ? 1 : null });
}

const comp = {
  Id: 1,
  Type: "table",
  DataSourceId: 0,
  QueryId: 0,
  DataFields: dataFields,
  Filter: null,
  Options: JSON.stringify({ name: "qa-table", isHeaderVisible: true, conditionalFormattingRules: [] }),
  Interactivity: refTable.Interactivity,
};

const tile = {
  type: 0,
  static: false,
  isResizable: true,
  isDraggable: true,
  minW: 5,
  minH: 5,
  maxW: 60,
  maxH: 48,
  i: "1",
  x: 0,
  y: 0,
  w: 40,
  h: 20,
  resizeHandles: ["s", "w", "e"],
};

const dash = {
  Title: { Text: "QA Emulator Data" },
  DataSources: [ds],
  Components: [comp],
  Layout: JSON.stringify({ lg: [tile] }),
  Parameters: [],
  Options: "{}",
  IsDefault: false,
};
dash.Title.Text = "QA Emulator Data";

const out = "C:/Users/roman.fetisov/Desktop/Emulator/Dispather/Dashboards/App_Data/Dashboards/QA Emulator Data.json";
fs.writeFileSync(out, JSON.stringify(dash, null, 2));
console.log("written", out);
