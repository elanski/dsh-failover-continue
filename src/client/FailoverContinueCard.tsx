/**
 * The `failover-continue` plugin card: an expandable card in Settings → Plugins →
 * Plugin configuration, keyed by the settings namespace the host plugin
 * `dsh-failover-continue` registers. Hand-rolled controls (plain
 * elements + one CSS module), staged drafts, and one atomic revision-fenced
 * save through the browser settings scope, mirroring the built-in card pattern.
 *
 * Ported from `dsh-model-failover-settings` (MIT) and extended with the
 * auto-continue section (ported from `dsh-client-auto-continue`, MIT).
 */
import { useState } from 'react'
import { en, ru, type FailoverContinueLocale } from './locales.ts'
import { PLUGIN_VERSION } from './version.ts'
import styles from './FailoverContinueCard.module.css'

/** One fallback route row in the draft. */
export interface FallbackRoute {
  provider: string
  model: string
}

/** Numeric fields of the breaker half, edited as staged text. */
export const BREAKER_NUMBERS = [
  'modelCircuitThreshold',
  'modelCooldownMs',
  'platformCircuitThreshold',
  'platformCooldownMs',
  'burstWindowMs',
  'maxSwitchesPerStep',
] as const

/** Numeric fields of the auto-continue half, edited as staged text. */
export const CONTINUE_NUMBERS = [
  'graceMs',
  'cooldownMs',
  'maxConsecutive',
  'scanLimit',
  'freshMs',
  'backoffFactor',
  'backoffMaxMs',
  'loopShortChars',
  'loopWindowMs',
  'loopShortCount',
  'loopRepeatText',
  'loopToolRepeat',
] as const

/** All numeric fields. */
export const NUMBER_FIELDS = [...BREAKER_NUMBERS, ...CONTINUE_NUMBERS] as const
export type NumberField = (typeof NUMBER_FIELDS)[number]

/** Boolean fields. */
export const TOGGLE_FIELDS = ['enabled', 'scanOnBoot', 'classify', 'notify', 'paused', 'loopGuard'] as const
export type ToggleField = (typeof TOGGLE_FIELDS)[number]

/** Free-text fields. */
export const TEXT_FIELDS = ['locale', 'continueText', 'retryableErrorPatterns'] as const
export type TextField = (typeof TEXT_FIELDS)[number]

/** The settings section this card edits (resolved host value shape). */
export interface FailoverSection {
  enabled?: boolean
  fallbacks?: FallbackRoute[]
  tripCodes?: string[]
  modelCircuitThreshold?: number
  modelCooldownMs?: number
  platformCircuitThreshold?: number
  platformCooldownMs?: number
  burstWindowMs?: number
  maxSwitchesPerStep?: number
  locale?: string
  continueText?: string
  graceMs?: number
  cooldownMs?: number
  maxConsecutive?: number
  scanOnBoot?: boolean
  scanLimit?: number
  freshMs?: number
  classify?: boolean
  retryableErrorPatterns?: string
  backoffFactor?: number
  backoffMaxMs?: number
  notify?: boolean
  paused?: boolean
  loopGuard?: boolean
  loopShortChars?: number
  loopWindowMs?: number
  loopShortCount?: number
  loopRepeatText?: number
  loopToolRepeat?: number
}

/**
 * Structural face of the browser settings scope
 * (`@deepseek-ai/dsh-client-ui-settings` provides it; typed locally so this
 * package needs no runtime import of it).
 */
export interface SettingsScopeLike {
  getSnapshot(): {
    status: 'loading' | 'ready' | 'unavailable'
    value: unknown
    base: unknown
    user: unknown
    revision: number | undefined
    writable: boolean
    mode: string
  }
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
  unset(field: string): Promise<void>
  /**
   * Atomic revision-fenced write (present on current hosts). When absent
   * (older lines), the model falls back to sequential set/unset.
   */
  mutate?(ops: readonly ({ op: 'set'; path: readonly string[]; value: unknown } | { op: 'unset'; path: readonly string[] })[], expectedRevision?: number): Promise<void>
}

/** Minimal observable the slot runtime bridges to a `use{Name}` prop. */
export interface HostObservableLike<S> {
  getSnapshot(): S
  subscribe(listener: () => void): () => void
}

/** One number field's rendered state. */
interface NumberState {
  text: string
  overridden: boolean
  invalid: boolean
}

/** The card's projection: everything the component renders, derived from the
 *  scopes and the staged draft together. */
export interface CardState {
  available: boolean
  writable: boolean
  dirty: boolean
  invalid: boolean
  saving: boolean
  failed: boolean
  saved: boolean
  toggles: Record<ToggleField, { value: boolean; overridden: boolean }>
  numbers: Record<NumberField, NumberState>
  fallbacks: FallbackRoute[]
  fallbacksOverridden: boolean
  tripCodes: string
  tripCodesOverridden: boolean
  locale: string
  continueText: string
  continueTextOverridden: boolean
  retryableErrorPatterns: string
  retryableErrorPatternsOverridden: boolean
  providers: string[]
  modelsOf: Record<string, string[]>
  primary: string
  baseFallbacksCount: number
}

/** Actions the registration injects as direct props. */
export interface CardActions {
  toggle: (field: ToggleField, value: boolean) => void
  editNumber: (field: NumberField, text: string) => void
  editText: (field: TextField, text: string) => void
  editFallback: (index: number, patch: Partial<FallbackRoute>) => void
  addFallback: () => void
  removeFallback: (index: number) => void
  moveFallback: (index: number, delta: number) => void
  editTripCodes: (text: string) => void
  resetField: (field: keyof FailoverSection) => void
  save: () => void
  discard: () => void
}

type Props = {
  t: (key: keyof FailoverContinueLocale) => string
  useCard: <S>(select: (state: CardState) => S) => S
} & CardActions

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * Draft shape: like the section, except a numeric field may hold the raw text
 * the user typed. Keeping the text is what lets an unparsable entry stay on
 * screen and block the save instead of being silently dropped.
 */
type DraftSection = Omit<Partial<FailoverSection>, NumberField> & {
  [K in NumberField]?: number | string
}

/**
 * The staged-form controller: holds drafts, merges them over the live scope
 * snapshots into a projection, and writes everything as one revision-fenced
 * mutation on save.
 */
export class FailoverContinueCardModel {
  private listeners = new Set<() => void>()
  private snapshot: CardState
  private draft: DraftSection = {}
  private clears = new Set<keyof FailoverSection>()
  private draftRevision: number | undefined
  private saving = false
  private failed = false
  private saved = false

  constructor(
    private readonly scope: SettingsScopeLike,
    private readonly catalog: SettingsScopeLike,
    private readonly primary: SettingsScopeLike,
  ) {
    for (const source of [scope, catalog, primary]) source.subscribe(() => this.publish())
    this.snapshot = this.project()
  }

  /** The HostObservable face the slot runtime turns into `useCard`. */
  readonly store: HostObservableLike<CardState> = {
    getSnapshot: () => this.snapshot,
    subscribe: (listener) => {
      this.listeners.add(listener)
      return () => this.listeners.delete(listener)
    },
  }

  private publish(): void {
    this.snapshot = this.project()
    for (const listener of this.listeners) listener()
  }

  private current(field: keyof FailoverSection): unknown {
    return (this.scope.getSnapshot().value as FailoverSection | undefined)?.[field]
  }

  private baseOf(field: keyof FailoverSection): unknown {
    return (this.scope.getSnapshot().base as FailoverSection | undefined)?.[field]
  }

  private overridden(field: keyof FailoverSection): boolean {
    const user = this.scope.getSnapshot().user
    // `user` is the raw user layer: absent until the scope publishes, and typed
    // as `unknown` because the wire carries arbitrary JSON. `Object.hasOwn`
    // throws on null/undefined, so both are rejected before the check.
    if (user === null || typeof user !== 'object') return false
    return Object.hasOwn(user, field)
  }

  /** Draft value when staged (and not cleared), else the live value. */
  private shown(field: keyof FailoverSection): unknown {
    if (this.clears.has(field)) return this.baseOf(field) ?? this.current(field)
    return field in this.draft ? this.draft[field] : this.current(field)
  }

  private numberText(field: NumberField): string {
    const value = this.shown(field)
    return typeof value === 'number' ? String(value) : ''
  }

  private parseNumber(text: string): number | undefined {
    const trimmed = text.trim()
    if (trimmed === '') return undefined
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  private fallbackRows(): FallbackRoute[] {
    const value = this.shown('fallbacks')
    return Array.isArray(value) ? (value as FallbackRoute[]) : []
  }

  private tripCodesText(): string {
    const value = this.shown('tripCodes')
    return Array.isArray(value) ? value.join(', ') : ''
  }

  private textValue(field: TextField): string {
    const value = this.shown(field)
    return typeof value === 'string' ? value : ''
  }

  private project(): CardState {
    const snap = this.scope.getSnapshot()
    const toggles = {} as CardState['toggles']
    for (const field of TOGGLE_FIELDS) {
      toggles[field] = { value: this.shown(field) === true, overridden: this.overridden(field) }
    }
    const numbers = {} as CardState['numbers']
    let invalid = false
    for (const field of NUMBER_FIELDS) {
      const text = this.numberText(field)
      const staged = !this.clears.has(field) && field in this.draft
      const bad = staged && text.trim() !== '' && this.parseNumber(text) === undefined
      if (bad) invalid = true
      numbers[field] = { text, overridden: this.overridden(field), invalid: bad }
    }
    const rows = this.fallbackRows()
    const stagedFallbacks = !this.clears.has('fallbacks') && 'fallbacks' in this.draft
    if (stagedFallbacks && rows.some(row => row.provider.trim() === '' || row.model.trim() === '')) invalid = true
    const catalogValue = this.catalog.getSnapshot().value as
      | { providers?: Record<string, { models?: Array<{ id?: string }> }> }
      | undefined
    const providers = Object.keys(catalogValue?.providers ?? {})
    const modelsOf: Record<string, string[]> = {}
    for (const provider of providers) {
      modelsOf[provider] = (catalogValue?.providers?.[provider]?.models ?? [])
        .map(model => model.id)
        .filter((id): id is string => typeof id === 'string')
    }
    const primaryValue = this.primary.getSnapshot().value as { provider?: string; model?: string } | undefined
    const dirty = this.clears.size > 0 || Object.keys(this.draft).length > 0
    return {
      available: snap.status === 'ready',
      writable: snap.writable,
      dirty,
      invalid,
      saving: this.saving,
      failed: this.failed,
      saved: this.saved,
      toggles,
      numbers,
      fallbacks: rows,
      fallbacksOverridden: this.overridden('fallbacks'),
      tripCodes: this.tripCodesText(),
      tripCodesOverridden: this.overridden('tripCodes'),
      locale: typeof this.shown('locale') === 'string' && (this.shown('locale') as string).trim() !== ''
        ? (this.shown('locale') as string)
        : 'ru',
      continueText: this.textValue('continueText'),
      continueTextOverridden: this.overridden('continueText'),
      retryableErrorPatterns: this.textValue('retryableErrorPatterns'),
      retryableErrorPatternsOverridden: this.overridden('retryableErrorPatterns'),
      providers,
      modelsOf,
      primary: primaryValue?.provider !== undefined ? `${primaryValue.provider} / ${primaryValue.model ?? '?'}` : '—',
      baseFallbacksCount: Array.isArray(this.baseOf('fallbacks')) ? (this.baseOf('fallbacks') as unknown[]).length : 0,
    }
  }

  /** Snapshot revision the draft started from (fence for the atomic save). */
  private touch(): void {
    if (this.draftRevision === undefined) this.draftRevision = this.scope.getSnapshot().revision
    this.saved = false
    this.failed = false
  }

  // ------------------------------------------------------------- draft edits

  toggle(field: ToggleField, value: boolean): void {
    this.touch()
    this.clears.delete(field)
    this.draft[field] = value
    this.publish()
  }

  editNumber(field: NumberField, text: string): void {
    this.touch()
    const parsed = this.parseNumber(text)
    this.clears.delete(field)
    if (text.trim() === '') this.draft[field] = undefined
    else this.draft[field] = parsed ?? text
    this.publish()
  }

  editText(field: TextField, text: string): void {
    this.touch()
    this.clears.delete(field)
    this.draft[field] = text
    this.publish()
  }

  editFallback(index: number, patch: Partial<FallbackRoute>): void {
    this.touch()
    const rows = [...this.fallbackRows()]
    const row = rows[index]
    if (row === undefined) return
    rows[index] = { ...row, ...patch }
    this.clears.delete('fallbacks')
    this.draft.fallbacks = rows
    this.publish()
  }

  addFallback(): void {
    this.touch()
    this.clears.delete('fallbacks')
    this.draft.fallbacks = [...this.fallbackRows(), { provider: '', model: '' }]
    this.publish()
  }

  removeFallback(index: number): void {
    this.touch()
    this.clears.delete('fallbacks')
    this.draft.fallbacks = this.fallbackRows().filter((_row, rowIdx) => rowIdx !== index)
    this.publish()
  }

  moveFallback(index: number, delta: number): void {
    const rows = [...this.fallbackRows()]
    const target = index + delta
    if (target < 0 || target >= rows.length) return
    this.touch()
    const moved = rows.splice(index, 1)[0]
    if (moved === undefined) return
    rows.splice(target, 0, moved)
    this.clears.delete('fallbacks')
    this.draft.fallbacks = rows
    this.publish()
  }

  editTripCodes(text: string): void {
    this.touch()
    this.clears.delete('tripCodes')
    this.draft.tripCodes = text
      .split(',')
      .map(code => code.trim())
      .filter(code => code.length > 0)
    this.publish()
  }

  /** Stage a clear: saving drops the user override, the field re-inherits. */
  resetField(field: keyof FailoverSection): void {
    this.touch()
    delete this.draft[field]
    this.clears.add(field)
    this.publish()
  }

  discard(): void {
    this.draft = {}
    this.clears.clear()
    this.draftRevision = undefined
    this.failed = false
    this.saved = false
    this.publish()
  }

  // ------------------------------------------------------------------ save

  /** Build the full write plan from the drafts vs the live resolved value. */
  private plan(): { ops: Array<{ op: 'set'; path: string[]; value: unknown } | { op: 'unset'; path: string[] }>; failedParse: boolean } {
    const ops: Array<{ op: 'set'; path: string[]; value: unknown } | { op: 'unset'; path: string[] }> = []
    let failedParse = false
    const fields = new Set<keyof FailoverSection>([...this.clears, ...(Object.keys(this.draft) as Array<keyof FailoverSection>)])
    for (const field of fields) {
      if (this.clears.has(field)) {
        ops.push({ op: 'unset', path: [field] })
        continue
      }
      let next: unknown
      if (field === 'tripCodes') {
        next = this.draft.tripCodes
      }
      else if (field === 'fallbacks') {
        next = (this.draft.fallbacks ?? []).map(row => ({ provider: row.provider.trim(), model: row.model.trim() }))
        if ((next as FallbackRoute[]).some(row => row.provider === '' || row.model === '')) failedParse = true
      }
      else if ((NUMBER_FIELDS as readonly string[]).includes(field)) {
        const staged = this.draft[field]
        const parsed = typeof staged === 'number' ? staged : this.parseNumber(String(staged ?? ''))
        if (parsed === undefined) failedParse = true
        next = parsed
      }
      else {
        next = this.draft[field]
      }
      if (sameJson(next, this.current(field))) continue
      ops.push({ op: 'set', path: [field], value: next })
    }
    return { ops, failedParse }
  }

  async save(): Promise<void> {
    if (this.saving) return
    const { ops, failedParse } = this.plan()
    if (ops.length === 0 || failedParse) return
    this.saving = true
    this.failed = false
    this.saved = false
    this.publish()
    const revision = this.draftRevision ?? this.scope.getSnapshot().revision
    try {
      if (typeof this.scope.mutate === 'function') {
        await this.scope.mutate(ops, revision)
      } else {
        // Older hosts without an atomic fence: apply top-level keys in order.
        for (const op of ops) {
          const key = op.path[0]
          if (key === undefined) continue
          if (op.op === 'unset') await this.scope.unset(key)
          else await this.scope.set(key, op.value)
        }
      }
    } catch {
      // The scope recovers Host state on failure; the read-back below decides.
    }
    // Read-back: the Host is the only authority — a set landed only when the
    // user layer carries it; an unset landed only when the key is gone.
    const user = (this.scope.getSnapshot().user ?? {}) as Record<string, unknown>
    const landed = ops.every((op) => {
      const key = op.path[0]
      if (key === undefined) return false
      if (op.op === 'unset') return !Object.hasOwn(user, key)
      return sameJson(user[key], op.value)
    })
    this.saving = false
    if (landed) {
      this.draft = {}
      this.clears.clear()
      this.draftRevision = undefined
      this.saved = true
    }
    else this.failed = true
    this.publish()
  }
}

/** Per-field row chrome: label, hint, "edited" badge, reset. */
function FieldHead(props: {
  label: string
  hint?: string
  overridden: boolean
  t: Props['t']
  onReset?: () => void
}): JSX.Element {
  return (
    <>
      <span className={styles.label}>{props.label}</span>
      {props.overridden ? (
        <button type="button" className={styles.reset} onClick={props.onReset}>{props.t('reset')}</button>
      ) : null}
      {props.overridden ? <span className={styles.badge}>{props.t('overridden')}</span> : null}
      {props.hint !== undefined ? <p className={styles.hint}>{props.hint}</p> : null}
    </>
  )
}

/**
 * Render the failover-continue card in the Plugin configuration tab.
 *
 * Card language comes from the plugin's own `locale` setting (the selector
 * in the card), NOT from the DSH interface locale: the injected `t` is only
 * used for the pre-settings loading stub.
 */
export function FailoverContinueCard({ t: hostT, useCard, ...actions }: Props) {
  const state = useCard(snapshot => snapshot)
  const [open, setOpen] = useState(true)
  if (!state.available) return <li className={styles.card}><div className={styles.body}>{hostT('loading')}</div></li>
  const dict = state.locale === 'en' ? en : ru
  const t = (key: keyof FailoverContinueLocale): string => dict[key] ?? en[key]
  const disabled = !state.writable || state.saving
  return (
    <li className={styles.card}>
      <button type="button" className={styles.head} onClick={() => setOpen(value => !value)}>
        <span className={styles.headText}>
          <span className={styles.name}>{t('title')}</span>
          <span className={styles.description}>{t('description')}</span>
        </span>
        {state.dirty ? <span className={styles.pending}>{t('unsaved')}</span> : null}
        <span aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        <div className={styles.body}>
          {!state.writable ? <p className={styles.readOnly}>{t('readOnly')}</p> : null}

          <div className={styles.row}>
            <label className={styles.row}>
              <input
                type="checkbox"
                checked={state.toggles.enabled.value}
                disabled={disabled}
                onChange={event => actions.toggle('enabled', event.target.checked)}
              />
              <span className={styles.label}>{t('enabled')}</span>
            </label>
            <p className={styles.hint}>{t('enabledHint')}</p>
          </div>

          <div className={styles.row}>
            <span className={styles.label}>{t('primaryRoute')}: {state.primary}</span>
            <p className={styles.hint}>{t('primaryHint')}</p>
          </div>

          <div className={styles.row}>
            <FieldHead
              label={t('fallbacks')}
              hint={t('fallbacksHint')}
              overridden={state.fallbacksOverridden}
              onReset={() => actions.resetField('fallbacks')}
              t={t}
            />
            {state.fallbacks.length === 0 ? <p className={styles.empty}>{t('empty')}</p> : null}
            <datalist id="fc-providers">
              {state.providers.map(provider => <option key={provider} value={provider} />)}
            </datalist>
            {state.fallbacks.map((row, index) => (
              <div className={styles.route} key={index}>
                <input
                  className={`${styles.input} ${styles.inputMono}`}
                  placeholder={t('provider')}
                  list="fc-providers"
                  value={row.provider}
                  disabled={disabled}
                  onChange={event => actions.editFallback(index, { provider: event.target.value })}
                />
                <input
                  className={`${styles.input} ${styles.inputMono}`}
                  placeholder={t('model')}
                  list={`fc-models-${row.provider}`}
                  value={row.model}
                  disabled={disabled}
                  onChange={event => actions.editFallback(index, { model: event.target.value })}
                />
                <datalist id={`fc-models-${row.provider}`}>
                  {(state.modelsOf[row.provider] ?? []).map(model => <option key={model} value={model} />)}
                </datalist>
                <span className={styles.actions}>
                  <button type="button" className={styles.button} disabled={disabled || index === 0} title={t('moveUp')} onClick={() => actions.moveFallback(index, -1)}>↑</button>
                  <button type="button" className={styles.button} disabled={disabled || index === state.fallbacks.length - 1} title={t('moveDown')} onClick={() => actions.moveFallback(index, 1)}>↓</button>
                  <button type="button" className={styles.button} disabled={disabled} title={t('remove')} onClick={() => actions.removeFallback(index)}>✕</button>
                </span>
              </div>
            ))}
            <button type="button" className={styles.button} disabled={disabled} onClick={actions.addFallback}>+ {t('addFallback')}</button>
          </div>

          <div className={styles.row}>
            <FieldHead
              label={t('tripCodes')}
              hint={t('tripCodesHint')}
              overridden={state.tripCodesOverridden}
              onReset={() => actions.resetField('tripCodes')}
              t={t}
            />
            <input
              className={`${styles.input} ${styles.inputWide} ${styles.inputMono}`}
              value={state.tripCodes}
              disabled={disabled}
              onChange={event => actions.editTripCodes(event.target.value)}
            />
          </div>

          <div className={styles.row}>
            <span className={styles.label}>{t('thresholds')}</span>
            <div className={styles.grid}>
              {BREAKER_NUMBERS.map(field => (
                <label className={styles.gridItem} key={field}>
                  <span>
                    {t(field)}
                    {state.numbers[field].overridden ? <span className={styles.badge}> {t('overridden')}</span> : null}
                    {state.numbers[field].overridden ? (
                      <button type="button" className={styles.reset} onClick={() => actions.resetField(field)}> {t('reset')}</button>
                    ) : null}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={`${styles.input} ${styles.inputMono} ${state.numbers[field].invalid ? styles.invalid : ''}`}
                    value={state.numbers[field].text}
                    disabled={disabled}
                    onChange={event => actions.editNumber(field, event.target.value)}
                  />
                  {state.numbers[field].invalid ? <p className={styles.invalidText}>{t('invalidNumber')}</p> : null}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.label}>{t('continueSection')}</span>
            <label>
              <span className={styles.label}>{t('locale')}: </span>
              <select
                value={state.locale}
                disabled={disabled}
                onChange={event => actions.editText('locale', event.target.value)}
              >
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            </label>
            <p className={styles.hint}>{t('localeHint')}</p>
            <label>
              <input
                type="checkbox"
                checked={state.toggles.scanOnBoot.value}
                disabled={disabled}
                onChange={event => actions.toggle('scanOnBoot', event.target.checked)}
              />
              <span className={styles.label}> {t('scanOnBoot')}</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={state.toggles.classify.value}
                disabled={disabled}
                onChange={event => actions.toggle('classify', event.target.checked)}
              />
              <span className={styles.label}> {t('classify')}</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={state.toggles.notify.value}
                disabled={disabled}
                onChange={event => actions.toggle('notify', event.target.checked)}
              />
              <span className={styles.label}> {t('notify')}</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={state.toggles.paused.value}
                disabled={disabled}
                onChange={event => actions.toggle('paused', event.target.checked)}
              />
              <span className={styles.label}> {t('paused')}</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={state.toggles.loopGuard.value}
                disabled={disabled}
                onChange={event => actions.toggle('loopGuard', event.target.checked)}
              />
              <span className={styles.label}> {t('loopGuard')}</span>
            </label>
          </div>

          <div className={styles.row}>
            <FieldHead
              label={t('continueText')}
              hint={t('continueTextHint')}
              overridden={state.continueTextOverridden}
              onReset={() => actions.resetField('continueText')}
              t={t}
            />
            <input
              className={`${styles.input} ${styles.inputWide}`}
              value={state.continueText}
              disabled={disabled}
              onChange={event => actions.editText('continueText', event.target.value)}
            />
          </div>

          <div className={styles.row}>
            <FieldHead
              label={t('retryableErrorPatterns')}
              hint={t('retryableErrorPatternsHint')}
              overridden={state.retryableErrorPatternsOverridden}
              onReset={() => actions.resetField('retryableErrorPatterns')}
              t={t}
            />
            <input
              className={`${styles.input} ${styles.inputWide} ${styles.inputMono}`}
              value={state.retryableErrorPatterns}
              disabled={disabled}
              onChange={event => actions.editText('retryableErrorPatterns', event.target.value)}
            />
          </div>

          <div className={styles.row}>
            <span className={styles.label}>{t('continueNumbers')}</span>
            <div className={styles.grid}>
              {CONTINUE_NUMBERS.map(field => (
                <label className={styles.gridItem} key={field}>
                  <span>
                    {t(field)}
                    {state.numbers[field].overridden ? <span className={styles.badge}> {t('overridden')}</span> : null}
                    {state.numbers[field].overridden ? (
                      <button type="button" className={styles.reset} onClick={() => actions.resetField(field)}> {t('reset')}</button>
                    ) : null}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={`${styles.input} ${styles.inputMono} ${state.numbers[field].invalid ? styles.invalid : ''}`}
                    value={state.numbers[field].text}
                    disabled={disabled}
                    onChange={event => actions.editNumber(field, event.target.value)}
                  />
                  {state.numbers[field].invalid ? <p className={styles.invalidText}>{t('invalidNumber')}</p> : null}
                </label>
              ))}
            </div>
          </div>

          <p className={styles.footNote}>{t('liveNotice')}</p>
          <p className={styles.footNote}>dsh-failover-continue {PLUGIN_VERSION}</p>
          <div className={styles.footer}>
            {state.failed ? <span className={styles.statusErr} role="alert">{t('saveFailed')}</span> : null}
            {state.saved ? <span className={styles.statusOk} role="status">{t('saved')}</span> : null}
            <button type="button" className={styles.button} disabled={!state.dirty || state.saving} onClick={actions.discard}>{t('discard')}</button>
            <button
              type="button"
              className={`${styles.button} ${styles.primary}`}
              disabled={!state.dirty || state.invalid || state.saving || !state.writable}
              onClick={actions.save}
            >
              {state.saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  )
}
