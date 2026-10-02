import fs from "node:fs/promises";
import path from "node:path";
import { DashboardSchema, normalizeKeys } from "./schemas.js";
import { resolveAppData } from "./storage.js";

/**
 * Round-trip verification: for every default dashboard fixture
 * parse → validate (Zod) → serialize → re-parse → compare against the
 * normalized ORIGINAL so schema normalization can never silently drop data.
 * Exits 0 only when all fixtures pass.
 */
import type { DashboardDto } from "./types.js";

function structuralDiff(expected: unknown, actual: unknown, at: string): string[] {
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const diffs: string[] = [];
    if (expected.length !== actual.length) return [`${at}: length ${expected.length} != ${actual.length}`];
    for (let i = 0; i < expected.length; i++) diffs.push(...structuralDiff(expected[i], actual[i], `${at}[${i}]`));
    return diffs;
  }
  if (expected !== null && actual !== null && typeof expected === "object" && typeof actual === "object") {
    const diffs: string[] = [];
    const expKeys = Object.keys(expected as Record<string, unknown>);
    for (const key of Object.keys(actual as Record<string, unknown>)) {
      if (!expKeys.includes(key)) diffs.push(`${at}.${key}: not present in normalized original`);
    }
    for (const key of expKeys) {
      diffs.push(
        ...structuralDiff((expected as Record<string, unknown>)[key], (actual as Record<string, unknown>)[key], `${at}.${key}`)
      );
    }
    return diffs;
  }
  return expected === actual ? [] : [`${at}: ${JSON.stringify(expected)} != ${JSON.stringify(actual)}`];
}

let failures = 0;

const appData = await resolveAppData();
const defaultsDir = path.join(appData, "DefaultDashboards");
const files = (await fs.readdir(defaultsDir)).filter((f) => f.endsWith(".json"));

for (const file of files) {
  const filePath = path.join(defaultsDir, file);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const original = JSON.parse(raw.startsWith("\uFEFF") ? raw.slice(1) : raw);
    // Canonical original: normalized keys with schema-injected defaults applied —
    // so the round-trip comparison is symmetric.
    const canonicalOriginal: DashboardDto = normalizeKeys(original, 0) as DashboardDto;
    if (!Array.isArray(canonicalOriginal.Parameters)) canonicalOriginal.Parameters = [];
    if (canonicalOriginal.DataSources) {
      for (const ds of canonicalOriginal.DataSources as Array<Record<string, unknown>>) {
        if (ds["SourceType"] === undefined) ds["SourceType"] = 0;
      }
    }
    const parsed = DashboardSchema.parse(normalizeKeys(original, 0));
    const serialized = JSON.stringify(parsed, null, 2);
    const reparsed = JSON.parse(serialized);
    const diffs = structuralDiff(canonicalOriginal, reparsed, "$");
    if (diffs.length > 0) {
      failures++;
      console.error(`FAIL ${file}: round-trip mismatch\n  ${diffs.join("\n  ")}`);
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
