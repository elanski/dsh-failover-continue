/** Locale-owned defaults for the user-editable text fields. */
export const LOCALIZED_TEXT_DEFAULTS = {
    ru: {
        continueText: 'продолжи',
        continueTextMaxTokens: 'продолжи',
        idleNudgeText: 'работай',
        guardPendingText: '(Предыдущий инструмент «{tool}» мог не завершиться: проверь его состояние и не запускай снова)',
        guardDoneText: '(Предыдущий инструмент «{tool}» уже выполнен, результат: {result}; не запускай снова, продолжай дальше)',
        loopText: '(Похоже, ты зациклился: прекрати повторять последнее действие и продолжи иначе)',
    },
    en: {
        continueText: 'Continue',
        continueTextMaxTokens: 'Continue',
        idleNudgeText: 'keep working',
        guardPendingText: '(The previous tool "{tool}" may not have completed. Check its state before continuing and do not run it again.)',
        guardDoneText: '(The previous tool "{tool}" completed successfully. Result: {result}; do not run it again. Continue from there.)',
        loopText: '(You may be stuck in a loop. Stop repeating the last action and continue with a different approach.)',
    },
};
/** Effective built-in defaults; localized text fields use Russian until a browser locale is mirrored. */
export const DEFAULT_CONFIG = {
    locale: 'ru',
    ...LOCALIZED_TEXT_DEFAULTS.ru,
    guardTools: true,
    graceMs: 3000,
    cooldownMs: 20000,
    // 10, not the donor's 3: with a working fallback chain a storm resolves in
    // 1–2 turns, but an hour-long provider outage needs endurance; stop-loss
    // still fires via maxConsecutive + chain-exhausted checks.
    maxConsecutive: 10,
    scanOnBoot: true,
    // 20 covers a full agent fleet in one pass (donor default 8 missed quiet roles).
    scanLimit: 20,
    // 24h: sessions that died during provider fixes/host restarts must still resume.
    freshMs: 24 * 60 * 60 * 1000,
    verbose: true,
    classify: true,
    retryableErrorPatterns: '',
    backoffFactor: 2,
    // 15min: providers asking "retry in ~1h" need longer than the donor's 5min.
    backoffMaxMs: 900000,
    idleWatchWorkspaces: '',
    idleNudgeAfterMs: 15 * 60 * 1000,
    idleNudgePerDay: 48,
    notify: false,
    paused: false,
    loopGuard: true,
    loopShortChars: 40,
    loopWindowMs: 30000,
    loopShortCount: 12,
    loopRepeatText: 4,
    loopToolRepeat: 5,
};
function numberOr(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}
function booleanOr(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}
/** Resolve a (possibly partial / not-yet-loaded) settings section to a full config. */
export function resolveConfig(section) {
    const value = section ?? {};
    // Schema default is 'ru': an unset locale resolves Russian, explicit 'en' English.
    const locale = value.locale === 'en' ? 'en' : 'ru';
    const localized = LOCALIZED_TEXT_DEFAULTS[locale];
    const text = typeof value.continueText === 'string' && value.continueText.trim() !== ''
        ? value.continueText
        : localized.continueText;
    const maxTokensText = typeof value.continueTextMaxTokens === 'string' && value.continueTextMaxTokens.trim() !== ''
        ? value.continueTextMaxTokens
        : localized.continueTextMaxTokens;
    const guardPendingText = typeof value.guardPendingText === 'string' && value.guardPendingText.trim() !== ''
        ? value.guardPendingText
        : localized.guardPendingText;
    const guardDoneText = typeof value.guardDoneText === 'string' && value.guardDoneText.trim() !== ''
        ? value.guardDoneText
        : localized.guardDoneText;
    return {
        locale,
        continueText: text,
        continueTextMaxTokens: maxTokensText,
        guardTools: booleanOr(value.guardTools, DEFAULT_CONFIG.guardTools),
        guardPendingText,
        guardDoneText,
        graceMs: numberOr(value.graceMs, DEFAULT_CONFIG.graceMs),
        cooldownMs: numberOr(value.cooldownMs, DEFAULT_CONFIG.cooldownMs),
        maxConsecutive: Math.max(1, numberOr(value.maxConsecutive, DEFAULT_CONFIG.maxConsecutive)),
        scanOnBoot: booleanOr(value.scanOnBoot, DEFAULT_CONFIG.scanOnBoot),
        scanLimit: Math.max(1, numberOr(value.scanLimit, DEFAULT_CONFIG.scanLimit)),
        freshMs: numberOr(value.freshMs, DEFAULT_CONFIG.freshMs),
        verbose: booleanOr(value.verbose, DEFAULT_CONFIG.verbose),
        classify: booleanOr(value.classify, DEFAULT_CONFIG.classify),
        retryableErrorPatterns: typeof value.retryableErrorPatterns === 'string'
            ? value.retryableErrorPatterns.trim()
            : DEFAULT_CONFIG.retryableErrorPatterns,
        backoffFactor: Math.max(1, numberOr(value.backoffFactor, DEFAULT_CONFIG.backoffFactor)),
        backoffMaxMs: numberOr(value.backoffMaxMs, DEFAULT_CONFIG.backoffMaxMs),
        idleWatchWorkspaces: typeof value.idleWatchWorkspaces === 'string'
            ? value.idleWatchWorkspaces
            : DEFAULT_CONFIG.idleWatchWorkspaces,
        idleNudgeText: typeof value.idleNudgeText === 'string' && value.idleNudgeText.trim() !== ''
            ? value.idleNudgeText
            : localized.idleNudgeText,
        idleNudgeAfterMs: numberOr(value.idleNudgeAfterMs, DEFAULT_CONFIG.idleNudgeAfterMs),
        idleNudgePerDay: Math.max(1, numberOr(value.idleNudgePerDay, DEFAULT_CONFIG.idleNudgePerDay)),
        notify: booleanOr(value.notify, DEFAULT_CONFIG.notify),
        paused: booleanOr(value.paused, DEFAULT_CONFIG.paused),
        loopGuard: booleanOr(value.loopGuard, DEFAULT_CONFIG.loopGuard),
        loopShortChars: Math.max(1, numberOr(value.loopShortChars, DEFAULT_CONFIG.loopShortChars)),
        loopWindowMs: Math.max(1000, numberOr(value.loopWindowMs, DEFAULT_CONFIG.loopWindowMs)),
        loopShortCount: Math.max(2, numberOr(value.loopShortCount, DEFAULT_CONFIG.loopShortCount)),
        loopRepeatText: Math.max(2, numberOr(value.loopRepeatText, DEFAULT_CONFIG.loopRepeatText)),
        loopToolRepeat: Math.max(2, numberOr(value.loopToolRepeat, DEFAULT_CONFIG.loopToolRepeat)),
        loopText: typeof value.loopText === 'string' && value.loopText.trim() !== ''
            ? value.loopText
            : localized.loopText,
    };
}
export function isNonHumanReason(kind) {
    return kind === 'error' || kind === 'interrupted' || kind === 'max-tokens';
}
/**
 * 错误分类: 该失败是否值得自动继续。
 * 用户填写的 provider 专属文本片段优先覆盖内置结果; 未命中时,
 * 永久性失败(认证/余额/模型不存在/上下文超限等)重试也不会成功, 应跳过并通知用户;
 * 其余(网络、超时、5xx、429 等)视为临时性失败, 允许自动恢复。
 */
export function isTransientFailure(failure, retryableErrorPatterns = '') {
    const haystack = `${failure.code} ${failure.status ?? ''} ${failure.message}`.toLowerCase();
    const explicitlyRetryable = retryableErrorPatterns
        .split(/\r?\n/)
        .map((pattern) => pattern.trim().toLowerCase())
        .filter((pattern) => pattern !== '')
        .some((pattern) => haystack.includes(pattern));
    if (explicitlyRetryable)
        return true;
    const status = failure.status;
    if (status !== undefined && (status === 401 || status === 403))
        return false;
    const permanent = /auth|unauthor|forbidden|credential|api[_-]?key|permission/i.test(haystack) ||
        /insufficient.*(balance|quota)|billing|payment|quota.*exceeded.*(?!retry)/i.test(haystack) ||
        /model.*not[_-]?found|unknown[_-]?model|model[_-]?not[_-]?found|not.*support.*model/i.test(haystack) ||
        /context.*(length|limit|overflow|exceed)|token.*limit|max.*context/i.test(haystack) ||
        /invalid[_-]?request|bad[_-]?request/i.test(haystack);
    return !permanent;
}
/**
 * Content-moderation refusal: the ROUTE is healthy, the PROMPT is not.
 * Retrying elsewhere or parking the route is useless and harmful — surface it.
 */
export function isPolicyRefusal(message) {
    return /violating.{0,30}(usage )?policy|flagged as|potentially violat|moderation|content_policy|content-filter/i.test(message);
}
/**
 * host/agent-error message classification: only clear network/transport
 * transient errors auto-continue; the rest counts as permanent.
 */
export function isTransientAgentError(message) {
    return /network|timeout|timed ?out|econn|etimedout|socket|5\d\d|\b429\b|upstream|temporar/i.test(message);
}
/** 浏览器通知(不可用时静默跳过); 点击通知聚焦窗口, 操作按钮走 onAction。 */
/** 把毫秒格式化为人类可读的经过时长(如 65s → 1m5s)。 */
function formatElapsed(ms) {
    if (ms === undefined || !Number.isFinite(ms) || ms < 0)
        return '';
    if (ms < 1000)
        return `${Math.round(ms)}ms`;
    const s = Math.round(ms / 1000);
    if (s < 60)
        return `${s}s`;
    return `${Math.floor(s / 60)}m${s % 60 > 0 ? `${s % 60}s` : ''}`;
}
/** 用失败事实与回合信息填充 continueText 模板占位符({code}/{message}/{status}/{tool}/{turn}/{errorCount}/{sessionTitle}/{elapsed}/{result})。 */
export function fillTemplate(template, ctx) {
    return template
        .replace(/\{code\}/g, ctx.facts?.code ?? '')
        .replace(/\{message\}/g, ctx.facts?.message ?? '')
        .replace(/\{status\}/g, ctx.facts?.status !== undefined ? String(ctx.facts.status) : '')
        .replace(/\{tool\}/g, ctx.tool ?? '')
        .replace(/\{turn\}/g, ctx.turn !== undefined ? String(ctx.turn) : '')
        .replace(/\{errorCount\}/g, ctx.errorCount !== undefined ? String(ctx.errorCount) : '')
        .replace(/\{sessionTitle\}/g, ctx.sessionTitle ?? '')
        .replace(/\{elapsed\}/g, formatElapsed(ctx.elapsedMs))
        .replace(/\{result\}/g, ctx.result ?? '');
}
// ---------- 幂等护栏: 上一步工具调用的执行状态 ----------
/** 工具结果摘要的最大长度(护栏模板 {result} 用)。 */
const TOOL_RESULT_CAP = 160;
/**
 * 给 JSON 值生成定长且键顺序无关的稳定指纹。
 *
 * 这里不保存可能很大的工具输出原文；每个字符都会进入两个独立的
 * 32-bit 累加器，再附上字符数，供 loop guard 比较完整的模型可见结果。
 */
function stableFingerprint(value) {
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    let length = 0;
    const feed = (text) => {
        length += text.length;
        for (let i = 0; i < text.length; i += 1) {
            const code = text.charCodeAt(i);
            first = Math.imul(first ^ code, 0x01000193) >>> 0;
            second = Math.imul(second ^ code, 0x85ebca6b) >>> 0;
            second = (second ^ (second >>> 13)) >>> 0;
        }
    };
    const walk = (part) => {
        if (part === null) {
            feed('null');
        }
        else if (Array.isArray(part)) {
            feed('[');
            for (const item of part) {
                walk(item);
                feed(',');
            }
            feed(']');
        }
        else if (typeof part === 'object') {
            feed('{');
            const record = part;
            for (const key of Object.keys(record).sort()) {
                feed(JSON.stringify(key));
                feed(':');
                walk(record[key]);
                feed(',');
            }
            feed('}');
        }
        else {
            feed(`${typeof part}:${JSON.stringify(part) ?? String(part)}`);
        }
    };
    walk(value);
    return `${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}:${length}`;
}
/** 从任意内容块里递归收集文本(结果为模型可见的工具输出)。 */
function extractText(blocks, cap) {
    let out = '';
    const walk = (value) => {
        if (out.length >= cap)
            return;
        if (Array.isArray(value)) {
            for (const item of value)
                walk(item);
            return;
        }
        if (typeof value !== 'object' || value === null)
            return;
        const record = value;
        if (record['type'] === 'text' && typeof record['text'] === 'string') {
            out += record['text'];
            return;
        }
        for (const child of Object.values(record))
            walk(child);
    };
    walk(blocks);
    return out.slice(0, cap);
}
function toolCorrelationKey(data, callId) {
    if (callId === undefined || typeof data.turn !== 'number' || typeof data.step !== 'number') {
        return undefined;
    }
    return JSON.stringify([data.turn, data.step, callId]);
}
function resultBlock(data) {
    return data.message?.content?.find((part) => part.type === 'tool-result');
}
/**
 * 取工具结果的关联 id。新版 DSH 的权威位置是 message.source.callId，
 * 同时接受模型可见 block 上的 toolCallId；两者冲突时宁可忽略，不猜测配对。
 */
export function toolResultCallId(data) {
    if (resultBlock(data) === undefined)
        return undefined;
    const sourceId = data.message?.source?.kind === 'tool' ? data.message.source.callId : undefined;
    const blockId = resultBlock(data)?.toolCallId;
    const source = typeof sourceId === 'string' && sourceId !== '' ? sourceId : undefined;
    const block = typeof blockId === 'string' && blockId !== '' ? blockId : undefined;
    if (source !== undefined && block !== undefined && source !== block)
        return undefined;
    return source ?? block;
}
/** 从 tool/result 事件载荷提取成功与否与文本摘要。 */
export function toolResultFacts(data) {
    const result = resultBlock(data);
    const failed = data.error !== undefined || result?.isError === true;
    return {
        ok: !failed,
        excerpt: extractText(result?.content, TOOL_RESULT_CAP),
        identity: stableFingerprint({ content: result?.content ?? [], isError: failed }),
    };
}
const MAX_PENDING_TOOL_CALLS = 64;
const MAX_SEEN_TOOL_CALL_IDS = 256;
/**
 * 每个会话的工具调用关联器。
 *
 * 集中封装事件关联、step 边界确认、护栏读取与重置。内部按 callId 配对，
 * 乱序结果先缓存、再按调用顺序推进 loop 计数。队列和去重 id 都有硬上限；
 * 超限或载荷无法关联时会打断重复计数，宁可漏报也不误杀健康回合。
 */
export class ToolInvocationTracker {
    pendingById = new Map();
    pendingInOrder = [];
    seenCalls = new Map();
    seenInOrder = [];
    latest;
    run;
    repeatSignal;
    lastEventSeq = -1;
    reset() {
        this.pendingById.clear();
        this.pendingInOrder.length = 0;
        this.seenCalls.clear();
        this.seenInOrder.length = 0;
        this.latest = undefined;
        this.run = undefined;
        this.repeatSignal = undefined;
        this.lastEventSeq = -1;
    }
    /** 新回合边界：清空工具态，同时把重放水位推进到 turn/start。 */
    startTurn(seq) {
        if (!Number.isSafeInteger(seq) || seq < 0 || seq <= this.lastEventSeq)
            return;
        this.reset();
        this.lastEventSeq = seq;
    }
    /** 回合已结束：保留最后一次调用的护栏，丢弃不再可用的 loop 关联态。 */
    resetRepeat() {
        this.pendingById.clear();
        this.pendingInOrder.length = 0;
        this.seenCalls.clear();
        this.seenInOrder.length = 0;
        this.run = undefined;
        this.repeatSignal = undefined;
    }
    recordCall(event) {
        if (!this.acceptEventSeq(event.seq))
            return false;
        this.repeatSignal = undefined;
        const data = event.data;
        if (typeof data.name !== 'string') {
            this.breakCorrelation();
            return true;
        }
        const key = `${data.name}\n${typeof data.arguments === 'string' ? data.arguments : ''}`;
        const callId = typeof data.callId === 'string' && data.callId !== '' ? data.callId : undefined;
        const id = toolCorrelationKey(data, callId);
        if (id === undefined) {
            this.breakCorrelation({
                id: undefined,
                name: data.name,
                key,
                result: undefined,
                resultSeq: undefined,
            });
            return true;
        }
        const seen = this.seenCalls.get(id);
        if (seen !== undefined) {
            // 同 seq 重放已被水位拒绝；更高 seq 复用复合 identity 时不猜测。
            this.breakCorrelation({
                id: undefined,
                name: data.name,
                key,
                result: undefined,
                resultSeq: undefined,
            });
            return true;
        }
        const call = {
            id,
            name: data.name,
            key,
            result: undefined,
            resultSeq: undefined,
        };
        this.latest = call;
        this.pendingById.set(id, call);
        this.pendingInOrder.push(call);
        this.seenCalls.set(id, call);
        this.seenInOrder.push(id);
        this.trim(call);
        return true;
    }
    recordResult(event) {
        if (!this.acceptEventSeq(event.seq))
            return undefined;
        const data = event.data;
        const id = toolCorrelationKey(data, toolResultCallId(data));
        if (id === undefined) {
            this.breakCorrelation(this.latest);
            return undefined;
        }
        const surfaceOp = event.surfaceOp;
        if (typeof surfaceOp === 'object' && surfaceOp !== null) {
            const call = this.seenCalls.get(id);
            if (surfaceOp.start !== surfaceOp.end ||
                call === undefined ||
                call.result === undefined ||
                call.resultSeq !== surfaceOp.start) {
                this.breakCorrelation(this.latest);
                return undefined;
            }
            call.result = toolResultFacts(data);
            call.resultSeq = event.seq;
            // replacement 可由 lossy pruner 产生：更新护栏，但绝不据此创建/增强重复。
            this.breakCorrelation(this.latest);
            return undefined;
        }
        const call = this.pendingById.get(id);
        if (call === undefined) {
            const seen = this.seenCalls.get(id);
            const duplicate = seen?.result;
            const incoming = toolResultFacts(data);
            if (seen !== undefined &&
                duplicate !== undefined &&
                seen.resultSeq === event.seq &&
                duplicate.identity === incoming.identity) {
                return undefined;
            }
            if (seen !== undefined && duplicate !== undefined) {
                // 已完成调用又出现非 replacement 冲突时，旧完成事实也不再可信。
                seen.result = undefined;
                seen.resultSeq = undefined;
            }
            this.breakCorrelation(this.latest);
            return undefined;
        }
        if (call.result !== undefined) {
            const incoming = toolResultFacts(data);
            if (call.resultSeq === event.seq && call.result.identity === incoming.identity) {
                return undefined;
            }
            // 没有 surface replacement 语义却出现第二个冲突结果：关联已不可信。
            call.result = undefined;
            call.resultSeq = undefined;
            this.breakCorrelation(this.latest);
            return undefined;
        }
        call.result = toolResultFacts(data);
        call.resultSeq = event.seq;
        return this.drainCompleted();
    }
    guard() {
        const latest = this.latest;
        if (latest === undefined)
            return { kind: 'none' };
        if (latest.result === undefined)
            return { kind: 'pending', tool: latest.name };
        if (latest.result.ok) {
            return { kind: 'done', tool: latest.name, result: latest.result.excerpt };
        }
        return { kind: 'failed', tool: latest.name };
    }
    lastTool() {
        return this.latest?.name;
    }
    /** 下一模型 step 是稳定边界；此前 replacement/新调用会先清除候选。 */
    confirmRepeatAtStep(seq) {
        if (!this.acceptEventSeq(seq))
            return undefined;
        const signal = this.pendingInOrder.length === 0 ? this.repeatSignal : undefined;
        this.repeatSignal = undefined;
        return signal;
    }
    /** 非工具 surface range replacement（如 compaction summary）同样终止旧工具证据。 */
    recordSurfaceReplacement(seq) {
        if (!this.acceptEventSeq(seq))
            return;
        this.breakCorrelation(this.latest);
    }
    restore(events, untilSeq) {
        this.reset();
        for (const event of events) {
            if (event.seq >= untilSeq)
                continue;
            if (event.type === 'turn/start')
                this.startTurn(event.seq);
            else if (event.type === 'step/start')
                this.confirmRepeatAtStep(event.seq);
            else if (event.type === 'tool/call')
                this.recordCall(event);
            else if (event.type === 'tool/result')
                this.recordResult(event);
            else if ((event.type === 'user/message' || event.type === 'assistant/message') &&
                typeof event.surfaceOp === 'object' &&
                event.surfaceOp !== null) {
                this.recordSurfaceReplacement(event.seq);
            }
        }
    }
    acceptEventSeq(seq) {
        if (!Number.isSafeInteger(seq) || seq < 0) {
            this.breakCorrelation(this.latest);
            return false;
        }
        // session/event 与持久日志都按 seq 单调投递；旧 seq 只能是重放帧。
        if (seq <= this.lastEventSeq)
            return false;
        this.lastEventSeq = seq;
        return true;
    }
    breakCorrelation(latest, preserve) {
        this.pendingById.clear();
        this.pendingInOrder.length = 0;
        this.invalidateRunHistory();
        this.latest = latest;
        if (preserve?.id !== undefined &&
            preserve.result === undefined &&
            this.seenCalls.get(preserve.id) === preserve) {
            this.pendingById.set(preserve.id, preserve);
            this.pendingInOrder.push(preserve);
        }
    }
    invalidateRunHistory() {
        this.run = undefined;
        this.repeatSignal = undefined;
    }
    trim(current) {
        while (this.pendingInOrder.length > MAX_PENDING_TOOL_CALLS) {
            // 只淘汰一个 call 会让其后的乱序结果跨过未知缺口重新拼成 streak。
            this.breakCorrelation(current, current);
        }
        while (this.seenInOrder.length > MAX_SEEN_TOOL_CALL_IDS) {
            const id = this.seenInOrder.shift();
            if (id !== undefined) {
                this.seenCalls.delete(id);
                // 丢失去重证据后不保留旧缓存；单调 seq 会拒绝淘汰项的旧帧重放。
                this.breakCorrelation(current, current);
            }
        }
    }
    drainCompleted() {
        let advanced = false;
        while (this.pendingInOrder[0]?.result !== undefined) {
            const call = this.pendingInOrder.shift();
            if (call === undefined || call.result === undefined)
                break;
            advanced = true;
            if (call.id !== undefined)
                this.pendingById.delete(call.id);
            this.advanceRun(call);
        }
        // 已知并发批次尚未收齐时不提前发信号；末尾结果可能展示真实进展。
        if (!advanced)
            return undefined;
        return this.refreshRepeatSignal();
    }
    advanceRun(call) {
        if (call.result === undefined)
            return;
        if (this.run?.key === call.key && this.run.identity === call.result.identity) {
            this.run.count += 1;
        }
        else {
            this.run = { key: call.key, tool: call.name, identity: call.result.identity, count: 1 };
        }
    }
    refreshRepeatSignal() {
        this.repeatSignal =
            this.pendingInOrder.length === 0 && this.run !== undefined
                ? { tool: this.run.tool, count: this.run.count }
                : undefined;
        return this.repeatSignal;
    }
}
/** 自适应退避: 同一会话连续失败时的有效冷却间隔。 */
export function effectiveCooldown(consecutive, base, factor, max) {
    // consecutive = 已连续自动继续的次数; 第 1 次后开始按 factor 递增
    const multiplier = Math.pow(factor, consecutive);
    return Math.min(Math.max(base, base * multiplier), Math.max(base, max));
}
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export function todayKey() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}
/** 空统计桶。 */
export function emptyDayStats() {
    return { date: todayKey(), sent: 0, skipped: 0, recovered: 0, failed: 0, gaveUp: 0, looped: 0, nudged: 0, byCode: {} };
}
/** Normalize a path for fragment matching (slashes, case). */
function normPath(value) {
    return value.replace(/\\/g, '/').toLowerCase();
}
/**
 * Should a completed-but-silent session be nudged? Pure decision:
 * completed terminal turn, stale enough, workspace allowlisted (non-empty),
 * daily cap unspent. Anything human (abort/block) or unlisted never qualifies.
 */
export function shouldNudgeIdle(input) {
    if (input.openTurn)
        return false;
    if (input.lastEndKind !== 'completed')
        return false;
    if (!(input.idleMs >= input.nudgeAfterMs))
        return false;
    if (!(input.nudgedToday < input.nudgePerDay))
        return false;
    const fragments = input.watchWorkspaces
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== '');
    if (fragments.length === 0)
        return false;
    if (input.workspaceCwd === undefined || input.workspaceCwd === '')
        return false;
    const cwd = normPath(input.workspaceCwd);
    return fragments.some((fragment) => cwd.includes(normPath(fragment)));
}
export const freshState = () => ({
    consecutive: 0,
    lastAttemptAt: 0,
    pendingEchoMessageIds: new Map(),
    pendingTimer: undefined,
    running: undefined,
    queued: 0,
    subagent: false,
    lastFailure: undefined,
    lastFailureAt: 0,
    tools: new ToolInvocationTracker(),
    lastTurn: undefined,
    pendingRecoveryAt: 0,
    shortRun: 0,
    lastShortAt: 0,
    lastAssistantText: '',
    sameTextRun: 0,
    streamTail: '',
    streamLastSegment: '',
    streamRepeatRun: 0,
    loopFired: false,
    loopRetryTimer: undefined,
});
export const RECOVERY_WINDOW_MS = 10 * 60 * 1000;
export const ECHO_WINDOW_MS = 10 * 60 * 1000;
const MAX_PENDING_ECHO_MESSAGE_IDS = 64;
function prunePendingEchoMessageIds(state, now) {
    for (const [messageId, queuedAt] of state.pendingEchoMessageIds) {
        if (now - queuedAt > ECHO_WINDOW_MS)
            state.pendingEchoMessageIds.delete(messageId);
    }
}
/** Track an identified plugin message before handing it to the host queue. */
export function trackPendingEcho(state, messageId) {
    const now = Date.now();
    prunePendingEchoMessageIds(state, now);
    state.pendingEchoMessageIds.set(messageId, now);
    while (state.pendingEchoMessageIds.size > MAX_PENDING_ECHO_MESSAGE_IDS) {
        const oldest = state.pendingEchoMessageIds.keys().next();
        if (oldest.done)
            break;
        state.pendingEchoMessageIds.delete(oldest.value);
    }
}
/** Roll back tracking when the host rejects a queued message. */
export function forgetPendingEcho(state, messageId) {
    state.pendingEchoMessageIds.delete(messageId);
}
/** Match and consume one plugin-owned `user/message` event by stable message ID. */
export function isOurEcho(state, event) {
    if (event.type !== 'user/message')
        return false;
    const message = event.data;
    if (message.source.kind !== 'user')
        return false;
    if (state.pendingEchoMessageIds.size === 0)
        return false;
    const now = Date.now();
    prunePendingEchoMessageIds(state, now);
    return state.pendingEchoMessageIds.delete(message.id);
}
