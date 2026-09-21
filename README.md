# dsh-failover-continue

[English](#english) | [Русский](#russian)

## English

Unified **auto-continue + model failover** plugin for DeepSeek Harness (DSH).

One plugin owns the whole resilience loop instead of splitting it across an
auto-continue plugin and a failover plugin:

- **Ordered fallback chain** with two-level circuit breaking (model + provider).
  The first failure opens the route (threshold 1); the next request leaves the
  dead route. A provider that reports `Retry-After` (e.g. gateways answering
  "retry in 3594s") is honoured instead of re-hammered after 60s.
- **AUTH and BILLING switch the route instead of killing the session.** A
  401/403 or a billing/check-in 402 opens the failed route and the turn
  continues on the next healthy fallback. Stop-loss fires only when the whole
  chain is open.
- **`CONTEXT_WINDOW_EXCEEDED` is request-scoped**: the oversized request moves
  to a larger-context candidate without parking the healthy route.
- **Automatic continuation of failed turns**: live firehose + cold-session scan
  (survives host restarts: orphaned turns wake up and continue), adaptive
  backoff, loop guard.
- **Safety valves**: `maxSwitchesPerStep` caps walk loops; `maxConsecutive`
  bounds continue storms.
- **Session-log safety by construction**: the plugin never writes custom event
  types (the `Session.append` API cannot carry the `ignorable` envelope
  marker). Switch notices go out as ordinary `user/message` rows; state lives
  in the status route and the settings namespace.
- **Bilingual RU/EN settings card**: every string via locale dictionaries
  (the plugin registers a `ru` language pack — DSH ships only zh/en).

### Install

```sh
dsh plugin --profile web add link:/path/to/dsh-failover-continue
# or: dsh plugin --profile web add github:<you>/dsh-failover-continue
```

Disable the plugins it replaces (exactly one owner per waterfall), migrate
settings, restart the host:

```sh
node scripts/migrate-settings.mjs --apply
```

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- id: auto-continue
  disabled: true
- id: model-failover
  disabled: true
- id: model-failover-settings
  disabled: true
```

### Configuration

Single `failover-continue:` namespace in `settings.yaml`, fully editable from
Settings → Plugins → Failover + auto-continue: ordered `fallbacks`
(provider/model), `tripCodes`, thresholds/cooldowns, continue text/timing,
backoff, loop guard. See `.kiro/specs/failover-continue/` (design repo) for
the full requirements/design/tasks.

### Verify

```sh
npm run typecheck && npm test && npm run build
```

### License

MIT — see [LICENSE](LICENSE). Donor code and ideas are attributed in
[NOTICE.md](NOTICE.md).

---

## Russian

Единый плагин **автопродолжения + фолбэка моделей** для DeepSeek Harness.

Один плагин владеет всем контуром устойчивости вместо связки
«auto-continue + model-failover»:

- **Упорядоченная цепочка резервов** с двухуровневым предохранителем
  (маршрут + провайдер). Первое падение открывает маршрут (порог 1);
  следующий запрос уходит с мёртвого маршрута. `Retry-After` от провайдера
  (например «retry in 3594s») соблюдается, а не забивается повторами.
- **AUTH и BILLING переключают, а не хоронят.** 401/403 или биллинговый 402
  открывают маршрут, терн продолжается на следующем живом резерве. Стоп — лишь
  когда открыта вся цепочка.
- **`CONTEXT_WINDOW_EXCEEDED` — request-scoped**: тяжёлый запрос уходит на
  модель с большим окном без парковки здорового маршрута.
- **Автопродолжение упавших тернов**: живой поток событий + скан холодных
  сессий (переживает рестарты хоста: сессии-«сироты» будятся и продолжаются),
  адаптивный бэкофф, сторож зацикливаний.
- **Предохранители**: `maxSwitchesPerStep` режет петли ходьбы по цепочке,
  `maxConsecutive` — штормы продолжений.
- **Безопасность лога по построению**: своих типов событий не пишем вовсе
  (`Session.append` не умеет маркер `ignorable`). Уведомления — обычными
  `user/message`; состояние — в статус-роуте и неймспейсе настроек.
- **Двуязычная карточка RU/EN**: все строки через словари (плагин
  регистрирует языковой пакет `ru` — в DSH из коробки только zh/en).

### Установка

```sh
dsh plugin --profile web add link:/path/to/dsh-failover-continue
# или: dsh plugin --profile web add github:<you>/dsh-failover-continue
```

Отключить заменяемые плагины (ровно один владелец на waterfall), смигрировать
настройки, перезапустить хост (см. выше). Миграция настроек:

```sh
node scripts/migrate-settings.mjs --apply
```

### Проверка

```sh
npm run typecheck && npm test && npm run build
```

### Лицензия

MIT — см. [LICENSE](LICENSE). Доноры кода и идей — в [NOTICE.md](NOTICE.md).
