# dashboards-mcp

**[Русская версия](README.ru.md)** | English below

MCP server for AI-assisted development and testing of [Dispather (Диспетчер) Dashboards](../) — a full-stack BI dashboard designer and runtime for manufacturing.

 Lets an AI agent (via [MCP](https://modelcontextprotocol.io)) list, read, create, edit, delete, validate and export dashboards, and run frontend tests — against both file-based storage (dev) and the HTTP API (integration testing).

## Tools

| Tool | Description |
|------|-------------|
| `list_dashboards` | List all dashboards (default `_default` + custom) |
| `get_dashboard` | Get full dashboard JSON by id |
| `create_dashboard` | Create a custom dashboard (ID generated from `Title.Text`, backend-compatible collision suffix `" (N)"`) |
| `update_dashboard` | Update an existing custom dashboard |
| `delete_dashboard` | Delete a custom dashboard (`_default` are read-only) |
| `validate_dashboard` | Zod schema check + inner-JSON validation + round-trip |
| `get_component_types` | The 17 canonical dashboard component types |
| `validate_layout` | Validate a react-grid-layout JSON string |
| `run_tests` | Run frontend Jest tests (`FrontendApp`, jest-puppeteer preset) |
| `export_dashboard` | Pretty-printed JSON export |

## Domain rules mirrored from the backend

- Dashboard ID = `Title.Text` **verbatim** (no slugification), `.json` extension, `" (N)"` suffix on collision, case-insensitive uniqueness (`DashboardsFileBaseStorage.GetNewDashboardId`)
- Default dashboards live in `App_Data/DefaultDashboards/` and are hydrated with a `_default` id suffix; they are read-only — MCP never writes to the defaults directory
- Custom dashboards live in `App_Data/Dashboards/`
- `Options`, `Interactivity` (and legacy `Layout`) are JSON-in-JSON strings — parsed and validated as inner JSON
- The HTTP API wraps responses in a `CommonResponse<T, ResponseBaseError>` envelope and returns HTTP 200 even on errors

## Setup

```bash
npm install
npm run build
```

## Verification

```bash
npm run verify      # round-trip validation over all default dashboard fixtures
node scripts/smoke.cjs   # MCP protocol smoke test (initialize + tools/list + tools/call)
```

## Configuration

Environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DASHBOARDS_ROOT` | yes (or auto-probe) | Dashboards backend root containing `App_Data/` |
| `DASHBOARDS_API_URL` | no | Running backend base URL — enables HTTP API calls |
| `DASHBOARDS_API_TIMEOUT_MS` | no | API timeout, default `60000` |

### Register with opencode

```jsonc
// ~/.config/opencode/opencode.json
{
  "mcp": {
    "dashboards-mcp": {
      "type": "local",
      "command": ["node", "<path>/mcp-server/dist/index.js"],
      "environment": { "DASHBOARDS_ROOT": "<path>/Dashboards/Dashboards" }
    }
  }
}
```

## Project layout

```
src/
├── index.ts        # MCP server entry point (stdio)
├── tools.ts        # 10 MCP tool implementations
├── schemas.ts      # Zod schemas + key-case normalization
├── storage.ts      # File-based storage provider
├── api-client.ts   # HTTP API client
├── types.ts        # TypeScript DTO types
└── verify.ts       # Round-trip verification script
scripts/
└── smoke.cjs       # MCP protocol smoke test
```
