import fs from "node:fs/promises";
import path from "node:path";
import { DashboardSchema, normalizeKeys } from "./schemas.js";
import { resolveAppData } from "./storage.js";

/**
 * Round-trip verification: for every default dashboard fixture
 * parse → validate (Zod) → serialize → re-parse → deep-compare.
 * Exits 0 only when all fixtures pass.
 */
let failures = 0;

const appData = await resolveAppData();
const defaultsDir = path.join(appData, "DefaultDashboards");
const files = (await fs.readdir(defaultsDir)).filter((f) => f.endsWith(".json"));

for (const file of files) {
  const filePath = path.join(defaultsDir, file);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const original = JSON.parse(raw.startsWith("\uFEFF") ? raw.slice(1) : raw);
    const parsed = DashboardSchema.parse(normalizeKeys(original, 0));
    const serialized = JSON.stringify(parsed, null, 2);
    const reparsed = JSON.parse(serialized);
    const ok = JSON.stringify(parsed) === JSON.stringify(reparsed);
    if (!ok) {
      failures++;
      console.error(`FAIL ${file}: round-trip mismatch`);
      continue;
    }
    console.log(`OK   ${file} (${parsed["DataSources"]?.length} ds, ${parsed["Components"]?.length} components)`);
  } catch (e) {
    failures++;
    console.error(`FAIL ${file}: ${(e as Error).message}`);
  }
}

if (failures > 0) {
  console.error(`${failures}/${files.length} fixtures failed`);
  process.exit(1);
}
console.log(`All ${files.length} default dashboards pass round-trip validation.`);
