import { spawn } from "node:child_process";
import path from "node:path";
import { z, type ZodTypeAny } from "zod";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { COMPONENT_TYPES, DashboardSchema, normalizeKeys, parseInnerJson } from "./schemas.js";
import {
  createDashboard,
  deleteDashboard,
  getDashboard,
  listDashboards,
  previewCreate,
  previewUpdate,
  updateDashboard,
} from "./storage.js";
import {
  apiCreateDashboard,
  apiDeleteDashboard,
  apiGetColumnsInfo,
  apiGetDashboard,
  apiGetTableNames,
  apiQueryData,
  apiUpdateDashboard,
} from "./api-client.js";
import type { DashboardDto } from "./types.js";

const IdInput: Record<string, ZodTypeAny> = { id: z.string().min(1) };
const RawJsonInput: Record<string, ZodTypeAny> = { dashboard_json: z.string().min(2) };

const READ: ToolAnnotations = { readOnlyHint: true, idempotentHint: true };
const QUERY: ToolAnnotations = { readOnlyHint: true, idempotentHint: false, openWorldHint: true };
const WRITE = (destructive = false): ToolAnnotations => ({
  readOnlyHint: false,
  destructiveHint: destructive,
  idempotentHint: false,
});

interface McpToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, ZodTypeAny>;
  annotations?: ToolAnnotations;
  /** Zod schema for protocol-level structuredContent (read-type tools with a stable shape). */
  outputSchema?: ZodTypeAny;
  run: (args: Record<string, unknown>) => Promise<ToolResult>;
}

interface ToolResult {
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
  [key: string]: unknown;
}

function parseRaw(raw: string): DashboardDto {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`dashboard_json is not valid JSON: ${(e as Error).message}`);
  }
  const result = DashboardSchema.safeParse(normalizeKeys(parsed, 0));
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Dashboard schema validation failed:\n${issues.join("\n")}`);
  }
  return result.data;
}

function validateInnerJson(dto: DashboardDto): { innerJsonFields: string[] } {
  const innerFields: string[] = [];

  const layout = parseInnerJson("Layout", dto.Layout);
  if (layout) {
    innerFields.push("Layout");
    if (typeof layout["layouts"] === "string") {
      throw new Error("Layout.inner.layouts must be an object, not a JSON string");
    }
  }
  if (parseInnerJson("Options", dto.Options)) innerFields.push("Options");

  dto.Components?.forEach((component, index) => {
    if (parseInnerJson("Interactivity", component.Interactivity)) {
      innerFields.push(`Components[${index}].Interactivity`);
    }
  });
  return { innerJsonFields: innerFields };
}

function jsonResult(value: unknown, structured?: ToolResult["structuredContent"]): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    ...(structured !== undefined ? { structuredContent: structured } : {}),
  };
}

function errorResult(error: Error): ToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }],
  };
}

function frontendAppDir(): string {
  return path.resolve("..", "Dashboards", "FrontendApp");
}

function runJest(testPath: string | undefined): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolve, reject) => {
    // Run the test runner directly (no shell) to keep the path argument inert;
    // Windows resolves `yarn` through yarn.cmd.
    const command = process.platform === "win32" ? "yarn.cmd" : "yarn";
    const child = spawn(command, ["test", ...(testPath ? [testPath] : [])], {
      cwd: frontendAppDir(),
      shell: false,
      env: { ...process.env },
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += String(chunk); });
    child.stderr.on("data", (chunk) => { output += String(chunk); });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => resolve({ exitCode: code ?? 1, output }));
  });
}

function parseJsonArg(name: string, raw: unknown): unknown {
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${name} is not valid JSON: ${(e as Error).message}`);
  }
}

export interface ToolAllocator {
  readonly tools: McpToolDef[];
}

export function buildTools(): ToolAllocator {
  const defs: McpToolDef[] = [
    {
      name: "list_dashboards",
      title: "List dashboards",
      description: "List dashboards: default (`_default` suffix) and custom, from App_Data storage.",
      inputSchema: {},
      annotations: READ,
      outputSchema: z.object({
        dashboards: z.union([z.array(z.record(z.unknown())), z.record(z.unknown())]),
      }).passthrough(),
      run: async () => {
        const dashboards = await listDashboards();
        const structured = z.array(z.record(z.unknown())).safeParse(dashboards).success
          ? { dashboards }
          : { dashboards: dashboards as unknown as Record<string, unknown> };
        return jsonResult(dashboards, structured);
      },
    },
    {
      name: "get_dashboard",
      title: "Get dashboard",
      description: "Get full dashboard JSON by id. Default dashboards end with `_default`.",
      inputSchema: IdInput,
      annotations: READ,
      run: async (args) => {
        const id = String(args["id"]);
        try {
          return jsonResult(await getDashboard(id));
        } catch (fsError) {
          try {
            return jsonResult(await apiGetDashboard(id));
          } catch (apiError) {
            throw new Error(`File storage: ${(fsError as Error).message}; API: ${(apiError as Error).message}`);
          }
        }
      },
    },
    {
      name: "create_dashboard",
      title: "Create dashboard",
      description: "Create a new custom dashboard. ID is generated from Title.Text following backend rules.",
      inputSchema: RawJsonInput,
      annotations: WRITE(),
      outputSchema: z.object({ id: z.string(), path: z.string() }).passthrough(),
      run: async (args) => {
        const dto = parseRaw(String(args["dashboard_json"]));
        validateInnerJson(dto);
        const created = await createDashboard(dto);
        return jsonResult(created, created as Record<string, unknown>);
      },
    },
    {
      name: "update_dashboard",
      title: "Update dashboard",
      description: "Update an existing custom dashboard (by Id in the JSON). Default dashboards are read-only.",
      inputSchema: RawJsonInput,
      annotations: WRITE(),
      outputSchema: z.object({ updated: z.string() }).passthrough(),
      run: async (args) => {
        const dto = parseRaw(String(args["dashboard_json"]));
        validateInnerJson(dto);
        const updatedPath = await updateDashboard(dto);
        return jsonResult({ updated: updatedPath }, { updated: updatedPath });
      },
    },
    {
      name: "delete_dashboard",
      title: "Delete dashboard",
      description: "Delete a custom dashboard by id. Default (`_default`) dashboards cannot be deleted.",
      inputSchema: IdInput,
      annotations: WRITE(true),
      outputSchema: z.object({ id: z.string(), deleted: z.boolean() }).passthrough(),
      run: async (args) => {
        const id = String(args["id"]);
        const deleted = await deleteDashboard(id);
        return jsonResult({ id, deleted }, { id, deleted });
      },
    },
    {
      name: "validate_dashboard",
      title: "Validate dashboard JSON",
      description: "Validate dashboard JSON: Zod schema, inner JSON fields, and round-trip.",
      inputSchema: RawJsonInput,
      annotations: READ,
      outputSchema: z.object({
        valid: z.boolean(),
        innerJsonFields: z.array(z.string()),
        roundTripPasses: z.boolean(),
      }).passthrough(),
      run: async (args) => {
        const dto = parseRaw(String(args["dashboard_json"]));
        const { innerJsonFields } = validateInnerJson(dto);
        const roundTrip = JSON.parse(JSON.stringify(dto));
        const ok = DashboardSchema.safeParse(roundTrip).success;
        const result = { valid: ok, innerJsonFields, roundTripPasses: ok };
        return jsonResult(result, result);
      },
    },
    {
      name: "get_component_types",
      title: "List component types",
      description: "List the 17 canonical dashboard component types.",
      inputSchema: {},
      annotations: READ,
      outputSchema: z.object({
        types: z.array(z.object({ type: z.string(), description: z.string() })),
      }).passthrough(),
      run: async () => {
        const result = {
          types: COMPONENT_TYPES.map((type) => ({
            type,
            description: `Dashboard component type: ${type}`,
          })),
        };
        return jsonResult(result, result);
      },
    },
    {
      name: "validate_layout",
      title: "Validate react-grid-layout",
      description: "Validate a react-grid-layout JSON string.",
      inputSchema: { layout_json: z.string().min(2) },
      annotations: READ,
      outputSchema: z.object({ valid: z.boolean(), value: z.unknown() }).passthrough(),
      run: async (args) => {
        const parsed: unknown = JSON.parse(String(args["layout_json"]));
        const result = {
          valid: parsed !== null && typeof parsed === "object",
          value: parsed,
        };
        return jsonResult(result, result);
      },
    },
    {
      name: "run_tests",
      title: "Run frontend tests",
      description: "Run frontend Jest tests in FrontendApp; optionally by file path filter.",
      inputSchema: { path: z.string().optional() },
      annotations: QUERY,
      run: async (args) => {
        const testPath = typeof args["path"] === "string" ? args["path"] : undefined;
        const { exitCode, output } = await runJest(testPath);
        return jsonResult({ exitCode, output: output.slice(-20000) });
      },
    },
    {
      name: "dry_run_dashboard",
      title: "Dry-run dashboard create/update",
      description:
        "Preview create/update without writing: validates the JSON, computes the backend-compatible id (Title.Text verbatim, '(N)' suffix) for create, or checks existence/read-only for update.",
      inputSchema: RawJsonInput,
      annotations: READ,
      outputSchema: z.object({
        valid: z.boolean(),
        innerJsonFields: z.array(z.string()),
        preview: z.record(z.unknown()),
      }).passthrough(),
      run: async (args) => {
        const dto = parseRaw(String(args["dashboard_json"]));
        const { innerJsonFields } = validateInnerJson(dto);
        const id = typeof dto.Id === "string" && dto.Id.length > 0 ? dto.Id : "";
        const preview =
          id.length > 0
            ? { operation: "update", ...(await previewUpdate(id)) }
            : { operation: "create", ...(await previewCreate(dto)) };
        const result = { valid: true, innerJsonFields, preview };
        return jsonResult(result, result);
      },
    },
    {
      name: "query_data",
      title: "Execute data request",
      description:
        "Execute a data request against the running backend: POST /api/Data. Pass the JSON body of DataRequest (DataSource with Connection+Queries, DataFields, Filter, Sorting, Datasets, Parameters) — copy it from the dashboard JSON DataSource. dataFields must carry unique per-field Ids (1, 2, 3, …).",
      inputSchema: { data_json: z.string().min(2) },
      annotations: QUERY,
      run: async (args) => jsonResult(await apiQueryData(parseJsonArg("data_json", args["data_json"]))),
    },
    {
      name: "get_tables_info",
      title: "Database schema info",
      description:
        "Database schema info via POST /api/TablesInfo. Without tables_json returns all table/view names; with tables_json ({dataSourceConnection, tables: [{schema, name, type}]}) returns columns and relations.",
      inputSchema: {
        connection_json: z.string().min(2),
        tables_json: z.string().min(2).optional(),
      },
      annotations: QUERY,
      run: async (args) => {
        const connection = parseJsonArg("connection_json", args["connection_json"]);
        const tablesRaw = args["tables_json"];
        if (tablesRaw === undefined) {
          return jsonResult(await apiGetTableNames(connection));
        }
        const tables = parseJsonArg("tables_json", tablesRaw) as Record<string, unknown>;
        return jsonResult(await apiGetColumnsInfo({ dataSourceConnection: connection, tables: tables["tables"] ?? tables }));
      },
    },
    {
      name: "get_component_schema",
      title: "Component Options examples",
      description:
        "Show real-world Options examples for a component type from existing dashboards (defaults give canonical shapes).",
      inputSchema: { type: z.string().min(1) },
      annotations: READ,
      outputSchema: z.object({
        type: z.string(),
        foundInDashboards: z.number().int(),
        examples: z.array(z.record(z.unknown())),
      }).passthrough(),
      run: async (args) => {
        const wanted = String(args["type"]);
        const ids = (await listDashboards()).map((meta) => String(meta.id ?? ""));
        const examples: Array<{ dashboardId: string; options: unknown; interactivity: unknown }> = [];
        const seenOptions = new Set<string>();
        for (const id of ids) {
          if (examples.length >= 2) break;
          const dto = await getDashboard(id);
          const component = dto.Components?.find(
            (c) => typeof c["Type"] === "string" && String(c["Type"]).toLowerCase() === wanted.toLowerCase()
          );
          if (!component) continue;
          // Dedup on the raw Options string AND the parsed object so both
          // identical raws and identical shapes are skipped.
          const rawOptions = typeof component.Options === "string" ? component.Options : "";
          if (rawOptions.length > 0) {
            if (seenOptions.has(rawOptions)) continue;
            seenOptions.add(rawOptions);
          } else if (examples.length > 0) {
            continue;
          }
          try {
            examples.push({
              dashboardId: id,
              options: parseInnerJson("Options", component.Options),
              interactivity: parseInnerJson("Interactivity", component.Interactivity),
            });
          } catch {
            continue;
          }
        }
        const result = { type: wanted, foundInDashboards: examples.length, examples };
        return jsonResult(result, result);
      },
    },
    {
      name: "export_dashboard",
      title: "Export dashboard",
      description: "Export a dashboard as a pretty-printed JSON string.",
      inputSchema: IdInput,
      annotations: READ,
      outputSchema: z.object({ exported: z.string() }).passthrough(),
      run: async (args) => {
        const dto = await getDashboard(String(args["id"]));
        const exported = JSON.stringify(dto, null, 2);
        return jsonResult({ exported }, { exported });
      },
    },
  ];

  const wrapped: McpToolDef[] = defs.map((tool) => ({
    ...tool,
    run: async (args: Record<string, unknown>): Promise<ToolResult> => {
      try {
        return await tool.run(args);
      } catch (e) {
        return errorResult(e as Error);
      }
    },
  }));

  return { tools: wrapped };
}
