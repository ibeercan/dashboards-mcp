<h1 align="center">dashboards-mcp</h1>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/MCP-1.x-black" alt="MCP" />
  <img src="https://img.shields.io/badge/tools-14-green" alt="tools" />
  <img src="https://img.shields.io/badge/round--trip-10%2F10%20fixtures-brightgreen" alt="verification" />
</p>

<p align="center"><b>Русская версия</b> | <a href="README.en.md">English</a></p>

---

MCP-сервер для разработки и тестирования дашбордов BI **Dispather (Dashboards)** силами AI-агента: CRUD, валидация, запросы данных, схемы БД, тесты фронтенда.

## Транспорты

| Режим | Запуск | Кому подходит |
|---|---|---|
| **stdio** (по умолчанию) | `node dist/index.js` | локальные CLI-агенты (opencode, Claude Code, Codex) |
| **Streamable HTTP** | `DASHBOARDS_MCP_HTTP_PORT=3456 node dist/index.js` | удалённые/веб-агенты, несколько клиентов |

## Два источника данных

| Режим | Включение | Поведение |
|---|---|---|
| **Файловый** | `DASHBOARDS_ROOT` | чтение/запись `App_Data/Dashboards` и `App_Data/DefaultDashboards` |
| **HTTP API** | `DASHBOARDS_API_URL` | вызовы живого бэкенда `/api/Dashboards`, `/api/Data`, `/api/TablesInfo` |

## Инструменты (14)

| Инструмент | Описание |
|---|---|
| `list_dashboards` | все дашборды (дефолтные `_default` + кастомные) |
| `get_dashboard` | полный JSON по id (файл → HTTP API fallback) |
| `create_dashboard` | создать кастомный (ID из `Title.Text`, коллизия `" (N)"`) |
| `update_dashboard` | обновить кастомный; `_default` — только чтение |
| `delete_dashboard` | удалить кастомный |
| `dry_run_dashboard` | предпросмотр create/update без записи: валидация + вычисляемый ID / проверка существования |
| `validate_dashboard` | Zod-схема + вложенный JSON (Options/Interactivity/Layout) + round-trip |
| `get_component_types` | 17 канонических типов компонентов |
| `get_component_schema` | реальные примеры Options для типа из существующих дашбордов |
| `validate_layout` | валидация react-grid-layout JSON |
| `query_data` | **POST /api/Data** — пробные запросы по DataSource дашборда (реальные данные) |
| `get_tables_info` | **POST /api/TablesInfo** — список таблиц/представлений, колонки и связи |
| `run_tests` | Jest-тесты фронтенда (`FrontendApp`, jest-puppeteer) |
| `export_dashboard` | pretty-print JSON экспорт |

## Правила предметной области (зеркалят бэкенд)

- 🆔 ID дашборда = `Title.Text` дословно (без слага), расширение `.json`, коллизия — суффикс `" (N)"`, регистронезависимая уникальность
- 🔒 Дефолтные дашборды (`App_Data/DefaultDashboards/`) — только чтение; MCP никогда не пишет в эту директорию
- 🗂 Кастомные дашборды — `App_Data/Dashboards/`
- 📦 `Options`, `Interactivity`, `Layout` — JSON-в-JSON строки: парсятся и валидируются как вложенный JSON
- ✉️ HTTP API оборачивает ответы в `CommonResponse<T, ResponseBaseError>` и возвращает HTTP 200 даже при ошибке (проверяется envelope, camelCase/PascalCase — оба)

## Быстрый старт

```bash
npm install
npm run build
```

## Проверка

```bash
npm run verify          # round-trip валидация всех 10 дефолтных дашбордов
node scripts/smoke.cjs  # MCP smoke: initialize, tools/list, tools/call
node scripts/qa.cjs     # полная QA-батарейка: 30 сценариев (CRUD, коллизии, защита _default, traversal)
```

## Docker

```bash
docker build -t dashboards-mcp .

# stdio-режим (stdin/stdout подключение можно оставить агенту)
docker run -i --rm -v <путь>/Dashboards/Dashboards:/data dashboards-mcp

# HTTP-режим
docker run -d --rm -p 3456:3456 \
  -e DASHBOARDS_MCP_HTTP_PORT=3456 \
  -v <путь>/Dashboards/Dashboards:/data \
  dashboards-mcp
```

## Docker Compose

```bash
cd mcp-server
docker compose up -d --build
```

Compose по умолчанию поднимает сервер в HTTP-режиме на порту `3456`:
- монтирует `App_Data` бэкенда в контейнер как `/data`;
- проксирует `DASHBOARDS_API_URL` на живой BI (`host.docker.internal:8014` — поправьте под свою среду).

Агент подключается через HTTP:

```json
{ "mcp": { "dashboards-mcp": { "type": "remote", "url": "http://localhost:3456/mcp" } } }
```

## Транспорты и SSE

Сервер поддерживает два транспорта MCP:

| Транспорт | Когда | Включение |
|---|---|---|
| **stdio** | локальный агент, запуск процесса | по умолчанию |
| **Streamable HTTP** | контейнер/удалённый агент | переменная `DASHBOARDS_MCP_HTTP_PORT` |

Streamable HTTP — актуальный транспорт MCP: ответы передаются потоково, сервер шлёт SSE-поток (`text/event-stream`) внутри HTTP-соединения, поэтому SSE-совместимые клиенты работают с ним напрямую. Классический (deprecated) SSE-транспорт сознательно не добавлен: он помечен устаревшим в спецификации MCP.

## Переменные окружения

| Переменная | Обязательна | Описание |
|---|---|---|
| `DASHBOARDS_ROOT` | да (или авто-поиск) | корень бэкенда с `App_Data/` |
| `DASHBOARDS_API_URL` | нет | базовый URL бэкенда (например `http://localhost:8014`) |
| `DASHBOARDS_MCP_HTTP_PORT` | нет | режим Streamable HTTP вместо stdio |
| `DASHBOARDS_API_TIMEOUT_MS` | нет | таймаут API, по умолчанию `60000` |

## Подключение AI-агента (opencode)

```jsonc
// ~/.config/opencode/opencode.json
{
  "mcp": {
    "dashboards-mcp": {
      "type": "local",
      "command": ["node", "<путь>/mcp-server/dist/index.js"],
      "environment": {
        "DASHBOARDS_ROOT": "<путь>/Dashboards/Dashboards",
        "DASHBOARDS_API_URL": "http://localhost:8014"
      }
    }
  }
}
```

## Структура проекта

```
src/
├── index.ts        # точка входа: stdio или streamable HTTP
├── tools.ts        # 14 инструментов MCP
├── schemas.ts      # Zod-схемы + нормализация регистров ключей
├── storage.ts      # файловое хранилище
├── api-client.ts   # HTTP API клиент
├── types.ts        # TypeScript DTO
└── verify.ts       # скрипт round-trip верификации
scripts/
└── smoke.cjs       # smoke тест MCP протокола
```

## История версий

Смотри [CHANGELOG.md](CHANGELOG.md).

---

Сделано с [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)
