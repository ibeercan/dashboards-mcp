<div align="center">

# dashboards-mcp

**MCP server for AI-assisted development and testing of [Dispather (Р”РёСЃРїРµС‚С‡РµСЂ)](https://github.com/ibeercan) dashboards** вЂ” a full-stack BI dashboard designer and runtime for manufacturing.

[Русская версия](README.md) | [English](README.en.md)
[Русская версия](README.md) | [English](README.en.md)
[Русская версия](README.md) | [English](README.en.md)
[Русская версия](README.md) | [English](README.en.md)

[Русская версия](README.md) | [English](README.en.md)

</div>

## Overview

`dashboards-mcp` speaks the [Model Context Protocol](https://modelcontextprotocol.io) over **stdio**, so any MCP-capable AI agent can work with dashboards the same way the BI backend does вЂ” no UI required.

Two data targets:

| Mode | Target | Use for |
|------|--------|---------|
| **File storage** | `App_Data/` on disk | Day-to-day dashboard development |
| **HTTP API** | running backend (`DASHBOARDS_API_URL`) | Integration-testing against the live system |

## What it can do

| Tool | Description |
|------|-------------|
| `list_dashboards` | List all dashboards (defaults with `_default` suffix + custom) |
| `get_dashboard` | Get full dashboard JSON by id (file first, API fallback) |
| `create_dashboard` | Create custom dashboard, backend-compatible ID & collision rules |
| `update_dashboard` | Update an existing custom dashboard |
| `delete_dashboard` | Delete custom dashboard (`_default` ones are read-only) |
| `validate_dashboard` | Zod schema + inner JSON check + round-trip |
| `get_component_types` | The 17 canonical component types |
| `validate_layout` | Validate a react-grid-layout JSON string |
| `run_tests` | Run frontend Jest tests (`FrontendApp`) |
| `export_dashboard` | Pretty-printed JSON export |

## Domain rules mirrored from the backend

These are not conventions вЂ” they are exact behaviors of `DashboardsFileBaseStorage`:

- рџ”‘ **ID = `Title.Text` verbatim** (no slugification), `.json` extension
- рџ”Ѓ **Collision suffix `" (N)"`**, case-insensitive uniqueness
- рџ”’ **`_default` = read-only**: default dashboards live in `App_Data/DefaultDashboards/`, get the `_default` suffix on read, and the server never writes there
- рџ“¦ **Custom dashboards** live in `App_Data/Dashboards/`
- рџ§… **JSON-in-JSON**: `Options`, `Interactivity` (and legacy `Layout`) are strings containing JSON вЂ” parsed and validated as inner JSON
- вњ‰пёЏ **API envelope**: HTTP responses are wrapped in `CommonResponse<T, ResponseBaseError>` and return **HTTP 200 even on errors** вЂ” the client unwraps them

## Getting started

```bash
# 1. Install
npm install

# 2. Build
npm run build
```

## Verification

```bash
npm run verify            # round-trip validation over all 10 default fixtures
node scripts/smoke.cjs    # MCP protocol smoke test (initialize + tools/list + tools/call)
```

## Connect your AI agent

Environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DASHBOARDS_ROOT` | yes (or auto-probe) | Dashboards backend root containing `App_Data/` |
| `DASHBOARDS_API_URL` | no | Running backend base URL вЂ” enables HTTP API mode |
| `DASHBOARDS_API_TIMEOUT_MS` | no | API timeout, default `60000` |

Register with [opencode](https://opencode.ai):

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
в”њв”Ђв”Ђ index.ts        # MCP server entry point (stdio)
в”њв”Ђв”Ђ tools.ts        # 10 MCP tool implementations
в”њв”Ђв”Ђ schemas.ts      # Zod schemas + key-case normalization
в”њв”Ђв”Ђ storage.ts      # File-based storage provider
в”њв”Ђв”Ђ api-client.ts   # HTTP API client
в”њв”Ђв”Ђ types.ts        # TypeScript DTO types
в””в”Ђв”Ђ verify.ts       # Round-trip verification script
scripts/
в””в”Ђв”Ђ smoke.cjs       # MCP protocol smoke test
```

## Release history

Release history and planned improvements live in [`CHANGELOG.md`](CHANGELOG.md).

---

<div align="center">

Built with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)

</div>
