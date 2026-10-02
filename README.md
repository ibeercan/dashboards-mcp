<div align="center">

# dashboards-mcp

**MCP server for AI-assisted development and testing of [Dispather (Диспетчер)](https://github.com/ibeercan) dashboards** — a full-stack BI dashboard designer and runtime for manufacturing.

[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Model Context Protocol](https://img.shields.io/badge/protocol-MCP-7c3aed)](https://modelcontextprotocol.io)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Round-trip: 10/10 fixtures](https://img.shields.io/badge/round--trip-10%20of%2010%20fixtures-brightgreen)](#verification)

[English](#overview) | [Русская версия](README.ru.md)

</div>

## Overview

`dashboards-mcp` speaks the [Model Context Protocol](https://modelcontextprotocol.io) over **stdio**, so any MCP-capable AI agent can work with dashboards the same way the BI backend does — no UI required.

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

These are not conventions — they are exact behaviors of `DashboardsFileBaseStorage`:

- 🔑 **ID = `Title.Text` verbatim** (no slugification), `.json` extension
- 🔁 **Collision suffix `" (N)"`**, case-insensitive uniqueness
- 🔒 **`_default` = read-only**: default dashboards live in `App_Data/DefaultDashboards/`, get the `_default` suffix on read, and the server never writes there
- 📦 **Custom dashboards** live in `App_Data/Dashboards/`
- 🧅 **JSON-in-JSON**: `Options`, `Interactivity` (and legacy `Layout`) are strings containing JSON — parsed and validated as inner JSON
- ✉️ **API envelope**: HTTP responses are wrapped in `CommonResponse<T, ResponseBaseError>` and return **HTTP 200 even on errors** — the client unwraps them

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
| `DASHBOARDS_API_URL` | no | Running backend base URL — enables HTTP API mode |
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

## Release history

Release history and planned improvements live in [`CHANGELOG.md`](CHANGELOG.md).

---

<div align="center">

Built with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)

</div>
