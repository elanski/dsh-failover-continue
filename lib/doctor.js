/**
 * Doctor: scheduled liveness probes of every fallback route.
 *
 * Failures teach the breaker before any session bleeds on the route: a probe
 * failure records like a real one (same holds). An empty-but-alive stream is
 * NOT a failure — liveness is transport health, not generation quality
 * (reasoning models eat small token budgets; see MIN_PROBE_TOKENS lesson).
 *
 * @module dsh-failover-continue/doctor
 */
import { createUserMessage } from '@deepseek-ai/dsh-llm';
/** Pure classification of a probe failure message (unit-tested). */
export function classifyProbeError(message) {
    const text = message;
    if (/\b429\b|rate.?limit/i.test(text))
        return { code: 'RATE_LIMIT', error: text.slice(0, 160) };
    if (/\b(?:401|403)\b|invalid.?api.?key|unauthor|forbidden/i.test(text)) {
        return { code: 'AUTH', error: text.slice(0, 160) };
    }
    if (/quota|insufficient|balance|credit/i.test(text))
        return { code: 'QUOTA', error: text.slice(0, 160) };
    if (/\b5\d\d\b/.test(text))
        return { code: 'SERVER', error: text.slice(0, 160) };
    if (/timeout|timed.?out|econn|socket|fetch failed|network|terminated|premature/i.test(text)) {
        return { code: 'TRANSPORT', error: text.slice(0, 160) };
    }
    return { code: 'PI_AI_ERROR', error: text.slice(0, 160) };
}
/** Probe one route: alive unless the stream errors or the timeout fires. */
export async function probeRoute(llm, route, maxTokens, timeoutMs) {
    const startedAt = Date.now();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), Math.max(1000, timeoutMs));
    try {
        const stream = llm.stream({
            provider: route.provider,
            model: route.model,
            messages: [
                createUserMessage({
                    content: [{ type: 'text', text: 'ping' }],
                    source: { kind: 'plugin', plugin: 'dsh-failover-continue' },
                }),
            ],
            maxTokens: Math.max(1, maxTokens),
            signal: ac.signal,
        });
        for await (const chunk of stream) {
            const raw = chunk;
            if (raw?.type === 'finish' && raw.reason !== undefined
                && raw.reason.kind !== 'stop' && raw.reason.kind !== 'tool-calls'
                && raw.reason.kind !== 'max-tokens') {
                const message = raw.reason.failure?.message ?? `finish: ${raw.reason.kind}`;
                return {
                    provider: route.provider,
                    model: route.model,
                    ok: false,
                    latencyMs: Date.now() - startedAt,
                    ...classifyProbeError(message),
                };
            }
        }
        return { provider: route.provider, model: route.model, ok: true, latencyMs: Date.now() - startedAt };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/abort/i.test(message) && ac.signal.aborted) {
            return {
                provider: route.provider,
                model: route.model,
                ok: false,
                latencyMs: Date.now() - startedAt,
                code: 'TIMEOUT',
                error: `probe timeout after ${timeoutMs}ms`,
            };
        }
        return {
            provider: route.provider,
            model: route.model,
            ok: false,
            latencyMs: Date.now() - startedAt,
            ...classifyProbeError(message),
        };
    }
    finally {
        clearTimeout(timer);
    }
}
