<div align="center">

# dashboards-mcp

**MCP-сервер для AI-разработки и тестирования дашбордов [Dispather (Диспетчер)](https://github.com/ibeercan)** — full-stack BI-конструктора и рантайма производственных дашбордов.

[![TypeScript](https://img.shields.io/badge/язык-TypeScript-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Model Context Protocol](https://img.shields.io/badge/протокол-MCP-7c3aed)](https://modelcontextprotocol.io)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Инструментов](https://img.shields.io/badge/инструментов-10-ff69b4)](#что-умеет)

[Русская версия](README.ru.md) | [English](README.md)

</div>

## Обзор

`dashboards-mcp` общается по [Model Context Protocol](https://modelcontextprotocol.io) через **stdio**, поэтому любой MCP-совместимый AI-агент может работать с дашбордами так же, как это делает BI-бэкенд — без UI.

Два варианта источника данных:

| Режим | Источник | Назначение |
|------|--------|---------|
| **Файлы** | `App_Data/` на диске | Повседневная разработка дашбордов |
| **HTTP API** | запущенный бэкенд (`DASHBOARDS_API_URL`) | Интеграционное тестирование живой системы |

## Что умеет

| Инструмент | Описание |
|------|-------------|
| `list_dashboards` | Список всех дашбордов (дефолтные `_default` + пользовательские) |
| `get_dashboard` | Полный JSON дашборда по id (сначала файл, потом API) |
| `create_dashboard` | Создание пользовательского дашборда, ID/коллизии как в бэкенде |
| `update_dashboard` | Обновление существующего пользовательского дашборда |
| `delete_dashboard` | Удаление пользовательского дашборда (`_default` — только чтение) |
| `validate_dashboard` | Zod-схема + вложенный JSON + round-trip |
| `get_component_types` | 17 канонических типов компонентов |
| `validate_layout` | Валидация JSON react-grid-layout |
| `run_tests` | Jest-тесты фронтенда (`FrontendApp`) |
| `export_dashboard` | Форматированный JSON-экспорт |

## Правила предметной области (зеркало бэкенда)

Это не договорённости — это точное поведение `DashboardsFileBaseStorage`:

- 🔑 **ID = `Title.Text` дословно** (без слагификации), расширение `.json`
- 🔁 **Суффикс коллизий `" (N)"`**, уникальность без учёта регистра
- 🔒 **`_default` = только чтение**: дефолтные дашборды в `App_Data/DefaultDashboards/`, при чтении получают суффикс `_default`, сервер туда не пишет
- 📦 **Пользовательские дашборды** — в `App_Data/Dashboards/`
- 🧅 **JSON в JSON**: `Options`, `Interactivity` (и легаси `Layout`) — строки с JSON внутри, парсятся и валидируются как вложенный JSON
- ✉️ **Конверт API**: HTTP-ответы оборачиваются в `CommonResponse<T, ResponseBaseError>` и возвращают **HTTP 200 даже при ошибке** — клиент это распаковывает

## Быстрый старт

```bash
# 1. Установка
npm install

# 2. Сборка
npm run build
```

## Проверка

```bash
npm run verify            # round-trip по всем 10 дефолтным фикстурам
node scripts/smoke.cjs    # smoke-тест MCP-протокола (initialize + tools/list + tools/call)
```

## Подключение AI-агента

Переменные окружения:

| Переменная | Обязательная | Описание |
|----------|-------------|-------------|
| `DASHBOARDS_ROOT` | да (или авто-поиск) | Корень бэкенда, содержащий `App_Data/` |
| `DASHBOARDS_API_URL` | нет | База запущенного бэкенда — включает режим HTTP API |
| `DASHBOARDS_API_TIMEOUT_MS` | нет | Таймаут API, по умолчанию `60000` |

Регистрация в [opencode](https://opencode.ai):

```jsonc
// ~/.config/opencode/opencode.json
{
  "mcp": {
    "dashboards-mcp": {
      "type": "local",
      "command": ["node", "<путь>/mcp-server/dist/index.js"],
      "environment": { "DASHBOARDS_ROOT": "<путь>/Dashboards/Dashboards" }
    }
  }
}
```

## Структура проекта

```
src/
├── index.ts        # Точка входа MCP-сервера (stdio)
├── tools.ts        # 10 MCP-инструментов
├── schemas.ts      # Zod-схемы + нормализация регистра ключей
├── storage.ts      # Файловый провайдер хранилища
├── api-client.ts   # Клиент HTTP API
├── types.ts        # TypeScript-типы DTO
└── verify.ts       # Скрипт round-trip-проверки
scripts/
└── smoke.cjs       # Smoke-тест MCP-протокола
```

## История версий

История изменений — в [`CHANGELOG.md`](CHANGELOG.md).

---

<div align="center">

Сделано с [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)

</div>
