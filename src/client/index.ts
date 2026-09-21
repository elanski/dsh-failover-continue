/**
 * Browser half of dsh-failover-continue.
 *
 * Registers the unified plugin card inside Settings → Plugins → Plugin
 * configuration, keyed by the `failover-continue` settings namespace the host
 * half serves. Provider/model suggestions come from the read-only `llm-pi-ai`
 * catalog scope; the primary line mirrors `agent-default-model`.
 * Bilingual RU/EN: registers the `ru` language pack (fallback `en`) and both
 * dictionaries — DSH ships only zh/en out of the box.
 *
 * @module dsh-failover-continue/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the `ctx.settingsScope` service and the settings slot
// contract (`settings.plugin.item`) into this program.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
// Type-only: pulls `ctx.locale` and LocaleNamespaceMap into this program.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { FailoverContinueCardModel, FailoverContinueCard } from './FailoverContinueCard.tsx'
import type { CardActions } from './FailoverContinueCard.tsx'
import { en, ru, type FailoverContinueLocale } from './locales.ts'
import { PLUGIN_VERSION } from './version.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.dshFailoverContinue': keyof FailoverContinueLocale
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.dshFailoverContinue'
/** Settings namespace the host half serves; the card is dispatched by this key. */
const SETTINGS_NS = 'failover-continue'
/** Read-only catalog scope: provider/model suggestions for fallback rows. */
const CATALOG_NS = 'llm-pi-ai'
/** Read-only scope naming the session's starting route. */
const PRIMARY_NS = 'agent-default-model'

/** Services required by this browser plugin. */
export const inject = ['slots', 'locale', 'settingsScope']

/**
 * Register the unified card under Settings → Plugins.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  console.info(`[dsh-failover-continue] client ${PLUGIN_VERSION}`);
  try {
    const localeApi = ctx.locale as unknown as {
      addLanguage?: (input: { id: string; label: string; fallback: string }) => () => void;
    };
    localeApi.addLanguage?.({ id: 'ru', label: 'Русский', fallback: 'en' });
  } catch {
    // Older locale runtime: the ru dictionary still registers below and the
    // card falls back to English copy.
  }
  try {
  // The rc type surface only knows en|zh; `ru` becomes valid at runtime via
  // addLanguage() above (live hosts accept it). Cast keeps one build portable.
  ctx.effect(
    () => ctx.locale.register(NS, { ru, en } as never),
    'dsh-failover-continue: dictionaries',
  )

  const scope = ctx.settingsScope.bind({ namespace: SETTINGS_NS })
  const catalog = ctx.settingsScope.bind({ namespace: CATALOG_NS })
  const primary = ctx.settingsScope.bind({ namespace: PRIMARY_NS })
  const model = new FailoverContinueCardModel(scope, catalog, primary)

  // The card's actions are direct props; binding them to the model keeps the
  // component free of any write path of its own.
  const actions: CardActions = {
    toggle: (field, value) => model.toggle(field, value),
    editNumber: (field, text) => model.editNumber(field, text),
    editText: (field, text) => model.editText(field, text),
    editFallback: (index, patch) => model.editFallback(index, patch),
    addFallback: () => model.addFallback(),
    removeFallback: (index) => model.removeFallback(index),
    moveFallback: (index, delta) => model.moveFallback(index, delta),
    editTripCodes: (text) => model.editTripCodes(text),
    resetField: (field) => model.resetField(field),
    save: () => void model.save(),
    discard: () => model.discard(),
  }

  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: SETTINGS_NS,
    locale: NS,
    // `hooks.card` reaches the component as the `useCard` prop.
    inject: () => ({ hooks: { card: model.store }, ...actions }),
  }, FailoverContinueCard))
  } catch (error) {
    // Never break the settings page: report to the browser console instead.
    console.error(
      '[dsh-failover-continue] card registration failed:',
      error instanceof Error ? error.message : String(error),
    );
  }
}
