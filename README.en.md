<h1 align="center">dashboards-mcp</h1>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/MCP-2026--07--28-black" alt="MCP" />
  <img src="https://img.shields.io/badge/tools-14-green" alt="tools" />
  <img src="https://img.shields.io/badge/round--trip-10%2F10%20fixtures-brightgreen" alt="verification" />
</p>

<p align="center"><a href="README.md">Русская версия</a> | <b>English</b></p>

---

## Why this exists

Dashboards of the **Dispather** BI are plain JSON files with a complex inner structure: 17 component types, JSON-inside-JSON strings (`Layout`, `Options`, `Interactivity`), data-source parameters, non-obvious ID rules. Editing them by hand is slow, and one wrong field can break a dashboard entirely.

dashboards-mcp plugs this system into an AI agent as a set of ordinary MCP tools. The agent gets access to real dashboards, their structure and live data — and can assemble, validate and test a dashboard within a single conversation, without opening an IDE or an SQL client.

A typical agent session looks like this:

1. `get_component_types` + `get_component_schema type="table"` — see what components exist and how their `Options` look inside reference dashboards;
2. `dry_run_dashboard` — validate a draft and learn in advance which ID the title will produce;
3. `create_dashboard` — create the dashboard (ID rules and protections are applied automatically);
4. `query_data` — confirm the data source actually returns rows from the live BI;
5. `run_tests` — run the frontend test suite if shared code changed.

## How it works

The MCP server (TypeScript, stdio or Streamable HTTP) works with two kinds of sources — combinable:

| Mode | Switch | What it gives |
|---|---|---|
| **File storage** | `DASHBOARDS_ROOT` | direct read/write of `App_Data/Dashboards` and `App_Data/DefaultDashboards` |
| **HTTP API** | `DASHBOARDS_API_URL` | the live backend: `/api/Dashboards`, `/api/Data`, `/api/TablesInfo` |

If not set, file roots are discovered automatically relative to the server location.

## Tools (14)

| Tool | What it does |
|---|---|
| `list_dashboards` | show all dashboards (defaults `_default` + custom) |
| `get_dashboard` | return the full dashboard JSON by id |
| `create_dashboard` | create a custom dashboard |
| `update_dashboard` | update a custom dashboard |
| `delete_dashboard` | delete a custom dashboard |
| `dry_run_dashboard` | preview create/update without writing |
| `validate_dashboard` | full validation (schema + inner JSON + round-trip) |
| `get_component_types` | reference of the 17 canonical component types |
| `get_component_schema` | real-world `Options` examples of a type from existing dashboards |
| `validate_layout` | validate react-grid-layout JSON |
| `query_data` | trial data request with real rows (`POST /api/Data`) |
| `get_tables_info` | DB schema: tables, views, columns, relations |
| `run_tests` | frontend Jest tests |
| `export_dashboard` | export a dashboard as pretty-printed JSON |

Every tool declares MCP annotations (read-only / destructiveness / idempotency) and, where the result shape is stable, returns protocol-level `structuredContent` backed by `outputSchema`.

## Domain rules (mirrored from the backend)

The server reproduces `DashboardsFileBaseStorage` behavior exactly, so the files it creates are indistinguishable from those created via the UI:

- 🆔 Dashboard ID = `Title.Text` verbatim (no slugging), `.json` extension, collision suffix `" (N)"`
- 🔒 Defaults (`App_Data/DefaultDashboards/`) are read-only; the MCP server never writes there
- 🗂 Custom dashboards live in `App_Data/Dashboards/`
- 📦 `Options`, `Interactivity`, `Layout` are JSON-in-JSON strings: the server checks they decode
- ✉️ The HTTP API returns HTTP 200 even on errors — the server unwraps the `CommonResponse<T, ResponseBaseError>` envelope (camelCase/PascalCase both)
- ⚠️ Security: dashboard paths are traversal-proof, `run_tests` runs without a shell, HTTP mode binds to `127.0.0.1` only

## Getting started

```bash
npm install
npm run build
```

That's it. To verify integrity:

```bash
npm run verify          # round-trip all 10 reference dashboards
node scripts/smoke.cjs  # MCP smoke: initialize, tools/list, tools/call
node scripts/qa.cjs     # full QA suite: 30 scenarios
```

## Connecting an AI agent

opencode (stdio):

```jsonc
// ~/.config/opencode/opencode.json
{
  "mcp": {
    "dashboards-mcp": {
      "type": "local",
      "command": ["node", "<path>/mcp-server/dist/index.js"],
      "environment": {
        "DASHBOARDS_ROOT": "<path>/Dashboards/Dashboards",
        "DASHBOARDS_API_URL": "http://localhost:8014"
      }
    }
  }
}
```

Any MCP client (HTTP):

```json
{ "mcp": { "dashboards-mcp": { "type": "remote", "url": "http://localhost:3456/mcp" } } }
```

## Resources and prompts (v1.3.0)

Besides the 14 tools the server exposes **resources** — thin views for scanning without heavy payloads:

| URI | What it gives |
|---|---|
| dashboards://index | every dashboard (id, name, isDefault) |
| dashboards://{id}/summary | meta: components, types, sources — bytes instead of 10-40 KB |
| dashboards://{id}/components/{index}/options | decoded Options/Interactivity of one component |
| dashboards://{id}/datasources/{index}/schema | columns/relations of one data source |

And a **prompt** uild_dashboard — a ready-made step-by-step recipe (schemas -> dry-run -> create -> verify data).


## Docker

```bash
docker build -t dashboards-mcp .

# stdio mode
docker run -i --rm -v <path>/Dashboards/Dashboards:/data dashboards-mcp

# HTTP mode
docker run -d --rm -p 3456:3456 \
  -e DASHBOARDS_MCP_HTTP_PORT=3456 \
  -v <path>/Dashboards/Dashboards:/data \
  dashboards-mcp
```

Or run everything at once with Compose (`docker compose up -d --build`): mounts `App_Data` into `/data`, serves HTTP on `3456`, and proxies `DASHBOARDS_API_URL` to the live BI (`host.docker.internal:8014` — adjust for your environment).

## Environment variables

| Variable | Required | Meaning |
|---|---|---|
| `DASHBOARDS_ROOT` | yes (or auto-discovery) | backend root containing `App_Data/` |
| `DASHBOARDS_API_URL` | no | live backend base URL |
| `DASHBOARDS_MCP_HTTP_PORT` | no | enables Streamable HTTP instead of stdio |
| `DASHBOARDS_MCP_HTTP_HOST` | no | HTTP host, default `127.0.0.1` |
| `DASHBOARDS_API_TIMEOUT_MS` | no | API timeout, default `60000` |

## Project layout

```
src/
├── index.ts        # entry point: stdio or streamable HTTP
├── tools.ts        # 14 MCP tools
├── schemas.ts      # Zod schemas + key-case normalization
├── storage.ts      # file storage (backend rules)
├── api-client.ts   # HTTP API client
├── types.ts        # TypeScript DTOs
└── verify.ts       # round-trip verification
scripts/
├── smoke.cjs       # MCP protocol smoke test
├── qa.cjs          # QA suite (30 scenarios)
└── spec-smoke.cjs  # spec-tier checks (annotations, structuredContent)
```

## Release history

See [CHANGELOG.md](CHANGELOG.md).

---

Made with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)
