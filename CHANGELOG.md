# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/ibeercan/dashboards-mcp/releases/tag/v1.0.0
