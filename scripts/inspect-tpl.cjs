const fs = require("fs");
const dir = "C:/Users/roman.fetisov/Desktop/Emulator/Dispather/Dashboards/App_Data/Dashboards";
const f = fs.readdirSync(dir).find((x) => /json$/i.test(x) && !/QA/i.test(x));
console.log("using:", f);
const d = JSON.parse(fs.readFileSync(dir + "/" + f, "utf8").replace(/^\uFEFF/, ""));
console.log("TOP:", Object.keys(d).join(","));
console.log("Title:", JSON.stringify(d.Title));
console.log(
  "Components:",
  JSON.stringify(d.Components.map((c) => ({ Id: c.Id, Type: c.Type, DS: c.DataSourceId, Q: c.QueryId })))
);
const lay = JSON.parse(d.Layout);
const lg = lay.lg ? lay.lg : [lay];
console.log("tiles:", JSON.stringify(Array.isArray(lg) ? lg.map((t) => t.i) : lg));
const c0 = d.Components[0];
console.log("comp0 keys:", Object.keys(c0).join(","));
console.log("DF0:", JSON.stringify(c0.DataFields[0]));
console.log(
  "DS:",
  JSON.stringify(d.DataSources.map((s) => ({ Id: s.Id, Name: s.Name, Conn: s.Connection ? s.Connection.Name : null })))
);
console.log("comp0 options:", String(c0.Options).slice(0, 150));
console.log("Params:", JSON.stringify(d.Parameters).slice(0, 150));
