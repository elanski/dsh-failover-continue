import z from '@deepseek-ai/schemastery';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { CircuitBreaker, modelKey, revertDecision } from "./circuit.js";
import { probeRoute } from "./doctor.js";
import { AutoContinueRunner } from "./continue-engine.js";
import { isPolicyRefusal, resolveConfig, } from "./continue-core.js";
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
    modelCooldownMs: z.number().min(0).default(300_000),
    platformCircuitThreshold: z.number().min(1).default(2),
    platformCooldownMs: z.number().min(0).default(120_000),
    burstWindowMs: z.number().min(1).default(900_000),
    maxSwitchesPerStep: z.number().min(1).default(5),
    doctorEnabled: z.boolean().default(true),
    doctorIntervalMs: z.number().min(60_000).default(900_000),
    doctorTimeoutMs: z.number().min(5_000).default(30_000),
    // 1024, not 8: reasoning/bridged models (muse-spark) burn small budgets
    // and answer 400 on crumbs while perfectly alive on real budgets.
    doctorMaxTokens: z.number().min(1).default(1024),
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
        // 5min base: hour holds froze the fleet after short storms (21.09). Real
        // hour-long outages still hold via per-failure Retry-After (recordFailure
        // takes max(cooldown, retryAfterMs)), so a short base loses nothing.
        modelCooldownMs: num(value['modelCooldownMs'], 300_000),
        platformCircuitThreshold: Math.max(1, Math.floor(num(value['platformCircuitThreshold'], 2))),
        platformCooldownMs: num(value['platformCooldownMs'], 120_000),
        burstWindowMs: Math.max(1, num(value['burstWindowMs'], 900_000)),
        maxSwitchesPerStep: Math.max(1, Math.floor(num(value['maxSwitchesPerStep'], 5))),
        doctorEnabled: typeof value['doctorEnabled'] === 'boolean' ? value['doctorEnabled'] : true,
        doctorIntervalMs: Math.max(60_000, num(value['doctorIntervalMs'], 900_000)),
        doctorTimeoutMs: Math.max(5_000, num(value['doctorTimeoutMs'], 30_000)),
        doctorMaxTokens: Math.max(1, Math.floor(num(value['doctorMaxTokens'], 1024))),
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
     * Home = first primary ever seen for the agent in this process. Deliberately
     * NOT the `agent-default-model` namespace: the host overwrites that global
     * on every per-session picker change (session-controller `selectModel` →
     * `saveSelection`), so it is volatile by design and unfit as a revert target.
     */
    const firstSeen = new WeakMap();
    /**
     * Walk trail per agent: targets THIS process assigned, in order. Revert is
     * allowed only while the session still sits on our last assigned target —
     * a manual pick diverges the trail and is never touched afterwards.
     */
    const trail = new WeakMap();
    const currentFallbacks = () => resolved.fallbacks;
    /** Revert target: first-seen primary (see note above). */
    const homeRoute = (agent, primary) => firstSeen.get(agent) ?? primary;
    const continuable = (failure) => {
        if (!resolved.enabled)
            return false;
        if (!resolved.tripCodes.includes(failure.code))
            return false;
        // Policy refusal: healthy route, bad prompt — never a reason to switch.
        if (isPolicyRefusal(failure.message))
            return false;
        // A healthy fallback anywhere means the next request either retries the
        // live primary or walks to a live route — worth continuing either way.
        // All-open chains stop here (stop-loss); maxConsecutive bounds the rest.
        return breaker.hasHealthyFallback(currentFallbacks());
    };
    const getContinueConfig = () => resolved.continue_;
    const runner = new AutoContinueRunner(ctx, getContinueConfig, { continuable });
    // ---- Doctor: scheduled liveness probes ---------------------------------
    let doctorState = { at: 0, results: [] };
    let doctorRunning = false;
    let doctorTimer;
    const runDoctor = async (reason) => {
        if (doctorRunning)
            return;
        const routes = currentFallbacks();
        if (!resolved.enabled || !resolved.doctorEnabled || routes.length === 0)
            return;
        doctorRunning = true;
        try {
            const llm = ctx.llm;
            if (llm === undefined || typeof llm.stream !== 'function') {
                console.warn('[dsh-failover-continue] doctor: llm service unavailable');
                return;
            }
            const results = [];
            for (const route of routes) {
                try {
                    const result = await probeRoute(llm, route, resolved.doctorMaxTokens, resolved.doctorTimeoutMs);
                    results.push(result);
                    if (!result.ok) {
                        const level = breaker.recordFailure(route.provider, route.model);
                        console.warn('[dsh-failover-continue] doctor: %s/%s %s (%s)%s', route.provider, route.model, result.code ?? 'FAIL', result.error ?? '', level !== undefined ? `, circuit ${level}` : '');
                    }
                }
                catch (error) {
                    console.warn('[dsh-failover-continue] doctor: %s/%s probe crashed: %s', route.provider, route.model, String(error));
                }
                await new Promise((resolve) => setTimeout(resolve, 800));
            }
            doctorState = { at: Date.now(), results };
            console.info(`[dsh-failover-continue] doctor finished ${results.length} routes (${reason})`);
        }
        finally {
            doctorRunning = false;
        }
    };
    const scheduleDoctor = () => {
        if (doctorTimer !== undefined)
            clearTimeout(doctorTimer);
        doctorTimer = setTimeout(() => {
            doctorTimer = undefined;
            // Never let a rejection escape: an unhandled rejection kills node.
            void runDoctor('scheduled').then(() => scheduleDoctor(), (error) => {
                console.warn('[dsh-failover-continue] doctor round failed: %s', String(error));
                scheduleDoctor();
            });
        }, resolved.doctorIntervalMs);
        if (typeof doctorTimer.unref === 'function')
            doctorTimer.unref();
    };
    // First round shortly after boot (catches dead routes before sessions do),
    // then on the configured interval. Re-armed on every settings change.
    const bootDoctorTimer = setTimeout(() => {
        void runDoctor('boot').catch((error) => {
            console.warn('[dsh-failover-continue] doctor boot round failed: %s', String(error));
        });
    }, 60_000);
    if (typeof bootDoctorTimer.unref === 'function')
        bootDoctorTimer.unref();
    scheduleDoctor();
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
        scheduleDoctor();
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
            console.info('dsh-failover-continue: settings install deferred: %s', String(error));
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
        // Home is resolved BEFORE firstSeen is recorded: otherwise the fallback
        // poisons itself (firstSeen === primary → home can never differ).
        const home = homeRoute(payload.agent, primary);
        if (!firstSeen.has(payload.agent))
            firstSeen.set(payload.agent, primary);
        // Revert: only while the session still sits exactly where OUR walk put it
        // (trail tail == primary). A manual picker choice diverges the trail and
        // is never touched afterwards.
        const walked = trail.get(payload.agent);
        const trailLast = walked !== undefined && walked.length > 0 ? walked[walked.length - 1] : undefined;
        if (revertDecision({
            primary,
            home,
            trailLast,
            homeOpen: breaker.isOpen(home.provider, home.model),
        })) {
            trail.delete(payload.agent);
            console.warn('[dsh-failover-continue] %s: %s/%s off-home, reverting to %s/%s', payload.agent.id, primary.provider, primary.model, home.provider, home.model);
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
        // Policy refusal: healthy route, bad prompt. Surface it, don't park, don't walk.
        if (isPolicyRefusal(failure.message))
            return downstream;
        const attempt = entriesOf(payload.agent).get(attemptKey(payload.turn, payload.step));
        if (attempt === undefined)
            return downstream;
        const from = attempt.current;
        if (attempt.swaps >= resolved.maxSwitchesPerStep) {
            console.warn('[dsh-failover-continue] %s/%s switch cap (%d) hit, holding route', from.provider, from.model, resolved.maxSwitchesPerStep);
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
            console.warn('[dsh-failover-continue] %s/%s circuit opened (%s) after %s: %s', from.provider, from.model, level, failure.code, failure.message);
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
    function markDiverted(agent, _from, to) {
        void _from;
        const walked = trail.get(agent) ?? [];
        walked.push({ provider: to.provider, model: to.model });
        trail.set(agent, walked);
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
            console.warn('[dsh-failover-continue] switch notice dropped: %s', String(error));
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
            doctor: doctorState,
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
        if (doctorTimer !== undefined)
            clearTimeout(doctorTimer);
        clearTimeout(bootDoctorTimer);
    }, 'dsh-failover-continue: dispose');
}
