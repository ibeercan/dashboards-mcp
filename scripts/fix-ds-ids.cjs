const fs = require("fs");
const dir = "C:/Users/roman.fetisov/Desktop/Emulator/Dispather/Dashboards/App_Data/Dashboards";
for (const f of ["QA Emulator Test.json", "QA MCP Демо 9.1.json"]) {
  const p = dir + "/" + f;
  const d = JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
  const newId = 21311054;
  for (const s of d.DataSources) {
    console.log(f, "DS.Id before:", s.Id, "Name:", s.Name);
    s.Id = newId;
    s.Name = "DataSource-" + newId;
  }
  for (const c of d.Components) {
    if (c.DataSourceId === 0) c.DataSourceId = newId;
  }
  fs.writeFileSync(p, JSON.stringify(d, null, 2));
  console.log(f, "patched DS Id ->", newId, "Name -> DataSource-" + newId);
}
