import { getDashboard, listDashboards } from "./storage.js";

/**
 * Thin, agent-friendly views over full dashboard JSON.
 * A full dashboard is 10-40 KB; a summary is a few hundred bytes:
 * agents should scan summaries first and address heavy parts by URI.
 */

type ParsedDto = {
  Id?: string;
  Title?: { Text?: string };
  IsDefault?: boolean;
  Parameters?: unknown[];
  Components?: Array<Record<string, unknown>>;
  DataSources?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export interface DashboardSummary {
  id: string;
  title: string | null;
  isDefault: boolean;
  componentCount: number;
  componentTypes: string[];
  parameterCount: number;
  dataSources: Array<{ id: number | string; name: string; queryCount: number }>;
}

export async function dashboardSummary(id: string): Promise<DashboardSummary> {
  const dto = (await parse(id)) as ParsedDto;
  const components = dto.Components ?? [];
  return {
    id: String(dto["Id"] ?? id),
    title: dto.Title?.Text ?? null,
    isDefault: Boolean(dto["IsDefault"]),
    componentCount: components.length,
    componentTypes: components.map((c) => String(c["Type"] ?? "")).filter((t) => t.length > 0),
    parameterCount: (dto.Parameters ?? []).length,
    dataSources: (dto.DataSources ?? []).map((ds) => ({
      id: (ds["Id"] as number | string) ?? "",
      name: String(ds["Name"] ?? ""),
      queryCount: Array.isArray(ds["Queries"]) ? (ds["Queries"] as unknown[]).length : 0,
    })),
  };
}

export async function componentOptions(id: string, index: number): Promise<unknown> {
  const dto = (await parse(id)) as ParsedDto;
  const component = (dto.Components ?? [])[index];
  if (!component) throw new Error(`Component #${index} not found in '${id}'`);
  return {
    id,
    index,
    type: String(component["Type"] ?? ""),
    options: rawJson(component["Options"]),
    interactivity: rawJson(component["Interactivity"]),
    dataFields: component["DataFields"] ?? [],
  };
}

export async function dataSourceSchema(id: string, index: number): Promise<unknown> {
  const dto = (await parse(id)) as ParsedDto;
  const ds = (dto.DataSources ?? [])[index];
  if (!ds) throw new Error(`Data source #${index} not found in '${id}'`);
  const queries = Array.isArray(ds["Queries"]) ? (ds["Queries"] as Array<Record<string, unknown>>) : [];
  return {
    id,
    index,
    name: String(ds["Name"] ?? ""),
    queries: queries.map((q) => ({
      name: String(q["Name"] ?? ""),
      tables: q["Tables"] ?? [],
      columns: (Array.isArray(q["Columns"]) ? (q["Columns"] as Array<Record<string, unknown>>) : []).map(
        (col) => ({
          id: col["Id"],
          name: col["Name"],
          displayedName: col["DisplayedName"] ?? null,
          valueTypeName:
            (col["ValueType"] as Record<string, unknown> | undefined)?.["Name"] ?? null,
          aggregate: col["Aggregate"] ?? null,
        })
      ),
      rowsLimit: q["RowsLimit"] ?? null,
    })),
  };
}

function parse(id: string): Promise<unknown> {
  return getDashboard(id);
}

function rawJson(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

/** For scripts/tests: summaries of every dashboard. */
export async function allSummaries(): Promise<DashboardSummary[]> {
  const metas = await listDashboards();
  return Promise.all(metas.map((m) => dashboardSummary(m.id)));
}
