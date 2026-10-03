# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.2] - 2026-10-03

White-screen prevention and query_data contract documentation, from live-BI debugging on the emulator instance (root cause chain: empty top-level `Options` string → frontend `JSON.parse` crash; missing dashboard `parameters` → backend error 105).

### Fixed

- `validate_dashboard` / `dry_run_dashboard` now reject empty or blank `Layout` / `Options` / `Interactivity` strings — the frontend `JSON.parse()`s them and renders a blank screen (the exact white-screen class found on the emulator). Unparseable JSON-in-JSON now fails with a clear message instead of being silently skipped.
- `scripts/build-demo-dashboard.mjs` writes `Options: "{}"` instead of `""` (source of the white-screen demo).

### Documented

- `query_data` tool description now carries the full `/api/Data` contract: unique per-field `Id`s, `DataSourceFieldId` must match a query column id, `filter` is an object `{itemType:0, logicType:0, children:[]}` (never null), datasets shape, and the `parameters` requirement when the query has `?Name` references (otherwise backend error 105).

### Verified

- Live emulator end-to-end: cloned working dashboard renders; `QA Emulator Data` dashboard built from emulator DB metadata (real columns via `/api/TablesInfo/tablesInfo`) with dashboard `Parameters` (ID=3041) — `POST /api/Data` returns 200 with datasets.
- Gates: build clean, round-trip 10/10, spec-smoke 10/10, QA 36/36.

## [1.4.1] - 2026-10-03

Hotfix from post-release review of v1.4.0 (Oracle, verdict FAIL → fixed).

### Fixed

- **api-create id trust**: the id returned by `create_dashboard` now comes from the backend response payload when present (the backend recomputes the stored id from the original untrimmed Title.Text); preflight id stays the fallback.
- **Title rules exactness**: api-mode id allocation no longer trims `Title.Text` before use (backend keeps it verbatim; whitespace falls back to `dashboard`), and list-id comparisons are trimmed and accept both `Id`/`Name` casings.
- Removed dead `TemplateParams`/`paramsOf` from resource handlers.

### Changed

- README (RU/EN): `dashboards://stats` documented in the resources table.

### Known limitation (documented, not fixable client-side)

- Backend id allocation is not atomic: two concurrent creates with the same title can race and one may overwrite the other (`DashboardsFileBaseStorage` writes by filename without an exclusive-create flag). Requires an exclusive-create/retry in the backend.

## [1.4.0] - 2026-10-03

### Added

- **Write tools operate on the live backend when `DASHBOARDS_API_URL` is set** — `create_dashboard` allocates the id against the remote list (GetNewDashboardId mirror), `update_dashboard` requires `Id`, `delete_dashboard` surfaces backend refusal; file storage remains the read/offline path. `dry_run_dashboard` previews against the live list in this mode.
- **Optional bearer auth for the HTTP transport (`DASHBOARDS_MCP_HTTP_TOKEN`)** — RFC 6750 `401 + WWW-Authenticate` challenge on missing/wrong token, RFC 9728 protected-resource metadata at `/.well-known/oauth-protected-resource` (served unauthenticated — it only advertises the requirement).
- **Structured stderr logging** (`src/logger.ts`) — one JSON line per event (`server_started`, `tool_call` with duration/error, `http_request` with status/latency); `DASHBOARDS_MCP_LOG=off|debug|info|warn|error`.
- **`dashboards://stats` resource** — per-tool call counters (count/errors/avg latency) since server start, for ops and agent self-observation.
- `scripts/auth-smoke.cjs` (`npm run auth`) — end-to-end bearer-auth harness (401/200/RFC 9728).

### Changed

- Tool wrappers record call statistics and emit structured logs.
- `spec-smoke` rpc calls now fail fast after 30s instead of hanging forever.

## [1.3.2] - 2026-10-03

Release-hygiene patch (from flash-agent code review of v1.3.1 — verdict PASS, no CRITICAL/MAJOR).

### Fixed
- `serverInfo.version` advertised 1.3.0 on the v1.3.1 release — `SERVER_VERSION` now tracks package.json semantics again.
- Stray UTF-8 BOM in `package.json` removed (npm tolerated it; strict `JSON.parse` would not).

### Changed
- Dashboard listing order is deterministic again: parallel reads made it file-read-completion dependent; metas now sort by id before returning.

## [1.3.1] - 2026-10-03

### Fixed
- **Resource templates now actually resolve** — in v1.3.0 the three parameterized URIs were registered through the SDK's *static* resource path (a plain string selects that overload), so reads like `dashboards://<id>/summary` matched nothing. Registration now wraps each URI in `ResourceTemplate` (found by independent review).
- `get_dashboard` failures set `isError: true` per MCP spec (the guided hint is still delivered in content).
- `list_dashboards` text content and `structuredContent` now use the same `{dashboards}` shape.
- TTL list cache no longer repopulates stale data from a listing that started before a write (generation counter).

### Changed
- QA battery extended to **36 scenarios** — now asserts the permanent `resources`/`resources/templates`/`prompts` surfaces (this gap let the template bug slip through); spec-smoke hard-asserts its checks instead of just logging.

### Added
- **Resources** (`dashboards://{id}/summary`, `dashboards://{id}/components/{index}/options`, `dashboards://{id}/datasources/{index}/schema`, `dashboards://index`) — thin agent-friendly views so an agent can scan ~1 KB summaries instead of pulling 10–40 KB dashboard JSON through tools.
- **Prompt recipe** `build_dashboard` — guided step-by-step workflow (inspect schemas → dry-run → create → query_data → cleanup) so the agent follows a checklist instead of inventing call sequences.
- **TTL cache** (5 s, invalidated on create/update/delete) for dashboard listing; component-schema scan now reads candidate dashboards **in parallel**.
- **Guided error hints** — schema-validation failures and `get_dashboard` misses now suggest the next concrete step (e.g. "copy a working shape from get_component_schema", "call list_dashboards first").

## [1.2.0] - 2026-10-03

Alignment with the current MCP specification (2026-07-28) and SDK 1.32 recommended patterns.

### Added
- Human-readable tool `title` on all 14 tools and a server `title` ("Dispather Dashboards MCP") + `websiteUrl` in `serverInfo` (spec 2025-11-25+).
- Tool annotations (spec-compliant hints, no client capability required): `readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint` — read-only, query-like and write semantics are now declared for every tool.
- Protocol-level `outputSchema` + `structuredContent` for tools with a stable result shape: `validate_dashboard`, `create_dashboard`, `update_dashboard`, `delete_dashboard`, `dry_run_dashboard`, `validate_layout`, `get_component_types`, `get_component_schema`, `export_dashboard`, `list_dashboards`.
- `query_data` description now documents the unique `dataFields[].Id` requirement.

### Changed
- `tools/list` is deterministic: tools are registered sorted by name (spec SHOULD).
- SDK floor raised to `^1.32.0` (already resolved by the lockfile).

## [1.1.2] - 2026-10-03

Live-end-to-end validation of the full MCP surface against a running BI backend, plus the follow-up fix it surfaced.

### Fixed
- `validate_dashboard` / `dry_run_dashboard` no longer emit double-nested `innerJsonFields` — the helper already returned the flat shape and both call sites wrapped it twice.

### Added
- Demo dashboard builder (`scripts/build-demo-dashboard.mjs`) and the verified dashboard fixture (`scripts/demo-dashboard.json`): `dbo.Machine` table with a `table` component, created and validated through MCP over a live backend.
- `/api/Data` diagnosis harness (`scripts/probe-data.mjs`) — pinpoints backend error 105 by comparing request variants.
- Documented `query_data` payload contract: `dataFields` require per-field unique `Id` (1, 2, 3, …); backend `SqlQueryDefinitionBuilder` keys the lookup by it, and duplicate/absent ids (all defaulting to 0) cause a dictionary collision that surfaces as SQL error 105.

## [1.1.1] - 2026-10-03

Security and correctness hardening from the 5-lane professional review (goal, QA, code quality, security, backend-parity).

### Security
- Fixed path traversal: dashboard ids and `Title.Text` are validated as a single safe path segment (`assertSafeFileId`) — no separators, `..`, traversal, null bytes or Windows-reserved device names can escape `App_Data/Dashboards`.
- Fixed command injection in `run_tests`: the runner is spawned with `shell: false` (`yarn.cmd` on Windows) so the test-path argument can never execute shell metacharacters.
- HTTP transport now binds to `127.0.0.1` by default (override with `DASHBOARDS_MCP_HTTP_HOST`) and documents that the endpoint is unauthenticated.

### Fixed
- `create_dashboard` works on a fresh checkout: `App_Data/Dashboards` is created with `mkdir { recursive: true }` instead of failing with ENOENT.
- `run_tests` points at the real frontend location (`../Dashboards/FrontendApp`) — previously always failed to find the directory.
- Tool errors are returned as MCP `isError` results instead of crashing protocol framing with `-32602`.
- Whitespace-only `Title.Text` falls back to `dashboard` (mirrors backend `IsNullOrWhiteSpace` instead of erroring).
- `get_dashboard` falls back to the defaults directory for bare ids whose custom files do not exist (mirrors backend `GetById`).
- Collision race: create claims the file with `wx` and retries the `" (N)"` suffix on `EEXIST` — concurrent creates can no longer overwrite each other.
- Files are written without `Id`/`IsDefault` (the backend `DashboardDataModel` hydrates identity from the file name).
- `list_dashboards` skips unreadable/corrupt JSON files with a warning (mirrors backend) instead of failing the whole call.
- `validate_dashboard` no longer emits double-nested `innerJsonFields`.
- HTTP errors now surface the response body (truncated) instead of a bare status code.
- `npm run verify` is a real round-trip: serialized output is compared against the canonical original, not against itself — a schema change that drops data now fails the check.

### Added
- Permanent QA harness `scripts/qa.cjs` (`npm run qa`): 30 stdio scenarios — CRUD round-trip, collision/dry-run, `_default` protection, validation errors, unicode titles, path-traversal and command-injection abuse probes.

## [1.1.0] - 2026-10-03

### Added
- `dry_run_dashboard` — preview create/update without writing: full validation plus the backend-compatible id (`Title.Text` + `" (N)"` collision) or an existence/read-only check.
- `query_data` — execute trial data requests against the live backend (`POST /api/Data`); verified against a running BI instance.
- `get_tables_info` — database schema via `POST /api/TablesInfo`: table/view names, columns, relations.
- `get_component_schema` — real-world `Options` examples for a component type, extracted from existing dashboards.
- Streamable HTTP transport: set `DASHBOARDS_MCP_HTTP_PORT` to serve over HTTP instead of stdio.
- Dockerfile (multi-stage, node:22-alpine; mount the backend root as `/data`).

### Fixed
- HTTP envelope parsing is now case-insensitive: ASP.NET serializes `CommonResponse` camelCase (`{data, error}`), errors now surface backend error messages.

### Changed
- README rewritten bilingually (`README.md` — Русский, `README.en.md` — English) with transports, Docker and the 14-tool reference.

## [1.0.0] - 2026-10-02

### Added
- MCP server `dashboards-mcp` over stdio (TypeScript, `@modelcontextprotocol/sdk` + `zod`).
- 10 tools:
  - `list_dashboards` — default (`_default`) + custom dashboards from `App_Data`
  - `get_dashboard` — full dashboard JSON by id (file first, HTTP API fallback)
  - `create_dashboard` — custom dashboard, ID generated from `Title.Text` verbatim with `" (N)"` collision suffix (backend-compatible)
  - `update_dashboard` — custom dashboards only; defaults are read-only
  - `delete_dashboard` — custom dashboards only
  - `validate_dashboard` — Zod schema check, nested JSON-in-JSON validation (`Options`, `Interactivity`, `Layout`), round-trip
  - `get_component_types` — the 17 canonical component types
  - `validate_layout` — react-grid-layout JSON check
  - `run_tests` — frontend Jest tests (`FrontendApp`, jest-puppeteer preset)
  - `export_dashboard` — pretty-printed form
- HTTP API client wrapping `/api/Dashboards` with `CommonResponse` envelope unwrapping; enabled via `DASHBOARDS_API_URL`.
- Round-trip verification script (`npm run verify`) covering all 10 default dashboard fixtures — mixed PascalCase/camelCase keys normalized, missing `SourceType` defaults to DataBase.
- MCP protocol smoke test (`scripts/smoke.cjs`): initialize, tools/list, tools/call.
- README with tool reference and setup docs (v1.0.0).

[1.3.0]: https://github.com/ibeercan/dashboards-mcp/releases/tag/v1.3.0
[1.1.2]: https://github.com/ibeercan/dashboards-mcp/releases/tag/v1.1.2
[1.1.1]: https://github.com/ibeercan/dashboards-mcp/releases/tag/v1.1.1
[1.1.0]: https://github.com/ibeercan/dashboards-mcp/releases/tag/v1.1.0
[1.0.0]: https://github.com/ibeercan/dashboards-mcp/releases/tag/v1.0.0
