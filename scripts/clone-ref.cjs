const fs = require("fs");
const appData = "C:/Users/roman.fetisov/Desktop/Emulator/Dispather/Dashboards/App_Data";
const src = JSON.parse(fs.readFileSync(appData + "/DefaultDashboards/4.1 WC Piece T Control.json", "utf8").replace(/^\uFEFF/, ""));
src.Title.Text = "QA Emulator Test";
// keep everything else verbatim — this content is known-rendering on this backend/DB
fs.writeFileSync(appData + "/Dashboards/QA Emulator Test.json", JSON.stringify(src, null, 2));
console.log("cloned 4.1 -> QA Emulator Test.json, Title.Text =", src.Title.Text);
