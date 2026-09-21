/** Dictionary keys for the failover-continue plugin card (RU/EN). */
export interface FailoverContinueLocale {
  title: string
  description: string
  loading: string
  unavailable: string
  readOnly: string
  enabled: string
  enabledHint: string
  primaryRoute: string
  primaryHint: string
  fallbacks: string
  fallbacksHint: string
  provider: string
  model: string
  addFallback: string
  remove: string
  moveUp: string
  moveDown: string
  empty: string
  tripCodes: string
  tripCodesHint: string
  thresholds: string
  modelCircuitThreshold: string
  modelCooldownMs: string
  platformCircuitThreshold: string
  platformCooldownMs: string
  burstWindowMs: string
  maxSwitchesPerStep: string
  continueSection: string
  continueText: string
  continueTextHint: string
  retryableErrorPatterns: string
  retryableErrorPatternsHint: string
  continueNumbers: string
  graceMs: string
  cooldownMs: string
  maxConsecutive: string
  scanOnBoot: string
  scanLimit: string
  freshMs: string
  classify: string
  backoffFactor: string
  backoffMaxMs: string
  notify: string
  paused: string
  locale: string
  localeHint: string
  loopGuard: string
  loopShortChars: string
  loopWindowMs: string
  loopShortCount: string
  loopRepeatText: string
  loopToolRepeat: string
  overridden: string
  reset: string
  unsaved: string
  save: string
  saving: string
  saved: string
  discard: string
  invalidNumber: string
  saveFailed: string
  liveNotice: string
}

export const en: FailoverContinueLocale = {
  title: 'Failover + auto-continue',
  description: 'Ordered fallback chain with circuit breaking plus automatic continuation of failed turns. The next request leaves the dead route; the turn continues by itself.',
  loading: 'Loading settings…',
  unavailable: 'This host does not serve the failover-continue settings namespace.',
  readOnly: 'This deployment serves the settings document read-only.',
  enabled: 'Enabled',
  enabledHint: 'Master switch. When off, failures are neither switched nor continued.',
  primaryRoute: 'Current primary',
  primaryHint: 'The session default model. Fallbacks below are only consulted when its circuit is open.',
  fallbacks: 'Fallback routes (ordered)',
  fallbacksHint: 'First healthy route wins. Provider/model values are suggested from the configured model catalog; any reachable route is allowed.',
  provider: 'Provider',
  model: 'Model',
  addFallback: 'Add fallback',
  remove: 'Remove',
  moveUp: 'Move up',
  moveDown: 'Move down',
  empty: 'No fallback routes configured — failures are recorded but never switched.',
  tripCodes: 'Trip codes',
  tripCodesHint: 'Comma-separated failure codes that open a circuit and allow continuing (e.g. RATE_LIMIT, SERVER, TIMEOUT, AUTH, BILLING, QUOTA). AUTH/BILLING switch the route instead of killing the session.',
  thresholds: 'Breaker thresholds',
  modelCircuitThreshold: 'Model failures to open',
  modelCooldownMs: 'Model cooldown (ms)',
  platformCircuitThreshold: 'Open models to trip provider',
  platformCooldownMs: 'Provider cooldown (ms)',
  burstWindowMs: 'Burst window (ms)',
  maxSwitchesPerStep: 'Max switches per step',
  continueSection: 'Auto-continue',
  continueText: 'Continue text',
  continueTextHint: 'Message injected when a failed turn resumes. Placeholders: {code} {message} {status} {tool} {turn} {errorCount}.',
  retryableErrorPatterns: 'Extra retryable patterns',
  retryableErrorPatternsHint: 'One literal per line: message/code fragments that always count as retryable and take precedence over the built-in classification.',
  continueNumbers: 'Continue timing',
  graceMs: 'Grace before resend (ms)',
  cooldownMs: 'Min interval between continues (ms)',
  maxConsecutive: 'Max consecutive continues',
  scanOnBoot: 'Scan interrupted sessions on boot',
  scanLimit: 'Sessions per scan',
  freshMs: 'Interruption freshness window (ms)',
  classify: 'Skip permanent failures',
  backoffFactor: 'Backoff multiplier',
  backoffMaxMs: 'Backoff cap (ms)',
  notify: 'Browser notifications',
  paused: 'Pause auto-continue',
  locale: 'Language',
  localeHint: 'Card + notice language (ru/en). Applies on save.',
  loopGuard: 'Loop guard',
  loopShortChars: 'Short message chars',
  loopWindowMs: 'Loop window (ms)',
  loopShortCount: 'Short messages to trip',
  loopRepeatText: 'Repeated texts to trip',
  loopToolRepeat: 'Repeated tool calls to trip',
  overridden: 'edited',
  reset: 'Reset',
  unsaved: 'unsaved',
  save: 'Save',
  saving: 'Saving…',
  saved: 'Saved — applied immediately (circuits reset).',
  discard: 'Discard',
  invalidNumber: 'Not a valid number',
  saveFailed: 'Save failed. The draft was kept for correction.',
  liveNotice: 'A save applies immediately; open circuits reset. Custom session event types are never written, so logs stay loadable.',
}

export const ru: FailoverContinueLocale = {
  title: 'Фолбэк + автопродолжение',
  description: 'Упорядоченная цепочка резервов с предохранителем плюс автопродолжение упавших тернов. Следующий запрос уходит с мёртвого маршрута, терн продолжается сам.',
  loading: 'Загрузка настроек…',
  unavailable: 'Хост не отдаёт неймспейс настроек failover-continue.',
  readOnly: 'Настройки в этом окружении только для чтения.',
  enabled: 'Включено',
  enabledHint: 'Главный рубильник. Выключено — ни переключений, ни продолжений.',
  primaryRoute: 'Текущий primary',
  primaryHint: 'Дефолтная модель сессии. Резервы ниже используются, только когда её цепь открыта.',
  fallbacks: 'Резервные маршруты (по порядку)',
  fallbacksHint: 'Выигрывает первый здоровый. Значения подсказываются из каталога моделей; подойдёт любой достижимый маршрут.',
  provider: 'Провайдер',
  model: 'Модель',
  addFallback: 'Добавить резерв',
  remove: 'Убрать',
  moveUp: 'Выше',
  moveDown: 'Ниже',
  empty: 'Резервы не заданы — падения только фиксируются, переключений нет.',
  tripCodes: 'Коды срабатывания',
  tripCodesHint: 'Коды ошибок через запятую, открывающие цепь и разрешающие продолжение (например RATE_LIMIT, SERVER, TIMEOUT, AUTH, BILLING, QUOTA). AUTH/BILLING переключают маршрут, а не хоронят сессию.',
  thresholds: 'Пороги предохранителя',
  modelCircuitThreshold: 'Падений до размыкания',
  modelCooldownMs: 'Остывание маршрута (мс)',
  platformCircuitThreshold: 'Открытых моделей до бана провайдера',
  platformCooldownMs: 'Остывание провайдера (мс)',
  burstWindowMs: 'Окно серии (мс)',
  maxSwitchesPerStep: 'Макс. переключений за шаг',
  continueSection: 'Автопродолжение',
  continueText: 'Текст продолжения',
  continueTextHint: 'Сообщение, отправляемое при возобновлении упавшего терна. Плейсхолдеры: {code} {message} {status} {tool} {turn} {errorCount}.',
  retryableErrorPatterns: 'Свои ретраимые паттерны',
  retryableErrorPatternsHint: 'По одному литералу на строку: фрагменты сообщений/кодов, которые всегда считаются ретраимыми и старше встроенной классификации.',
  continueNumbers: 'Тайминги продолжения',
  graceMs: 'Пауза перед отправкой (мс)',
  cooldownMs: 'Мин. интервал между продолжениями (мс)',
  maxConsecutive: 'Макс. продолжений подряд',
  scanOnBoot: 'Сканировать оборванные при старте',
  scanLimit: 'Сессий за один скан',
  freshMs: 'Окно свежести обрыва (мс)',
  classify: 'Пропускать постоянные ошибки',
  backoffFactor: 'Множитель бэкоффа',
  backoffMaxMs: 'Потолок бэкоффа (мс)',
  notify: 'Уведомления браузера',
  paused: 'Пауза автопродолжения',
  locale: 'Язык',
  localeHint: 'Язык карточки и уведомлений (ru/en). Применяется после сохранения.',
  loopGuard: 'Сторож зацикливаний',
  loopShortChars: 'Символов «короткого» сообщения',
  loopWindowMs: 'Окно зацикливания (мс)',
  loopShortCount: 'Коротких подряд до сработки',
  loopRepeatText: 'Повторов текста до сработки',
  loopToolRepeat: 'Повторов tool-вызовов до сработки',
  overridden: 'изменено',
  reset: 'Сбросить',
  unsaved: 'не сохранено',
  save: 'Сохранить',
  saving: 'Сохранение…',
  saved: 'Сохранено — применено сразу (цепи сброшены).',
  discard: 'Отменить',
  invalidNumber: 'Не число',
  saveFailed: 'Не сохранилось, черновик оставлен для правки.',
  liveNotice: 'Сохранение применяется сразу; открытые цепи сбрасываются. Свои типы событий в лог не пишутся — сессии остаются открываемыми.',
}
