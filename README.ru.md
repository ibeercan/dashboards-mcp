# dashboards-mcp (RU)

MCP-сервер для AI-разработки и тестирования дашбордов [Dispather (Диспетчер)](../) — full-stack BI-конструктора и рантайма производственных дашбордов.

Позволяет AI-агенту (через [MCP](https://modelcontextprotocol.io)) читать, создавать, редактировать, удалять, валидировать и экспортировать дашборды, а также запускать фронтенд-тесты — как по файловому хранилищу (dev), так и по HTTP API (интеграционное тестирование).

## Инструменты

| Инструмент | Описание |
|------|-------------|
| `list_dashboards` | Список всех дашбордов (дефолтные `_default` + пользовательские) |
| `get_dashboard` | Полный JSON дашборда по id |
| `create_dashboard` | Создание пользовательского дашборда (ID из `Title.Text`, коллизия `" (N)"` — как в бэкенде) |
| `update_dashboard` | Обновление существующего пользовательского дашборда |
| `delete_dashboard` | Удаление пользовательского дашборда (`_default` — только чтение) |
| `validate_dashboard` | Проверка Zod-схемой + вложенный JSON + round-trip |
| `get_component_types` | 17 канонических типов компонентов |
| `validate_layout` | Валидация JSON-строки react-grid-layout |
| `run_tests` | Запуск Jest-тестов фронтенда (`FrontendApp`, пресет jest-puppeteer) |
| `export_dashboard` | Форматированный JSON-экспорт |

## Правила предметной области (зеркало бэкенда)

- ID дашборда = `Title.Text` **дословно** (без слагификации), расширение `.json`, суффикс `" (N)"` при коллизии, уникальность без учёта регистра (`DashboardsFileBaseStorage.GetNewDashboardId`)
- Дефолтные дашборды хранятся в `App_Data/DefaultDashboards/`, при чтении получают суффикс `_default`; только чтение — MCP никогда не пишет в каталог дефолтных
- Пользовательские дашборды — в `App_Data/Dashboards/`
- `Options`, `Interactivity` (и легаси `Layout`) — строки «JSON в JSON»; парсятся и валидируются как вложенный JSON
- HTTP API оборачивает ответы в конверт `CommonResponse<T, ResponseBaseError>` и возвращает HTTP 200 даже при ошибке

## Установка

```bash
npm install
npm run build
```

## Проверка

```bash
npm run verify            # round-trip по всем дефолтным фикстурам
node scripts/smoke.cjs    # smoke-тест MCP-протокола (initialize + tools/list + tools/call)
```

## Конфигурация

Переменные окружения:

| Переменная | Обязательная | Описание |
|----------|-------------|-------------|
| `DASHBOARDS_ROOT` | да (или авто-поиск) | Корень бэкенда, содержащий `App_Data/` |
| `DASHBOARDS_API_URL` | нет | База запущенного бэкенда — включает HTTP API |
| `DASHBOARDS_API_TIMEOUT_MS` | нет | Таймаут API, по умолчанию `60000` |

### Регистрация в opencode

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
