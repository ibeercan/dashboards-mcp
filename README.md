<h1 align="center">dashboards-mcp</h1>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/MCP-2026--07--28-black" alt="MCP" />
  <img src="https://img.shields.io/badge/tools-14-green" alt="tools" />
  <img src="https://img.shields.io/badge/round--trip-10%2F10%20fixtures-brightgreen" alt="verification" />
</p>

<p align="center"><b>Русская версия</b> | <a href="README.en.md">English</a></p>

---

## Зачем это нужно

Дашборды BI **Dispather** — это обычные JSON-файлы со сложной внутренней структурой: 17 типов компонентов, вложенные JSON-строки (`Layout`, `Options`, `Interactivity`), параметры источников данных, неочевидные правила генерации ID. Писать и отлаживать их вручную медленно, а ошибка в одном поле ломает дашборд целиком.

dashboards-mcp подключает эту систему к AI-агенту как набор обычных MCP-инструментов. Агент получает доступ к живым дашбордам, их структуре и реальным данным — и может собрать, проверить и протестировать дашборд за один разговор, не открывая ни IDE, ни SQL-клиент.

Типичная сессия агента выглядит так:

1. `get_component_types` + `get_component_schema type="table"` — посмотреть, какие бывают компоненты и как выглядят их `Options` в реальных дашбордах-эталонах;
2. `dry_run_dashboard` — проверить черновик JSON и заранее узнать, какой ID получится из заголовка;
3. `create_dashboard` — создать дашборд (правила ID и защиты применяются автоматически);
4. `query_data` — убедиться, что источник данных возвращает реальные строки с живого BI;
5. `run_tests` — прогнать тесты фронтенда, если менялся общий код.

## Как это устроено

MCP-сервер (TypeScript, stdio или Streamable HTTP) работает с двумя типами источников — их можно комбинировать:

| Режим | Включение | Что даёт |
|---|---|---|
| **Файловый** | `DASHBOARDS_ROOT` | прямое чтение/запись `App_Data/Dashboards` и `App_Data/DefaultDashboards` |
| **HTTP API** | `DASHBOARDS_API_URL` | живой бэкенд: `/api/Dashboards`, `/api/Data`, `/api/TablesInfo` |

Пути к файлам если не указать — находятся автоматически относительно расположения сервера.

## Инструменты (14)

| Инструмент | Что делает |
|---|---|
| `list_dashboards` | показать все дашборды (дефолтные `_default` + кастомные) |
| `get_dashboard` | вернуть полный JSON по id |
| `create_dashboard` | создать кастомный дашборд |
| `update_dashboard` | обновить кастомный дашборд |
| `delete_dashboard` | удалить кастомный дашборд |
| `dry_run_dashboard` | предпросмотр create/update без записи |
| `validate_dashboard` | полная валидация JSON (схема + вложенные JSON + round-trip) |
| `get_component_types` | справочник 17 канонических типов компонентов |
| `get_component_schema` | живые примеры `Options` выбранного типа из существующих дашбордов |
| `validate_layout` | валидация react-grid-layout JSON |
| `query_data` | пробный запрос реальных данных (`POST /api/Data`) |
| `get_tables_info` | схема БД: таблицы, представления, колонки, связи |
| `run_tests` | Jest-тесты фронтенда |
| `export_dashboard` | экспорт дашборда в pretty-print JSON |

Каждый инструмент декларативно помечен аннотациями MCP (read-only / destructiveness / idempotency) и, где форма результата стабильна, возвращает протокольный `structuredContent` с `outputSchema`.

## Правила предметной области (зеркалят бэкенд)

Сервер воспроизводит поведение `DashboardsFileBaseStorage` один в один, поэтому созданные им файлы неотличимы от созданных руками в UI:

- 🆔 ID дашборда = `Title.Text` дословно (без слага), расширение `.json`; при коллизии — суффикс `" (N)"`
- 🔒 Дефолтные дашборды (`App_Data/DefaultDashboards/`) — только чтение; MCP никогда не пишет в эту директорию
- 🗂 Кастомные дашборды — `App_Data/Dashboards/`
- 📦 `Options`, `Interactivity`, `Layout` — JSON-в-JSON строки: сервер проверяет, что они декодируются
- ✉️ HTTP API возвращает HTTP 200 даже при ошибке — сервер вскрывает конверт `CommonResponse` (это `<T, ResponseBaseError>`, camelCase/PascalCase — оба)
- ⚠️ Безопасность: пути дашбордов защищены от traversal, `run_tests` запущен без shell, HTTP-режим слушает только `127.0.0.1`

## Быстрый старт

```bash
npm install
npm run build
```

Готово. Для проверки целостности:

```bash
npm run verify          # round-trip всех 10 дефолтных дашбордов-эталонов
node scripts/smoke.cjs  # MCP smoke: initialize, tools/list, tools/call
node scripts/qa.cjs     # полная QA-батарейка: 30 сценариев
```

## Подключение AI-агента

opencode (stdio):

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

Любой MCP-клиент (HTTP):

```json
{ "mcp": { "dashboards-mcp": { "type": "remote", "url": "http://localhost:3456/mcp" } } }
```

## Docker

```bash
docker build -t dashboards-mcp .

# stdio-режим
docker run -i --rm -v <путь>/Dashboards/Dashboards:/data dashboards-mcp

# HTTP-режим
docker run -d --rm -p 3456:3456 \
  -e DASHBOARDS_MCP_HTTP_PORT=3456 \
  -v <путь>/Dashboards/Dashboards:/data \
  dashboards-mcp
```

Или всё сразу через Compose (`docker compose up -d --build`): монтирует `App_Data` в `/data`, поднимает HTTP на `3456`, проксирует `DASHBOARDS_API_URL` на живой BI (`host.docker.internal:8014` — поправьте под свою среду).

## Переменные окружения

| Переменная | Обязательна | Значение |
|---|---|---|
| `DASHBOARDS_ROOT` | да (или авто-поиск) | корень бэкенда с `App_Data/` |
| `DASHBOARDS_API_URL` | нет | базовый URL живого бэкенда |
| `DASHBOARDS_MCP_HTTP_PORT` | нет | включает Streamable HTTP вместо stdio |
| `DASHBOARDS_MCP_HTTP_HOST` | нет | хост HTTP-сервера, по умолчанию `127.0.0.1` |
| `DASHBOARDS_API_TIMEOUT_MS` | нет | таймаут API, по умолчанию `60000` |

## Структура проекта

```
src/
├── index.ts        # точка входа: stdio или streamable HTTP
├── tools.ts        # 14 инструментов MCP
├── schemas.ts      # Zod-схемы + нормализация регистров ключей
├── storage.ts      # файловое хранилище (правила бэкенда)
├── api-client.ts   # HTTP API клиент
├── types.ts        # TypeScript DTO
└── verify.ts       # round-trip верификация
scripts/
├── smoke.cjs       # smoke тест MCP протокола
├── qa.cjs          # QA-батарейка (30 сценариев)
└── spec-smoke.cjs  # проверка spec-тиров (аннотации, structuredContent)
```

## История версий

Смотри [CHANGELOG.md](CHANGELOG.md).

---

Сделано с [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)
