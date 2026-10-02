<h1 align="center">dashboards-mcp</h1>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/MCP-1.x-black" alt="MCP" />
  <img src="https://img.shields.io/badge/tools-14-green" alt="tools" />
  <img src="https://img.shields.io/badge/round--trip-10%2F10%20fixtures-brightgreen" alt="verification" />
</p>

<p align="center"><a href="README.md">Русская версия</a> | <b>English</b></p>

---

MCP server for AI-assisted development and testing of the **Dispather (Dashboards)** BI dashboards: CRUD, validation, real data queries, DB schemas, frontend tests.

## Transports

| Mode | Launch | Best for |
|---|---|---|
| **stdio** (default) | `node dist/index.js` | local CLI agents (opencode, Claude Code, Codex) |
| **Streamable HTTP** | `DASHBOARDS_MCP_HTTP_PORT=3456 node dist/index.js` | remote/web agents, multiple clients |

## Two data targets

| Mode | Enabled by | Behavior |
|---|---|---|
| **File storage** | `DASHBOARDS_ROOT` | read/write `App_Data/Dashboards` and `App_Data/DefaultDashboards` |
| **HTTP API** | `DASHBOARDS_API_URL` | live backend calls: `/api/Dashboards`, `/api/Data`, `/api/TablesInfo` |

## Tools (14)

| Tool | Description |
|---|---|
| `list_dashboards` | all dashboards (default `_default` + custom) |
| `get_dashboard` | full JSON by id (file → HTTP API fallback) |
| `create_dashboard` | create a custom dashboard (ID from `Title.Text`, `" (N)"` collision suffix) |
| `update_dashboard` | update a custom dashboard; `_default` are read-only |
| `delete_dashboard` | delete a custom dashboard |
| `dry_run_dashboard` | preview create/update without writing: validation + computed ID / existence check |
| `validate_dashboard` | Zod schema + inner JSON (Options/Interactivity/Layout) + round-trip |
| `get_component_types` | the 17 canonical component types |
| `get_component_schema` | real-world Options examples for a type, taken from existing dashboards |
| `validate_layout` | react-grid-layout JSON validation |
| `query_data` | **POST /api/Data** — trial queries using a dashboard DataSource (real data) |
| `get_tables_info` | **POST /api/TablesInfo** — table/view names, columns and relations |
| `run_tests` | frontend Jest tests (`FrontendApp`, jest-puppeteer) |
| `export_dashboard` | pretty-printed JSON export |

## Domain rules mirrored from the backend

- 🆔 Dashboard ID = `Title.Text` verbatim (no slugification), `.json` extension, `" (N)"` suffix on collision, case-insensitive uniqueness
- 🔒 Default dashboards (`App_Data/DefaultDashboards/`) are read-only; MCP never writes to that directory
- 🗂 Custom dashboards live in `App_Data/Dashboards/`
- 📦 `Options`, `Interactivity`, `Layout` are JSON-in-JSON strings — parsed and validated as inner JSON
- ✉️ The HTTP API wraps responses in `CommonResponse<T, ResponseBaseError>` and returns HTTP 200 even on errors (the envelope is checked; camelCase/PascalCase both accepted)

## Getting started

```bash
npm install
npm run build
```

## Verification

```bash
npm run verify          # round-trip validation over all 10 default dashboard fixtures
node scripts/smoke.cjs  # MCP smoke: initialize, tools/list, tools/call
node scripts/qa.cjs     # full QA batch: 30 scenarios (CRUD, collisions, _default protection, traversal)
```

## Docker

```bash
docker build -t dashboards-mcp .

# stdio mode (let the agent attach to stdin/stdout)
docker run -i --rm -v <path>/Dashboards/Dashboards:/data dashboards-mcp

# HTTP mode
docker run -d --rm -p 3456:3456 \
  -e DASHBOARDS_MCP_HTTP_PORT=3456 \
  -v <path>/Dashboards/Dashboards:/data \
  dashboards-mcp
```

## Docker Compose

```bash
cd mcp-server
docker compose up -d --build
```

Compose starts the server in HTTP mode on port `3456` by default:
- mounts the backend `App_Data` into the container as `/data`;
- points `DASHBOARDS_API_URL` at the live BI (`host.docker.internal:8014` — adjust to your setup).

The agent connects over HTTP:

```json
{ "mcp": { "dashboards-mcp": { "type": "remote", "url": "http://localhost:3456/mcp" } } }
```

## Transports and SSE

Two MCP transports are supported:

| Transport | For | Enabled by |
|---|---|---|
| **stdio** | local agent, process launch | default |
| **Streamable HTTP** | container / remote agent | `DASHBOARDS_MCP_HTTP_PORT` |

Streamable HTTP is the current MCP transport: responses stream over SSE (`text/event-stream`) within the HTTP connection, so any SSE-capable MCP client works with it directly. The legacy (deprecated) SSE transport is intentionally not included — the MCP spec marks it obsolete.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DASHBOARDS_ROOT` | yes (or auto-probe) | Dashboards backend root containing `App_Data/` |
| `DASHBOARDS_API_URL` | no | running backend base URL (e.g. `http://localhost:8014`) |
| `DASHBOARDS_MCP_HTTP_PORT` | no | Streamable HTTP mode instead of stdio |
| `DASHBOARDS_API_TIMEOUT_MS` | no | API timeout, default `60000` |

## Connect your AI agent (opencode)

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

## Project layout

```
src/
├── index.ts        # entry point: stdio or streamable HTTP
├── tools.ts        # 14 MCP tools
├── schemas.ts      # Zod schemas + key-care normalization
├── storage.ts      # file-based storage provider
├── api-client.ts   # HTTP API client
├── types.ts        # TypeScript DTOs
└── verify.ts       # round-trip verification script
scripts/
└── smoke.cjs       # MCP protocol smoke test
```

## Release history

See [CHANGELOG.md](CHANGELOG.md).

---

Made with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)
