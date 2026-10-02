import { z } from "zod";

/** The 17 canonical componentType values from the backend/frontend registry. */
export const COMPONENT_TYPES = [
  "table",
  "pivotTable",
  "chart",
  "dropDownList",
  "datePeriod",
  "group",
  "tabContainer",
  "pieChart",
  "card",
  "webPage",
  "image",
  "filterTree",
  "indicator",
  "rangeFilter",
  "textEditor",
  "guage",
  "linearChart",
] as const;

const PassthroughObject: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z.record(z.unknown())
);

export const DashboardTitleSchema = z
  .object({ Text: z.string().min(1).optional() })
  .passthrough();

export const ComponentSchema = z
  .object({
    Id: z.union([z.number(), z.string()]),
    Type: z.string().min(1),
    DataSourceId: z.union([z.number(), z.string()]).nullable().optional(),
    QueryId: z.union([z.number(), z.string()]).nullable().optional(),
    DataFields: z.array(z.unknown()).optional(),
    Filter: z.unknown().optional(),
    Options: z.string().nullable().optional(),
    Interactivity: z.string().nullable().optional(),
  })
  .passthrough();

export const DataSourceSchema = z
  .object({
    Id: z.union([z.number(), z.string()]),
    Name: z.string().optional(),
    /** Older fixtures omit SourceType; the backend C# default is 0 (DataBase). */
    SourceType: z.number().optional().default(0),
    DataBase: PassthroughObject.nullable().optional(),
    WebApi: PassthroughObject.nullable().optional(),
    Federation: PassthroughObject.nullable().optional(),
  })
  .passthrough();

export const DashboardParameterSchema = PassthroughObject;

export const DashboardSchema = z
  .object({
    Id: z.string().optional(),
    IsDefault: z.boolean().optional(),
    Title: DashboardTitleSchema,
    DataSources: z.array(DataSourceSchema),
    Components: z.array(ComponentSchema).nullable().optional(),
    Layout: z.string().nullable().optional(),
    Parameters: z.array(DashboardParameterSchema).optional().default([]),
    Options: z.string().nullable().optional(),
  })
  .passthrough();

export type DashboardZod = z.infer<typeof DashboardSchema>;

/**
 * Canonical key names validated case-insensitively (the backend deserializes
 * with PropertyNameCaseInsensitive=true and real fixtures mix PascalCase and camelCase).
 */
const CANONICAL_KEY_MAP: Record<string, string> = {
  id: "Id",
  isdefault: "IsDefault",
  title: "Title",
  datasources: "DataSources",
  components: "Components",
  layout: "Layout",
  parameters: "Parameters",
  options: "Options",
  interactivity: "Interactivity",
  name: "Name",
  sourcetype: "SourceType",
  database: "DataBase",
  webapi: "WebApi",
  federation: "Federation",
  type: "Type",
  datasourceid: "DataSourceId",
  queryid: "QueryId",
  datafields: "DataFields",
  filter: "Filter",
};

/** Recursively canonicalizes JSON keys for known DTO members while preserving nested payload keys as-is. */
export function normalizeKeys(value: unknown, depth: number = 0): unknown {
  if (Array.isArray(value)) return value.map((item) => normalizeKeys(item, depth));
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    const seen = new Set<string>();
    for (const [key, raw] of Object.entries(value)) {
      const target = depth < 2 && key.toLowerCase() in CANONICAL_KEY_MAP ? CANONICAL_KEY_MAP[key.toLowerCase()] : key;
      if (seen.has(target)) continue;
      seen.add(target);
      result[target] = depth < 2 ? normalizeKeys(raw, depth + 1) : raw;
    }
    return result;
  }
  return value;
}

/** Parses a JSON-in-JSON string (Options / Interactivity / Layout). */
export function parseInnerJson(field: "Layout" | "Options" | "Interactivity", value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed !== null && typeof parsed === "object") return parsed as Record<string, unknown>;
    return null;
  } catch (e) {
    throw new Error(
      `${field} must be a valid JSON-in-JSON string: ${(e as Error).message}`
    );
  }
}
