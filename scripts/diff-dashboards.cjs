const fs = require("fs");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const base = "C:/Users/roman.fetisov/Desktop/Box/industry/Web/Dashboards/mcp-server/scripts";
const ref = read(base + "/get-4.1_WC_Piece_T_Control.json");
const ours = read(base + "/get-QA_Emulator_Test.json");

const diffs = [];
const add = (p, a, b) => diffs.push(`${p}: REF=${JSON.stringify(a)} OURS=${JSON.stringify(b)}`);

console.log("REF top keys:", Object.keys(ref).join(","));
console.log("OURS top keys:", Object.keys(ours).join(","));

// top-level scalar compare
for (const k of Object.keys(ref)) {
  const rv = ref[k], ov = ours[k];
  if (k === "components" || k === "dataSources" || k === "parameters" || k === "layout" || k === "options") continue;
  if (JSON.stringify(rv) !== JSON.stringify(ov)) add("top." + k, rv, ov);
}
// layout
const rl = JSON.parse(ref.layout), ol = JSON.parse(ours.layout);
console.log("REF layout tile0:", JSON.stringify(rl.lg ? rl.lg[0] : rl).slice(0, 200));
console.log("OURS layout tile0:", JSON.stringify(ol.lg ? ol.lg[0] : ol).slice(0, 200));
// tables: find the table component in ref
const refTable = ref.components.find((c) => c.type === "table");
const ourTable = ours.components.find((c) => c.type === "table");
console.log("REF table comp keys:", Object.keys(refTable).join(","));
console.log("OUR table comp keys:", Object.keys(ourTable).join(","));
for (const k of Object.keys(refTable)) {
  const rv = refTable[k], ov = ourTable[k];
  if (k === "dataFields" || k === "options" || k === "filter") continue;
  if (JSON.stringify(rv) !== JSON.stringify(ov)) add("table." + k, rv, ov);
}
console.log("REF table df0:", JSON.stringify(refTable.dataFields && refTable.dataFields[0]));
console.log("OUR table df0:", JSON.stringify(ourTable.dataFields && ourTable.dataFields[0]));
console.log("REF table options:", refTable.options && refTable.options.slice(0, 400));
console.log("OUR table options:", ourTable.options && ourTable.options.slice(0, 400));
console.log("REF table filter:", JSON.stringify(refTable.filter));
console.log("OUR table filter:", JSON.stringify(ourTable.filter));
// ref DS
console.log("REF ds0 keys:", Object.keys(ref.dataSources[0]).join(","));
console.log("REF ds0:", JSON.stringify(ref.dataSources[0]).slice(0, 700));
console.log("OUR ds0:", JSON.stringify(ours.dataSources[0]).slice(0, 700));
console.log("REF params count:", (ref.parameters || []).length, "ours:", (ours.parameters || []).length);
console.log("REF topOptions:", ref.options === undefined ? "UNDEF" : String(ref.options).slice(0, 120));
console.log("OUR topOptions:", ours.options === undefined ? "UNDEF" : String(ours.options).slice(0, 120));
console.log("DIFFS:");
for (const d of diffs) console.log(" ", d);
