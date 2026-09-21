import z from '@deepseek-ai/schemastery';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { CircuitBreaker, modelKey } from "./circuit.js";
import { AutoContinueRunner } from "./continue-engine.js";
import { resolveConfig, } from "./continue-core.js";
export const name = 'dsh-failover-continue';
export const inject = ['settings', 'agents', 'llm'];
/** Settings namespace owned by this plugin (single source of truth). */
export const SETTINGS_NS = 'failover-continue';
/** Failure codes that may trigger a route switch (any harness code allowed). */
export const DEFAULT_TRIP_CODES = [
    'RATE_LIMIT',
    'SERVER',
    'TIMEOUT',
    'TRANSPORT',
    'QUOTA',
    'EMPTY_RESPONSE',
    'AUTH',
    'INVALID_CREDENTIAL',
    'BILLING',
    'BILLING_ERROR',
    'PI_AI_ERROR',
    'INVALID_REQUEST',
    'CONTEXT_WINDOW_EXCEEDED',
];
/** Request-scoped code: the request (not the route) is at fault — switch without cooldown. */
const REQUEST_SCOPED_CODE = 'CONTEXT_WINDOW_EXCEEDED';
const routeSchema = z.object({
    provider: z.string().required(),
    model: z.string().required(),
});
/** Unified schema: continue knobs + breaker knobs in one namespace. */
export const Config = z.object({
    enabled: z.boolean().default(true),
    locale: z.string().default('ru'),
    continueText: z.string().default(''),
    graceMs: z.number().min(0).default(3000),
    cooldownMs: z.number().min(0).default(20000),
    maxConsecutive: z.number().min(1).default(10),
    scanOnBoot: z.boolean().default(true),
    scanLimit: z.number().min(1).default(20),
    freshMs: z.number().min(0).default(24 * 60 * 60 * 1000),
    verbose: z.boolean().default(true),
    classify: z.boolean().default(true),
    retryableErrorPatterns: z.string().default(''),
    backoffFactor: z.number().min(1).default(2),
    backoffMaxMs: z.number().min(0).default(900000),
    idleWatchWorkspaces: z.string().default(''),
    idleNudgeText: z.string().default(''),
    idleNudgeAfterMs: z.number().min(0).default(15 * 60 * 1000),
    idleNudgePerDay: z.number().min(1).default(48),
    notify: z.boolean().default(false),
    paused: z.boolean().default(false),
    loopGuard: z.boolean().default(true),
    loopShortChars: z.number().min(1).default(40),
    loopWindowMs: z.number().min(1000).default(30000),
    loopShortCount: z.number().min(2).default(12),
    loopRepeatText: z.number().min(2).default(4),
    loopToolRepeat: z.number().min(2).default(5),
    loopText: z.string().default(''),
    fallbacks: z.array(routeSchema).default([]),
    tripCodes: z.array(z.string()).default([...DEFAULT_TRIP_CODES]),
    modelCircuitThreshold: z.number().min(1).default(1),
    modelCooldownMs: z.number().min(0).default(3_600_000),
    platformCircuitThreshold: z.number().min(1).default(2),
    platformCooldownMs: z.number().min(0).default(120_000),
    burstWindowMs: z.number().min(1).default(900_000),
    maxSwitchesPerStep: z.number().min(1).default(5),
});
function num(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}
export function resolveFullConfig(section) {
    const value = section ?? {};
    const fallbacks = Array.isArray(value['fallbacks'])
        ? value['fallbacks'].flatMap((entry) => {
            if (typeof entry !== 'object' || entry === null)
                return [];
            const record = entry;
            if (typeof record['provider'] !== 'string' || typeof record['model'] !== 'string')
                return [];
            if (record['provider'].trim() === '' || record['model'].trim() === '')
                return [];
            return [{ provider: record['provider'], model: record['model'] }];
        })
        : [];
    const tripCodes = Array.isArray(value['tripCodes'])
        ? value['tripCodes'].flatMap((code) => typeof code === 'string' && code.trim() !== '' ? [code] : [])
        : [...DEFAULT_TRIP_CODES];
    const continue_ = resolveConfig({
        ...value,
        paused: (typeof value['paused'] === 'boolean' ? value['paused'] : false)
            || !(typeof value['enabled'] === 'boolean' ? value['enabled'] : true),
    });
    const enabled = typeof value['enabled'] === 'boolean' ? value['enabled'] : true;
    return {
        continue_,
        enabled,
        fallbacks,
        tripCodes: tripCodes.length === 0 ? [...DEFAULT_TRIP_CODES] : tripCodes,
        modelCircuitThreshold: Math.max(1, Math.floor(num(value['modelCircuitThreshold'], 1))),
        modelCooldownMs: num(value['modelCooldownMs'], 3_600_000),
        platformCircuitThreshold: Math.max(1, Math.floor(num(value['platformCircuitThreshold'], 2))),
        platformCooldownMs: num(value['platformCooldownMs'], 120_000),
        burstWindowMs: Math.max(1, num(value['burstWindowMs'], 900_000)),
        maxSwitchesPerStep: Math.max(1, Math.floor(num(value['maxSwitchesPerStep'], 5))),
    };
}
function attemptKey(turn, step) {
    return `${turn}/${step}`;
}
const SWITCH_NOTICE = {
    ru: (from, to) => `⚠️ Маршрут недоступен: ${from.provider}/${from.model} — переключено на ${to.provider}/${to.model}`,
    en: (from, to) => `⚠️ Route unavailable: ${from.provider}/${from.model} — switched to ${to.provider}/${to.model}`,
};
function noticeLocale(locale) {
    return locale === 'ru' ? 'ru' : 'en';
}
function writeJson(res, status, body) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'referrer-policy': 'no-referrer' });
    res.end(JSON.stringify(body));
}
function settingsService(ctx) {
    try {
        const svc = ctx.settings;
        if (svc === undefined || svc === null)
            return undefined;
        return svc;
    }
    catch {
        return undefined;
    }
}
/**
 * Register the unified resilience loop.
 */
export function apply(ctx, entry = {}) {
    let resolved = resolveFullConfig(entry);
    let breaker = new CircuitBreaker({
        modelCircuitThreshold: resolved.modelCircuitThreshold,
        modelCooldownMs: resolved.modelCooldownMs,
        platformCircuitThreshold: resolved.platformCircuitThreshold,
        platformCooldownMs: resolved.platformCooldownMs,
        burstWindowMs: resolved.burstWindowMs,
    });
    const attempts = new WeakMap();
    /**
     * One-shot revert tickets. A session I divert (or one found off-home) gets
     * a single automatic trip home once home is healthy; then the ticket is
     * spent, so deliberate manual picks are fought at most once per diversion.
     * In-memory by design: a stale ticket must never outlive the process that
     * saw the diversion.
     */
    const reverted = new WeakSet();
    const currentFallbacks = () => resolved.fallbacks;
    /** Session default route (revert target). Falls back to first-seen primary. */
    const homeRoute = (agent, primary) => {
        try {
            const svc = settingsService(ctx);
            const home = svc?.get?.('agent-default-model');
            if (typeof home?.provider === 'string' && typeof home?.model === 'string'
                && home.provider !== '' && home.model !== '') {
                return { provider: home.provider, model: home.model };
            }
        }
        catch {
            // fall through to first-seen primary
        }
        void agent;
        return primary;
    };
    const continuable = (failure) => {
        if (!resolved.enabled)
            return false;
        if (!resolved.tripCodes.includes(failure.code))
            return false;
        // A healthy fallback anywhere means the next request either retries the
        // live primary or walks to a live route — worth continuing either way.
        // All-open chains stop here (stop-loss); maxConsecutive bounds the rest.
        return breaker.hasHealthyFallback(currentFallbacks());
    };
    const getContinueConfig = () => resolved.continue_;
    const runner = new AutoContinueRunner(ctx, getContinueConfig, { continuable });
    let rawSource = () => entry;
    const currentRaw = () => rawSource();
    const refresh = () => {
        resolved = resolveFullConfig(currentRaw());
        // New tuning starts with a clean slate (same contract as the old
        // fiber.update reset): a reordered chain must not inherit stale holds.
        breaker = new CircuitBreaker({
            modelCircuitThreshold: resolved.modelCircuitThreshold,
            modelCooldownMs: resolved.modelCooldownMs,
            platformCircuitThreshold: resolved.platformCircuitThreshold,
            platformCooldownMs: resolved.platformCooldownMs,
            burstWindowMs: resolved.burstWindowMs,
        });
    };
    let settingsInstalled = false;
    let attached = false;
    const onSettingsChange = () => {
        if (!attached) {
            attached = true;
            return;
        }
        refresh();
    };
    const installSettings = () => {
        if (settingsInstalled)
            return true;
        const svc = settingsService(ctx);
        if (svc === undefined)
            return false;
        try {
            if (typeof svc.installSection === 'function') {
                svc.installSection(ctx, SETTINGS_NS, Config, entry, {
                    setSource: (source) => {
                        rawSource = source;
                        refresh();
                    },
                    onChange: onSettingsChange,
                });
                settingsInstalled = true;
                return true;
            }
            if (typeof svc.register === 'function') {
                const scope = svc.register(SETTINGS_NS, Config, { base: entry });
                rawSource = () => scope.get() ?? entry;
                scope.watch(() => onSettingsChange());
                refresh();
                settingsInstalled = true;
                return true;
            }
        }
        catch (error) {
            ctx.logger.debug('dsh-failover-continue: settings install deferred: %s', String(error));
        }
        return false;
    };
    installSettings();
    // The settings provider may activate after this plugin: poll briefly until
    // the namespace sticks, then stop. Mirrors the self-healing pattern other
    // plugins use for late services.
    const settingsTimer = setInterval(() => {
        if (installSettings() && settingsTimer !== undefined)
            clearInterval(settingsTimer);
    }, 2000);
    if (typeof settingsTimer.unref === 'function')
        settingsTimer.unref();
    ctx.effect(() => () => clearInterval(settingsTimer));
    const pickTarget = (primary, attempt) => {
        const skip = attempt?.skip;
        if (!breaker.isOpen(primary.provider, primary.model) && !skip?.has(modelKey(primary.provider, primary.model))) {
            return primary;
        }
        for (const fallback of currentFallbacks()) {
            const key = modelKey(fallback.provider, fallback.model);
            if (!breaker.isOpen(fallback.provider, fallback.model) && !skip?.has(key))
                return fallback;
        }
        return primary;
    };
    const entriesOf = (agent) => {
        let entries = attempts.get(agent);
        if (entries === undefined) {
            entries = new Map();
            attempts.set(agent, entries);
        }
        return entries;
    };
    const modelWindow = (provider, model) => {
        try {
            const llm = ctx.llm;
            const info = llm?.resolveModelInfo?.(provider, model);
            const window = info?.context?.contextWindow ?? info?.contextWindow;
            return typeof window === 'number' && Number.isFinite(window) && window > 0 ? window : undefined;
        }
        catch {
            return undefined;
        }
    };
    ctx.on('agent/request', async (payload, next) => {
        const base = await next();
        if (!resolved.enabled || resolved.fallbacks.length === 0)
            return base;
        const primary = { provider: base.provider, model: base.model };
        const home = homeRoute(payload.agent, primary);
        const homeKey = modelKey(home.provider, home.model);
        const primaryKey = modelKey(primary.provider, primary.model);
        // Revert: anyone sitting off-home (failover leftover, pre-restart
        // diversion, last-resort camper) goes home as soon as home is healthy —
        // once per diversion, so manual picker choices are never fought twice.
        // The ticket is re-armed every time the breaker diverts (markDiverted).
        if (homeKey !== primaryKey && !breaker.isOpen(home.provider, home.model) && !reverted.has(payload.agent)) {
            reverted.add(payload.agent);
            ctx.logger.warn('[dsh-failover-continue] %s: %s/%s off-home, reverting to %s/%s', payload.agent.id, primary.provider, primary.model, home.provider, home.model);
            notifySwitch(payload.agent, primary, home);
            const { reasoningEffort, ...rest } = base;
            void reasoningEffort;
            return { ...rest, provider: home.provider, model: home.model };
        }
        const entries = entriesOf(payload.agent);
        const key = attemptKey(payload.turn, payload.step);
        let attempt = entries.get(key);
        if (attempt === undefined) {
            attempt = { current: primary, swaps: 0, skip: new Set() };
            entries.set(key, attempt);
        }
        const target = pickTarget(primary, attempt);
        attempt.current = target;
        if (target.provider === base.provider && target.model === base.model)
            return base;
        const { reasoningEffort, ...rest } = base;
        void reasoningEffort;
        return { ...rest, provider: target.provider, model: target.model };
    });
    ctx.on('agent/turn-stopping', (payload) => {
        const entries = attempts.get(payload.agent);
        if (entries === undefined)
            return;
        for (const entryKey of [...entries.keys()]) {
            if (entryKey.startsWith(`${payload.turn}/`))
                entries.delete(entryKey);
        }
    });
    ctx.on('agent/request-error', async (payload, next) => {
        const downstream = await next();
        // The provider-owned llm-retry keeps precedence: only failures that
        // escape it reach the walk.
        if (downstream?.kind === 'retry')
            return downstream;
        if (!resolved.enabled)
            return downstream;
        const failure = payload.failure;
        if (!resolved.tripCodes.includes(failure.code))
            return downstream;
        const attempt = entriesOf(payload.agent).get(attemptKey(payload.turn, payload.step));
        if (attempt === undefined)
            return downstream;
        const from = attempt.current;
        if (attempt.swaps >= resolved.maxSwitchesPerStep) {
            ctx.logger.warn('[dsh-failover-continue] %s/%s switch cap (%d) hit, holding route', from.provider, from.model, resolved.maxSwitchesPerStep);
            return downstream;
        }
        if (failure.code === REQUEST_SCOPED_CODE) {
            // Oversized request, healthy route: skip for this step only, no cooldown.
            attempt.skip.add(modelKey(from.provider, from.model));
            const fromWindow = modelWindow(from.provider, from.model);
            const to = currentFallbacks().find((candidate) => {
                if (candidate.provider === from.provider && candidate.model === from.model)
                    return false;
                if (attempt.skip.has(modelKey(candidate.provider, candidate.model)))
                    return false;
                if (breaker.isOpen(candidate.provider, candidate.model))
                    return false;
                const candidateWindow = modelWindow(candidate.provider, candidate.model);
                if (fromWindow !== undefined && candidateWindow !== undefined && candidateWindow <= fromWindow)
                    return false;
                return true;
            });
            if (to === undefined)
                return downstream;
            attempt.swaps += 1;
            attempt.current = to;
            markDiverted(payload.agent, from, to);
            notifySwitch(payload.agent, from, to);
            return { kind: 'retry' };
        }
        const level = breaker.recordFailure(from.provider, from.model, failure.providerRetryAfterMs);
        if (level !== undefined) {
            ctx.logger.warn('[dsh-failover-continue] %s/%s circuit opened (%s) after %s: %s', from.provider, from.model, level, failure.code, failure.message);
        }
        attempt.skip.add(modelKey(from.provider, from.model));
        const to = pickTarget({ provider: from.provider, model: from.model }, attempt);
        if (to.provider === from.provider && to.model === from.model)
            return downstream;
        attempt.swaps += 1;
        attempt.current = to;
        markDiverted(payload.agent, from, to);
        notifySwitch(payload.agent, from, to);
        return { kind: 'retry' };
    });
    function markDiverted(agent, from, to) {
        const home = homeRoute(agent, from);
        if (modelKey(to.provider, to.model) !== modelKey(home.provider, home.model)) {
            // Fresh diversion re-arms the one-shot trip home.
            reverted.delete(agent);
        }
    }
    function notifySwitch(agent, from, to) {
        try {
            const text = SWITCH_NOTICE[noticeLocale(resolved.continue_.locale)](from, to);
            agent.session.append('user/message', createUserMessage({
                content: [{ type: 'text', text }],
                source: { kind: 'plugin', plugin: 'dsh-failover-continue' },
            }), { surfaceOp: 'append' });
        }
        catch (error) {
            ctx.logger.warn('[dsh-failover-continue] switch notice dropped: %s', String(error));
        }
    }
    // Status bridge (read-only): breaker health + continue stats for the card.
    const sseClients = new Set();
    const pushState = () => {
        const payload = `data: ${JSON.stringify({ type: 'state', state: snapshot() })}\n\n`;
        for (const send of sseClients) {
            try {
                send(payload);
            }
            catch {
                sseClients.delete(send);
            }
        }
    };
    const snapshot = () => {
        const now = Date.now();
        return {
            enabled: resolved.enabled,
            fallbacks: currentFallbacks(),
            tripCodes: resolved.tripCodes,
            health: currentFallbacks().map((route) => ({
                provider: route.provider,
                model: route.model,
                open: breaker.isOpen(route.provider, route.model),
                openUntil: breaker.openUntil(route.provider, route.model),
                remainingMs: Math.max(0, breaker.openUntil(route.provider, route.model) - now),
            })),
            stats: runner.todayStats(),
            paused: runner.activePauses(),
        };
    };
    runner.subscribeState(() => pushState());
    const registerRoutes = () => {
        let ws;
        try {
            ws = ctx.get('webServer');
        }
        catch {
            ws = undefined;
        }
        if (ws === undefined)
            return;
        const server = ws;
        ctx.effect(() => server.register({
            kind: 'exact',
            path: '/api/failover-continue/status',
            handler: (req, res) => {
                const response = res;
                if (req.method === 'GET') {
                    writeJson(response, 200, { ok: true, data: snapshot() });
                    return;
                }
                writeJson(response, 405, { ok: false, error: 'method not allowed' });
            },
        }), 'dsh-failover-continue: status route');
        ctx.effect(() => server.register({
            kind: 'exact',
            path: '/api/failover-continue-bridge',
            handler: (req, res) => {
                const response = res;
                response.writeHead(200, {
                    'content-type': 'text/event-stream',
                    'cache-control': 'no-cache',
                    connection: 'keep-alive',
                });
                response.write(`data: ${JSON.stringify({ type: 'state', state: snapshot() })}\n\n`);
                const send = (data) => response.write(data);
                sseClients.add(send);
                req.on('close', () => sseClients.delete(send));
            },
        }), 'dsh-failover-continue: bridge');
        ctx.effect(() => server.register({
            kind: 'exact',
            path: '/api/failover-continue-action',
            handler: (req, res) => {
                const response = res;
                let body = '';
                req.on('data', (chunk) => {
                    body += String(chunk);
                    if (body.length > 4096)
                        req.destroy();
                });
                req.on('end', () => {
                    try {
                        const parsed = JSON.parse(body);
                        if (typeof parsed.action === 'string') {
                            runner.handleNoticeAction(parsed.sessionId ?? undefined, parsed.action);
                            writeJson(response, 200, { ok: true });
                            return;
                        }
                        writeJson(response, 400, { ok: false });
                    }
                    catch {
                        writeJson(response, 400, { ok: false });
                    }
                });
            },
        }), 'dsh-failover-continue: actions');
    };
    registerRoutes();
    ctx.effect(() => () => {
        runner.dispose();
        sseClients.clear();
    }, 'dsh-failover-continue: dispose');
}
