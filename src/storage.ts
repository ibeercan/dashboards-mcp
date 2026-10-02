import fs from "node:fs/promises";
import path from "node:path";
import type { DashboardDto, DashboardMeta } from "./types.js";

const FILE_EXTENSION = ".json";
const DEFAULT_SUFFIX = "_default";
const DEFAULT_NEW_ID = "dashboard";

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Resolves App_Data root.
 * Env DASHBOARDS_ROOT points to the backend root that CONTAINS App_Data.
 * Otherwise probes known relative locations so the server works from mcp-server/.
 */
export async function resolveAppData(): Promise<string> {
  const candidates: string[] = [];
  const envRoot = process.env["DASHBOARDS_ROOT"];
  if (envRoot) {
    candidates.push(path.resolve(envRoot, "App_Data"));
    candidates.push(path.resolve(envRoot));
  }
  candidates.push(path.resolve("..", "Dashboards", "App_Data"));
  candidates.push(path.resolve("App_Data"));

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return candidate;
    } catch {
      // keep probing
    }
  }
  throw new Error(
    "App_Data not found. Set DASHBOARDS_ROOT to the Dashboards backend root."
  );
}

export function isDefaultId(id: string): boolean {
  return id.toLowerCase().endsWith(DEFAULT_SUFFIX);
}

/** Backend hydrates default IDs with the `_default` suffix; files do not contain it. */
export function toFileId(id: string): string {
  return isDefaultId(id) ? id.slice(0, id.length - DEFAULT_SUFFIX.length) : id;
}

/**
 * Dashboard IDs are used verbatim as file names — they must be a single safe
 * path segment. Rejects empty, path separators, traversal characters, and
 * Windows-reserved names so user input can never escape the storage directory.
 */
export function assertSafeFileId(id: string): void {
  if (id.length === 0 || id.trimEnd().length === 0) {
    throw new Error("Dashboard id is required");
  }
  if (id !== id.trim() || id.endsWith(".")) {
    throw new Error(`Dashboard id '${id}' is not a valid file name`);
  }
  if (/[/\\:]/.test(id) || id.includes("\0")) {
    throw new Error(`Dashboard id '${id}' contains path-illegal characters`);
  }
  if (/^(con|prn|aux|com[1-9]|lpt[1-9])$/i.test(id)) {
    throw new Error(`Dashboard id '${id}' is a reserved Windows device name`);
  }
}

/** Writes only builtin fields understood by the backend (DashboardDataModel has no Id/IsDefault). */
function toPersisted(dto: DashboardDto): DashboardDto {
  const persisted: Record<string, unknown> = { ...dto };
  delete persisted["Id"];
  delete persisted["IsDefault"];
  return persisted as unknown as DashboardDto;
}

function metaDir(id: string): "defaults" | "custom" {
  return isDefaultId(id) ? "defaults" : "custom";
}

async function readDashboardFile(filePath: string): Promise<DashboardDto> {
  const text = await fs.readFile(filePath, "utf8");
  return JSON.parse(stripBom(text)) as DashboardDto;
}

async function listFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir);
    return entries
      .filter((name) => name.endsWith(FILE_EXTENSION))
      .map((name) => path.join(dir, name));
  } catch {
    return [];
  }
}

async function titleOf(dir: string, id: string): Promise<string | null> {
  try {
    const dto = await readDashboardFile(path.join(dir, id + FILE_EXTENSION));
    return dto.Title?.Text ?? null;
  } catch {
    return null;
  }
}

export interface StorageDirs {
  custom: string;
  defaults: string;
}

export async function getDirs(): Promise<StorageDirs> {
  const appData = await resolveAppData();
  return {
    custom: path.join(appData, "Dashboards"),
    defaults: path.join(appData, "DefaultDashboards"),
  };
}

export async function listDashboards(): Promise<DashboardMeta[]> {
  const dirs = await getDirs();
  const metas: DashboardMeta[] = [];
  const seen = new Set<string>();

  const collect = async (dir: string, isDefault: boolean) => {
    for (const filePath of await listFiles(dir)) {
      const id = path.basename(filePath, FILE_EXTENSION);
      const key = id.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        const dto = await readDashboardFile(filePath);
        metas.push({
          id: isDefault ? id + DEFAULT_SUFFIX : id,
          name: dto.Title?.Text ?? id,
          isDefault,
          path: filePath,
        });
      } catch (e) {
        // Backend logs and skips unreadable files; mirror that so one corrupt file
        // cannot break the whole listing.
        process.stderr.write(
          `[dashboards-mcp] skipping unreadable dashboard file '${filePath}': ${(e as Error).message}\n`
        );
      }
    }
  };

  await collect(dirs.defaults, true);
  await collect(dirs.custom, false);
  return metas;
}

async function existingIdsLow(dirs: StorageDirs): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const dir of [dirs.defaults, dirs.custom]) {
    for (const filePath of await listFiles(dir)) {
      ids.add(path.basename(filePath, FILE_EXTENSION).toLowerCase());
    }
  }
  return ids;
}

/** Mirrors backend GetNewDashboardId: Title.Text verbatim, `" (N)"` suffix, case-insensitive. */
async function uniqueId(dirs: StorageDirs, desired: string): Promise<string> {
  const base = desired.length > 0 ? desired : DEFAULT_NEW_ID;
  const existed = await existingIdsLow(dirs);
  let id = base;
  let counter = 0;
  while (existed.has(id.toLowerCase())) {
    id = `${base} (${++counter})`;
  }
  return id;
}

export async function getDashboard(id: string): Promise<DashboardDto> {
  assertSafeFileId(id);
  const dirs = await getDirs();
  const kind = metaDir(id);
  const fileId = toFileId(id);
  const dir = kind === "defaults" ? dirs.defaults : dirs.custom;
  const targetPath = path.join(dir, fileId + FILE_EXTENSION);
  try {
    const dto = await readDashboardFile(targetPath);
    if (kind === "defaults") {
      dto.Id = fileId + DEFAULT_SUFFIX;
      dto.IsDefault = true;
    }
    return dto;
  } catch (e) {
    // Backend DashboardsFileStorage.GetById falls back to the defaults storage
    // when a bare (non-suffixed) id has no custom file.
    if (kind === "custom" && (e as NodeJS.ErrnoException).code === "ENOENT") {
      const defaultTarget = path.join(dirs.defaults, fileId + FILE_EXTENSION);
      try {
        const dto = await readDashboardFile(defaultTarget);
        dto.Id = fileId + DEFAULT_SUFFIX;
        dto.IsDefault = true;
        return dto;
      } catch {
        // fall through to the original error
      }
    }
    throw new Error(`Dashboard '${id}' not found`);
  }
}

/** Mirrors backend GetNewDashboardId: whitespace-only title falls back to "dashboard". */
function baseIdOf(title: string | undefined): string {
  const raw = title ?? "";
  return raw.trim().length === 0 ? DEFAULT_NEW_ID : raw;
}

/**
 * Creates the file as a final atomic claim in the collision loop: `wx` fails
 * with EEXIST when a concurrent create has already won, so the suffix retry
 * preserves the backend `" (N)"` semantics without overwriting anything.
 */
export async function createDashboard(dashboard: DashboardDto): Promise<{ id: string; path: string }> {
  const base = baseIdOf(dashboard.Title?.Text);
  assertSafeFileId(base);
  const dirs = await getDirs();
  await fs.mkdir(dirs.custom, { recursive: true });
  for (;;) {
    const id = await uniqueId(dirs, base);
    const filePath = path.join(dirs.custom, id + FILE_EXTENSION);
    try {
      await fs.writeFile(filePath, JSON.stringify(toPersisted(dashboard), null, 2), {
        encoding: "utf8",
        flag: "wx",
      });
      return { id, path: filePath };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      // Lost a race; loop recomputes the next free suffix.
    }
  }
}

export async function updateDashboard(dashboard: DashboardDto): Promise<string> {
  const id = dashboard.Id;
  assertSafeFileId(id ?? "");
  if (isDefaultId(id as string)) throw new Error(`Default dashboard '${id}' is read-only`);
  const dirs = await getDirs();
  const filePath = path.join(dirs.custom, toFileId(id as string) + FILE_EXTENSION);
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Dashboard '${id}' not found`);
  }
  await fs.writeFile(filePath, JSON.stringify(toPersisted(dashboard), null, 2), "utf8");
  return filePath;
}

export async function previewCreate(dashboard: DashboardDto): Promise<{ id: string; title: string; targetPath: string }> {
  const dirs = await getDirs();
  const title = dashboard.Title?.Text ?? "";
  const id = await uniqueId(dirs, title);
  return { id, title, targetPath: path.join(dirs.custom, id + FILE_EXTENSION) };
}

export async function previewUpdate(id: string): Promise<{ id: string; exists: boolean; readOnly: boolean }> {
  assertSafeFileId(id);
  if (isDefaultId(id)) return { id, exists: true, readOnly: true };
  const dirs = await getDirs();
  const exists = await fs
    .access(path.join(dirs.custom, toFileId(id) + FILE_EXTENSION))
    .then(
      () => true,
      () => false
    );
  return { id, exists, readOnly: false };
}

export async function deleteDashboard(id: string): Promise<boolean> {
  assertSafeFileId(id);
  if (isDefaultId(id)) throw new Error(`Default dashboard '${id}' cannot be deleted`);
  const dirs = await getDirs();
  const filePath = path.join(dirs.custom, toFileId(id) + FILE_EXTENSION);
  try {
    await fs.access(filePath);
  } catch {
    return false;
  }
  await fs.unlink(filePath);
  return true;
}

export { titleOf };
