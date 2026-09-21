/**
 * Auto-continue engine — host half core (single instance).
 *
 * Runs inside the dsh host process, so there is exactly ONE engine regardless
 * of how many browser tabs are open — the multi-tab duplicate-send class of
 * bugs (issue #13) cannot exist by construction. Listens to the session event
 * firehose (`session/event`), sends through the agent registry
 * (`agent.followup`), cancels through `agent.cancel`, and reads configuration
 * from the settings service.
 *
 * All behavior is driven by the `auto-continue` settings namespace (see the
 * plugin's settings card); every knob below is user-configurable there.
 */

import type { Context } from '@deepseek-ai/cordis';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session/types';
import type { Session } from '@deepseek-ai/dsh-session';
import {
  RECOVERY_WINDOW_MS,
  effectiveCooldown,
  emptyDayStats,
  fillTemplate,
  forgetPendingEcho,
  freshState,
  isNonHumanReason,
  isOurEcho,
  isTransientFailure,
  shouldNudgeIdle,
  sleep,
  todayKey,
  trackPendingEcho,
  type AutoContinueConfig,
  type AutoContinueLocale,
  type DayStats,
  type FailureFacts,
  type SessionState,
  type NotifyAction,
  type NotifyOptions,
  type ToolRepeatSignal,
} from './continue-core.ts';

const NOTICE_COPY = {
  ru: {
    notContinuedTitle: 'failover-continue: не продолжено',
    permanentErrorBody: (sessionId: SessionId, summary: string) =>
      `${sessionId}: постоянная ошибка ${summary}, нужно вмешательство человека`,
    resumeAction: 'Продолжить сейчас',
    pauseAction: 'Пауза этой сессии на 1 час',
    continuedTitle: 'failover-continue: продолжено автоматически',
    continuedBody: (sessionId: SessionId, text: string, count: number) =>
      `${sessionId}: отправлено «${text}» (подряд №${count})`,
    stoppedTitle: 'failover-continue: автопродолжение остановлено',
    stoppedBody: (sessionId: SessionId, count: number) =>
      `${sessionId}: ${count} провалов подряд, нужно вмешательство человека`,
  },
  en: {
    notContinuedTitle: 'dsh-auto-continue: Not continued',
    permanentErrorBody: (sessionId: SessionId, summary: string) =>
      `${sessionId}: Permanent error ${summary}; manual intervention required`,
    resumeAction: 'Resume now',
    pauseAction: 'Pause this session for 1 hour',
    continuedTitle: 'dsh-auto-continue: Continued automatically',
    continuedBody: (sessionId: SessionId, text: string, count: number) =>
      `${sessionId}: Sent "${text}" (consecutive attempt ${count})`,
    stoppedTitle: 'dsh-auto-continue: Auto-continue stopped',
    stoppedBody: (sessionId: SessionId, count: number) =>
      `${sessionId}: ${count} consecutive failures; manual intervention required`,
  },
} as const satisfies Record<AutoContinueLocale, Record<string, unknown>>;

/** Durable cancel identity reserved for this plugin's loop guard. */
const LOOP_GUARD_CANCEL_CAUSE = {
  kind: 'hook',
  reason: 'dsh-auto-continue:loop-guard',
} as const;

/**
 * 周期重扫间隔。启动扫描只跑一次, 而宿主可能在它之后才把会话 resume 起来;
 * 20s 足够快, 又不会给宿主造成可感知的负担(扫描只读元数据 + 少量历史)。
 */
const RESCAN_INTERVAL_MS = 20_000;
/** 空闲重扫的上限间隔: 长时间没有中断时降到这个频率。 */
const RESCAN_MAX_INTERVAL_MS = 300_000;
/** 同一冷会话两次整读日志的最小间隔: 避免周期扫描反复解压大日志。 */
const COLD_INSPECT_TTL_MS = 60_000;

/** Keep fuzzy matching off the unbounded host event path; exact repeats remain unlimited. */
const STREAM_NEAR_DUPLICATE_MAX_CHARS = 2_048;
/** Bound unfinished text copied between token chunks when a provider emits no paragraph break. */
const STREAM_TAIL_MAX_CHARS = 4_096;

/** 通知桥事件: host 引擎产生, browser 侧订阅展示(Notification / 动作按钮)。 */
export interface HostNotice {
  /** 稳定标识(供 browser 去重)。 */
  id: string;
  title: string;
  body: string;
  /** 会话 id(通知按钮「立即续跑 / 暂停该会话」作用于它)。 */
  sessionId: SessionId;
  actions: NotifyAction[];
  /** 产生时间。 */
  at: number;
}

/** 自动发送后, 在该窗口内出现的回合结束才计入恢复统计。 */

/** Session history APIs across the supported DSH host releases. */
type CompatibleSession = Session & {
  readonly events?: readonly SessionEvent[];
  snapshotEvents?: () => readonly SessionEvent[];
};

/** Read one stable event-log snapshot on both legacy and DSH 0.1.2 hosts. */
function snapshotSessionEvents(session: Session): readonly SessionEvent[] {
  const compatible = session as CompatibleSession;
  if (typeof compatible.snapshotEvents === 'function') return compatible.snapshotEvents();
  if (compatible.events !== undefined) return compatible.events;
  throw new TypeError('session exposes neither snapshotEvents() nor events');
}

/** Interpret host failure payloads without trusting persisted or plugin-provided event shapes. */
function parseFailureFacts(value: unknown): FailureFacts | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const failure = value as { code?: unknown; message?: unknown; status?: unknown };
  const code = typeof failure.code === 'string' && failure.code.trim() !== ''
    ? failure.code
    : undefined;
  const message = typeof failure.message === 'string' && failure.message.trim() !== ''
    ? failure.message
    : undefined;
  const status = typeof failure.status === 'number' && Number.isFinite(failure.status)
    ? failure.status
    : undefined;
  if (code === undefined && message === undefined && status === undefined) return undefined;
  return {
    code: code ?? 'UNKNOWN',
    message: message ?? code ?? `HTTP ${status}`,
    ...(status !== undefined ? { status } : {}),
  };
}

/** Read a reason discriminator defensively because session history can outlive its schema. */
function readReasonKind(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === 'string' && kind.trim() !== '' ? kind : undefined;
}

/**
 * 崩溃孤儿回合: 日志停在 turn/start 之后且没有对应的 turn/end
 * (宿主被强杀时回合来不及收尾)。返回那个未收尾回合的 turn/start seq,
 * 没有孤儿回合时返回 undefined。这类会话在重启后同样是"被中断"。
 */
function openTurnStartSeq(events: readonly SessionEvent[]): number | undefined {
  let lastStart = -1;
  let lastEnd = -1;
  for (const event of events) {
    if (event.type === 'turn/start') lastStart = event.seq;
    else if (event.type === 'turn/end') lastEnd = event.seq;
  }
  return lastStart >= 0 && lastStart > lastEnd ? lastStart : undefined;
}

/**
 * 粗筛: 该会话是否"可能"值得续跑。用于把绝大多数正常结束的会话挡在
 * inspect() 之外 —— inspect 会整读并解压日志, 对每个冷会话都做一遍太贵。
 * 精判(时间窗、是否已被后续消息覆盖、错误是否可重试)仍在扫描循环里。
 */
function looksInterrupted(events: readonly SessionEvent[]): boolean {
  const openTurn = openTurnStartSeq(events) !== undefined;
  if (openTurn) return true;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event === undefined) continue;
    if (event.type === 'turn/end') {
      const kind = readReasonKind(event.data.reason);
      return kind !== undefined && isNonHumanReason(kind);
    }
  }
  return false;
}

function isLoopGuardCancelReason(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const cause = value as { kind?: unknown; reason?: unknown };
  return cause.kind === LOOP_GUARD_CANCEL_CAUSE.kind && cause.reason === LOOP_GUARD_CANCEL_CAUSE.reason;
}

/** Plugin body: single-instance runner with boot/rescan loops. */
export class AutoContinueRunner {
  private readonly states = new Map<SessionId, SessionState>();
  private readonly pauseUntil = new Map<SessionId, number>();
  /** 冷会话最近一次整读日志的时间(节流 inspect)。 */
  private readonly lastInspectAt = new Map<SessionId, number>();
  /** 冷会话的粗筛结论缓存: updatedAt 未变时无需重新读盘。 */
  private readonly coldVerdict = new Map<SessionId, { updatedAt: number; resumable: boolean }>();
  /** Idle nudges sent per session today (daily cap). */
  private readonly idleNudged = new Map<SessionId, { date: string; count: number }>();
  /** Workspace-watch verdicts for cold sessions (avoid re-wake per scan). */
  private readonly watchVerdicts = new Map<SessionId, { updatedAt: number; watched: boolean }>();

  /** Idle nudges sent to one session today (daily cap). */
  private nudgedToday(sessionId: SessionId): number {
    const entry = this.idleNudged.get(sessionId);
    if (entry === undefined || entry.date !== todayKey()) return 0;
    return entry.count;
  }

  /**
   * Idle-watch: completed-but-silent fleet sessions get a nudge so dead
   * loop timers (host restart) don't park the fleet. Human-driven sessions
   * (user message after completion, abort) and unlisted workspaces never
   * qualify. Returns true when a nudge was scheduled.
   */
  private async maybeNudgeIdle(
    candidate: {
      sessionId: SessionId;
      events: readonly SessionEvent[];
      cwd?: string;
      cold?: boolean;
      coldUpdatedAt?: number;
    },
    lastEnd: SessionEvent<'turn/end'>,
    now: number,
    config: AutoContinueConfig,
  ): Promise<boolean> {
    // A user-authored message after the completed turn means a human is
    // driving — never steal their session.
    for (const event of candidate.events) {
      if (event.seq <= lastEnd.seq) continue;
      if (event.type !== 'user/message') continue;
      const source = (event.data as { source?: { kind?: unknown } } | undefined)?.source;
      if (source !== undefined && source.kind === 'user') return false;
    }
    // Workspace gate: live sessions read header.cwd free; cold ones resolve
    // the agent once per log revision (verdict cached, negative included).
    let cwd = candidate.cwd;
    if (cwd === undefined && candidate.cold === true) {
      const cached = this.watchVerdicts.get(candidate.sessionId);
      if (cached !== undefined && cached.updatedAt === candidate.coldUpdatedAt) {
        if (!cached.watched) return false;
      } else {
        const agent = await this.ensureLiveAgent(candidate.sessionId);
        const header = agent?.session.header as { cwd?: unknown } | undefined;
        cwd = typeof header?.cwd === 'string' ? header.cwd : undefined;
        this.watchVerdicts.set(candidate.sessionId, {
          updatedAt: candidate.coldUpdatedAt ?? 0,
          watched: cwd !== undefined && this.isWatchedWorkspace(cwd, config),
        });
        if (cwd === undefined) return false;
      }
    }
    const decision = shouldNudgeIdle({
      lastEndKind: 'completed',
      openTurn: false,
      idleMs: now - lastEnd.time,
      workspaceCwd: cwd,
      nudgedToday: this.nudgedToday(candidate.sessionId),
      watchWorkspaces: config.idleWatchWorkspaces,
      nudgeAfterMs: config.idleNudgeAfterMs,
      nudgePerDay: config.idleNudgePerDay,
    });
    if (!decision) return false;
    const entry = this.idleNudged.get(candidate.sessionId);
    const today = todayKey();
    this.idleNudged.set(
      candidate.sessionId,
      entry !== undefined && entry.date === today
        ? { date: today, count: entry.count + 1 }
        : { date: today, count: 1 },
    );
    this.log(`idle-watch: ${candidate.sessionId} молчит, отправляю «${config.idleNudgeText}»`);
    this.schedule(candidate.sessionId, 'idle', config.idleNudgeText);
    return true;
  }

  /** Workspace allowlist check shared by live and cold paths. */
  private isWatchedWorkspace(cwd: string, config: AutoContinueConfig): boolean {
    return shouldNudgeIdle({
      lastEndKind: 'completed',
      openTurn: false,
      idleMs: config.idleNudgeAfterMs,
      workspaceCwd: cwd,
      nudgedToday: 0,
      watchWorkspaces: config.idleWatchWorkspaces,
      nudgeAfterMs: config.idleNudgeAfterMs,
      nudgePerDay: config.idleNudgePerDay,
    });
  }
  private rescanTimer: ReturnType<typeof setInterval> | undefined;
  /** 连续多少轮重扫没发现中断(用于把轮询放缓)。 */
  private idleScans = 0;
  private dayStats: DayStats = emptyDayStats();
  private readonly notices: HostNotice[] = [];
  private readonly noticeListeners = new Set<() => void>();
  private readonly stateListeners = new Set<() => void>();
  private readonly disposeSessionEvents: () => void;
  private disposed = false;

  private readonly ctx: Context;
  private readonly getConfig: () => AutoContinueConfig;
  private readonly extraContinuable?: (failure: FailureFacts) => boolean;

  /**
   * @param ctx - host plugin context (agents registry, session events, settings).
   * @param getConfig - read the current resolved configuration (settings service).
   * @param options.continuable - breaker-aware override: failures the failover
   *   circuit will route away from (AUTH/BILLING included) count as worth
   *   continuing even when the static classifier calls them permanent.
   */
  constructor(
    ctx: Context,
    getConfig: () => AutoContinueConfig,
    options?: {
      continuable?: (failure: FailureFacts) => boolean;
    },
  ) {
    this.ctx = ctx;
    this.getConfig = getConfig;
    this.extraContinuable = options?.continuable;
    // 单实例事件源: 宿主进程内的会话事件 firehose, 天然覆盖所有会话。
    this.disposeSessionEvents = ctx.on('session/event', (session, event) => {
      try {
        this.onHostEvent(session, event);
      } catch (error) {
        console.error(
          `[auto-continue] 会话事件处理异常 ${session.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });
    const config = this.getConfig();
    if (config.scanOnBoot) {
      void this.bootScanLoop();
    }
    // 周期性重扫: 启动扫描是一次性的, 而宿主可能在扫描之后才把会话 resume 起来
    // (agent-loop 恢复、用户在 UI 里打开), 或者启动时 sessionController 还没挂载。
    // 没有这个心跳, 重启后的中断就永远等不到「продолжи」。
    // 自适应间隔: 刚启动时密(重启后的中断要尽快捡起来), 一直没发现中断就放缓,
    // 免得空转一直读盘; 一旦发现中断又立刻回到最密。
    this.scheduleRescan(RESCAN_INTERVAL_MS);
    this.log(
      `已启动(host 单实例, 文本="${config.continueText}", 宽限 ${config.graceMs}ms, ` +
        `冷却 ${config.cooldownMs}ms, 最多连续 ${config.maxConsecutive} 次)`,
    );
    this.log(
      this.sessionController() !== undefined
        ? '会话控制器可用: 冷会话(重启后的中断)也会被扫描并唤醒'
        : '会话控制器暂不可用 — 冷会话恢复要等它挂载(每次扫描都会重新检查)',
    );
  }

  private log(message: string): void {
    if (this.getConfig().verbose) console.info(`[auto-continue] ${message}`);
  }

  /**
   * 排下一次重扫。空闲时逐步放缓到上限, 有发现立刻回到最快 —— 重启后的中断
   * 要尽快捡起, 而长时间无事时不该一直整读会话日志。
   */
  private scheduleRescan(delayMs: number): void {
    if (this.disposed) return;
    if (this.rescanTimer !== undefined) clearTimeout(this.rescanTimer);
    this.rescanTimer = setTimeout(() => {
      this.rescanTimer = undefined;
      if (this.disposed) return;
      const next = (found: number): void => {
        if (found > 0) {
          this.idleScans = 0;
          this.scheduleRescan(RESCAN_INTERVAL_MS);
        } else {
          this.idleScans += 1;
          this.scheduleRescan(Math.min(RESCAN_INTERVAL_MS * 2 ** this.idleScans, RESCAN_MAX_INTERVAL_MS));
        }
      };
      void this.scanInterrupted().then(next, (error) => {
        this.log(`周期扫描异常: ${error instanceof Error ? error.message : String(error)}`);
        this.idleScans += 1;
        this.scheduleRescan(Math.min(RESCAN_INTERVAL_MS * 2 ** this.idleScans, RESCAN_MAX_INTERVAL_MS));
      });
    }, delayMs);
    if (typeof this.rescanTimer.unref === 'function') this.rescanTimer.unref();
  }

  /** 对外(状态桥): 今日统计快照。 */
  todayStats(): DayStats {
    const today = todayKey();
    if (this.dayStats.date !== today) this.dayStats = emptyDayStats();
    return { ...this.dayStats, byCode: { ...this.dayStats.byCode } };
  }

  /** 对外(状态桥): 当前生效的会话级暂停列表。 */
  activePauses(): { sessionId: SessionId; until: number }[] {
    const now = Date.now();
    const out: { sessionId: SessionId; until: number }[] = [];
    for (const [sessionId, until] of this.pauseUntil) {
      if (until > now) out.push({ sessionId, until });
    }
    return out;
  }

  /** 对外(状态桥): 订阅通知事件(SSE 端点推送)。 */
  subscribeNotices(listener: () => void): () => void {
    this.noticeListeners.add(listener);
    return () => {
      this.noticeListeners.delete(listener);
    };
  }

  /** 对外(状态桥): 订阅运行时状态变化(统计/暂停列表)。 */
  subscribeState(listener: () => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private emitState(): void {
    for (const listener of this.stateListeners) listener();
  }

  /** 对外(状态桥): 消费待展示的通知。 */
  drainNotices(): HostNotice[] {
    return this.notices.splice(0, this.notices.length);
  }

  /** 通知动作(browser 通知按钮回传): 立即续跑 / 暂停该会话 / 解除暂停 / 清零统计。 */
  handleNoticeAction(sessionId: SessionId | undefined, action: string): void {
    if (action === 'unpause') {
      if (sessionId !== undefined) this.pauseUntil.delete(sessionId);
      this.log(`解除暂停 ${sessionId ?? '?'}`);
    } else if (action === 'reset-stats') {
      this.dayStats = emptyDayStats();
      this.log('清零今日统计');
    } else if (sessionId !== undefined) {
      this.onNotifyAction(sessionId, action);
    }
    this.emitState();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeSessionEvents();
    if (this.rescanTimer !== undefined) {
      clearInterval(this.rescanTimer);
      this.rescanTimer = undefined;
    }
    for (const state of this.states.values()) {
      if (state.pendingTimer !== undefined) clearTimeout(state.pendingTimer);
      if (state.loopRetryTimer !== undefined) clearTimeout(state.loopRetryTimer);
    }
    this.states.clear();
  }

  private state(sessionId: SessionId): SessionState {
    let state = this.states.get(sessionId);
    if (state === undefined) {
      state = freshState();
      this.states.set(sessionId, state);
    }
    return state;
  }

  /**
   * 事件入口(host 单实例): 预处理工具调用/结果/模型消息(护栏与循环信号),
   * 然后交给回合状态机。
   */
  private onHostEvent(session: Session, event: SessionEvent): void {
    const sessionId = session.id;
    if (
      (event.type === 'user/message' || event.type === 'assistant/message') &&
      typeof event.surfaceOp === 'object' &&
      event.surfaceOp !== null
    ) {
      // Compaction replacement 不是新消息，也可能 shadow 整段工具结果。
      this.state(sessionId).tools.recordSurfaceReplacement(event.seq);
      return;
    }
    if (event.type === 'tool/call') {
      const state = this.state(sessionId);
      // 任何新鲜调用都代表进展（即使缺关联 id）；旧帧重放不能清短句 streak。
      if (state.tools.recordCall(event)) state.shortRun = 0;
    } else if (event.type === 'tool/result') {
      const state = this.state(sessionId);
      state.tools.recordResult(event);
    } else if (event.type === 'step/start') {
      const state = this.state(sessionId);
      const repeat = state.tools.confirmRepeatAtStep(event.seq);
      if (repeat !== undefined) this.checkLoop(sessionId, state, repeat);
    } else if (event.type === 'assistant/chunk') {
      const state = this.state(sessionId);
      this.onAssistantChunk(sessionId, state, event);
    } else if (event.type === 'assistant/message') {
      const state = this.state(sessionId);
      this.onAssistantMessage(sessionId, state, event);
    }
    this.onSessionEvent(sessionId, event);
  }

  /** 从 assistant/message 事件提取纯文本。 */
  private assistantText(event: SessionEvent<'assistant/message'>): string {
    const content = event.data.message.content;
    if (!Array.isArray(content)) return '';
    return content
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('');
  }

  private assistantChunkText(event: SessionEvent<'assistant/chunk'>): string {
    return event.data.chunk.type === 'text-delta' ? event.data.chunk.text : '';
  }

  private normalizedSegment(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private isNearDuplicateSegment(left: string, right: string): boolean {
    if (left === right) return true;
    const leftLen = left.length;
    const rightLen = right.length;
    const longer = Math.max(leftLen, rightLen);
    const shorter = Math.min(leftLen, rightLen);
    if (shorter === 0 || shorter / longer < 0.85) return false;
    if (longer > STREAM_NEAR_DUPLICATE_MAX_CHARS) return false;
    const maxDistance = Math.max(6, Math.floor(longer * 0.08));
    if (Math.abs(leftLen - rightLen) > maxDistance) return false;
    return this.withinEditDistance(left, right, maxDistance);
  }

  private withinEditDistance(left: string, right: string, maxDistance: number): boolean {
    if (left === right) return true;
    if (maxDistance < 0) return false;
    const leftLen = left.length;
    const rightLen = right.length;
    if (Math.abs(leftLen - rightLen) > maxDistance) return false;
    if (leftLen === 0 || rightLen === 0) return Math.max(leftLen, rightLen) <= maxDistance;
    const unreachable = maxDistance + 1;
    let previous = new Int32Array(rightLen + 1);
    let current = new Int32Array(rightLen + 1);
    previous.fill(unreachable);
    for (let col = 0; col <= Math.min(rightLen, maxDistance); col += 1) {
      previous[col] = col;
    }
    for (let row = 1; row <= leftLen; row += 1) {
      current.fill(unreachable);
      if (row <= maxDistance) current[0] = row;
      const firstCol = Math.max(1, row - maxDistance);
      const lastCol = Math.min(rightLen, row + maxDistance);
      let minInRow = unreachable;
      for (let col = firstCol; col <= lastCol; col += 1) {
        const insertion = (current[col - 1] ?? unreachable) + 1;
        const deletion = (previous[col] ?? unreachable) + 1;
        const substitution =
          (previous[col - 1] ?? unreachable) +
          (left.charCodeAt(row - 1) === right.charCodeAt(col - 1) ? 0 : 1);
        const score = Math.min(insertion, deletion, substitution, unreachable);
        current[col] = score;
        if (score < minInRow) minInRow = score;
      }
      if (minInRow > maxDistance) return false;
      [previous, current] = [current, previous];
    }
    return (previous[rightLen] ?? unreachable) <= maxDistance;
  }

  private noteStreamSegment(sessionId: SessionId, state: SessionState, segment: string): void {
    const normalized = this.normalizedSegment(segment);
    const config = this.getConfig();
    if (normalized === '') return;
    if (normalized.length < config.loopShortChars) {
      state.streamLastSegment = '';
      state.streamRepeatRun = 0;
      return;
    }
    if (
      state.streamLastSegment !== '' &&
      this.isNearDuplicateSegment(normalized, state.streamLastSegment)
    ) {
      state.streamRepeatRun += 1;
      state.streamLastSegment = normalized;
    } else {
      state.streamLastSegment = normalized;
      state.streamRepeatRun = 1;
    }
    if (state.streamRepeatRun >= config.loopRepeatText) {
      this.log(
        `检测到流式消息内复读 ${sessionId}: 连续 ${state.streamRepeatRun} 段近似重复文本`,
      );
      this.interruptLoop(sessionId, state);
    }
  }

  private onAssistantChunk(
    sessionId: SessionId,
    state: SessionState,
    event: SessionEvent<'assistant/chunk'>,
  ): void {
    if (!this.getConfig().loopGuard || !state.running || state.loopFired) return;
    const chunk = this.assistantChunkText(event);
    if (chunk === '') return;
    const merged = `${state.streamTail}${chunk}`.replace(/\r/g, '');
    const pieces = merged.split(/\n(?:[ \t]*\n)+/u);
    const tail = pieces.pop() ?? '';
    for (const piece of pieces) this.noteStreamSegment(sessionId, state, piece);
    if (tail.length <= STREAM_TAIL_MAX_CHARS) {
      state.streamTail = tail;
      return;
    }
    state.streamTail = tail.slice(-STREAM_TAIL_MAX_CHARS);
    if (/\S/u.test(tail)) {
      state.streamLastSegment = '';
      state.streamRepeatRun = 0;
    }
  }

  private onAssistantMessage(
    sessionId: SessionId,
    state: SessionState,
    event: SessionEvent<'assistant/message'>,
  ): void {
    if (!this.getConfig().loopGuard) return;
    const text = this.assistantText(event);
    const trimmed = text.trim();
    // 相同文本重复(不限长度): 模型反复输出完全相同的消息是最强的循环信号,
    // 例如 "Let me test variants of the regex..." 连续 7 遍
    if (trimmed !== '' && trimmed === state.lastAssistantText) {
      state.sameTextRun += 1;
    } else {
      state.lastAssistantText = trimmed;
      state.sameTextRun = 1;
    }
    // 短句计数(长度 < loopShortChars 且落在时间窗内): 空转信号
    if (trimmed.length < this.getConfig().loopShortChars) {
      const now = Date.now();
      if (now - state.lastShortAt > this.getConfig().loopWindowMs) {
        state.shortRun = 0; // 超过时间窗: 上一次短句太久远, 不算连续
      }
      state.shortRun += 1;
      state.lastShortAt = now;
    } else {
      state.shortRun = 0; // 长句 = 有实际输出, 重置
      state.lastShortAt = 0;
    }
    const streamTail = state.streamTail;
    state.streamTail = '';
    if (streamTail !== '') this.noteStreamSegment(sessionId, state, streamTail);
    state.streamLastSegment = '';
    state.streamRepeatRun = 0;
    this.checkLoop(sessionId, state);
  }

  /** 两个循环信号的公共检查; 命中且本回合未打断过则打断。 */
  private checkLoop(
    sessionId: SessionId,
    state: SessionState,
    toolRepeat?: ToolRepeatSignal,
  ): void {
    if (!this.getConfig().loopGuard) return;
    if (state.loopFired) return;
    if (!state.running) return; // 只干预运行中的回合
    const config = this.getConfig();
    if (state.sameTextRun >= config.loopRepeatText) {
      this.log(`检测到空转循环 ${sessionId}: 连续 ${state.sameTextRun} 条相同消息`);
      this.interruptLoop(sessionId, state);
    } else if (state.shortRun >= config.loopShortCount) {
      this.log(`检测到空转循环 ${sessionId}: 连续 ${state.shortRun} 条短句且无工具调用`);
      this.interruptLoop(sessionId, state);
    } else if (toolRepeat !== undefined && toolRepeat.count >= config.loopToolRepeat) {
      this.log(`检测到工具死循环 ${sessionId}: 「${toolRepeat.tool}」连续 ${toolRepeat.count} 次(同参数同结果)`);
      this.interruptLoop(sessionId, state);
    }
  }

  /**
   * 打断运行中的回合: cancel(带来源标记)+ 进冷却。
   * 只有随后持久化的 turn/end 精确携带专属 hook cause 时,
   * 才会用 loopText 重启回合——DSH 的 first-cause 语义保证用户 Stop 优先。
   */
  private interruptLoop(sessionId: SessionId, state: SessionState): void {
    if (state.loopFired) return;
    // 打断本身受冷却约束: 距上次打断/发送太近时不再打断, 防止反复打断刷屏
    if (Date.now() - state.lastAttemptAt < this.cooldownFor(state)) {
      this.log(`跳过循环打断 ${sessionId}: 处于冷却期`);
      return;
    }
    state.loopFired = true;
    state.lastAttemptAt = Date.now(); // 打断计入冷却, 防反复打断
    try {
      const agent = this.ctx.agents.get(sessionId);
      if (agent === undefined) {
        this.log(`打断循环失败 ${sessionId}: 无 live agent`);
        state.loopFired = false;
        return;
      }
      agent.cancel(LOOP_GUARD_CANCEL_CAUSE, { keepInbox: true });
      this.log(`已打断循环 ${sessionId}: cancel 已受理`);
    } catch (error) {
      this.log(`打断循环失败 ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
      state.loopFired = false;
    }
  }

  private onSessionEvent(sessionId: SessionId, event: SessionEvent): void {
    const state = this.state(sessionId);
    switch (event.type) {
      case 'turn/start':
        state.running = true;
        // 新回合开始: 清空上一步工具调用状态, 避免跨回合误用护栏
        state.tools.startTurn(event.seq);
        // loop guard 状态按回合重置
        state.shortRun = 0;
        state.lastShortAt = 0;
        state.lastAssistantText = '';
        state.sameTextRun = 0;
        state.streamTail = '';
        state.streamLastSegment = '';
        state.streamRepeatRun = 0;
        state.loopFired = false;
        if (state.loopRetryTimer !== undefined) {
          clearTimeout(state.loopRetryTimer);
          state.loopRetryTimer = undefined;
        }
        this.cancelPending(sessionId, '宿主自行开启新回合');
        break;
      case 'turn/end': {
        state.running = false;
        const loopCancelPending = state.loopFired;
        state.loopFired = false;
        this.cancelPending(sessionId, '收到新的 turn/end');
        const reason = event.data.reason;
        const reasonKind = readReasonKind(reason);
        if (reasonKind === undefined) {
          console.error(`[auto-continue] 忽略畸形 turn/end ${sessionId}: reason 无法解释`);
          break;
        }
        if (reasonKind === 'completed') {
          // 成功回合: 恢复健康状态, 并确认上一次自动发送的效果
          state.consecutive = 0;
          state.lastFailure = undefined;
          this.noteRecovery(sessionId, 'completed');
        } else if (reasonKind === 'aborted') {
          if (isLoopGuardCancelReason((reason as { reason?: unknown }).reason)) {
            // 我们自己的 loop guard 打断: 视为可恢复中断, 用循环提示文本重启回合。
            // 不清 consecutive / lastAttemptAt: 冷却与连续上限在 loop 路径同样生效,
            // 防止无限打断重发(issue #13); 打断本身受冷却约束, 重启也要等冷却。
            if (loopCancelPending) this.bumpStat({ looped: 1 });
            state.pendingRecoveryAt = 0;
            state.shortRun = 0;
            state.lastShortAt = 0;
            state.lastAssistantText = '';
            state.sameTextRun = 0;
            state.streamTail = '';
            state.streamLastSegment = '';
            state.streamRepeatRun = 0;
            state.tools.resetRepeat();
            // 重启受冷却约束(防紧密打断循环): 等剩余冷却结束后再调度
            const cooldown = this.cooldownFor(state);
            const remaining = cooldown - (Date.now() - state.lastAttemptAt);
            if (remaining > 0) {
              if (state.loopRetryTimer !== undefined) clearTimeout(state.loopRetryTimer);
              state.loopRetryTimer = setTimeout(() => {
                state.loopRetryTimer = undefined;
                try {
                  this.schedule(sessionId, 'loop:aborted');
                } catch (error) {
                  console.error(`[auto-continue] loop 重启异常 ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
                }
              }, remaining);
              this.log(`loop 重启延迟 ${remaining}ms(冷却期) ${sessionId}`);
            } else {
              this.schedule(sessionId, 'loop:aborted');
            }
          } else {
            // 用户主动停止: 不自动继续, 视为用户介入
            state.consecutive = 0;
            state.pendingRecoveryAt = 0;
          }
        } else if (reasonKind === 'blocked') {
          // 策略拒绝: 不自动继续
        } else if (reasonKind === 'interrupted') {
          // 实时路径的 interrupted 仅来自崩溃修复重载(loop 从不实时发出);
          // 用户手动停止在 DSH 中标记为 aborted, 不走到这里。实时流里出现
          // interrupted 视为异常中断, 不自动继续——宿主崩溃孤儿回合由扫描恢复。
          state.consecutive = 0;
          state.pendingRecoveryAt = 0;
        } else if (reasonKind === 'error') {
          // 记录失败事实(分类与模板填充用), 然后按类型处理
          const failure = parseFailureFacts((reason as { error?: unknown }).error);
          if (failure === undefined) {
            console.error(`[auto-continue] 忽略畸形 turn/end ${sessionId}: error details 无法解释`);
            break;
          }
          state.lastFailure = failure;
          state.lastTurn = event.data.turn;
          state.lastFailureAt = Date.now();
          this.noteRecovery(sessionId, 'error');
          this.onTurnFailure(sessionId, 'turn/end:error', state.lastFailure);
        } else if (reasonKind === 'max-tokens') {
          state.lastFailureAt = Date.now();
          this.noteRecovery(sessionId, 'error');
          this.schedule(sessionId, 'turn/end:max-tokens');
        }
        break;
      }
      case 'user/message':
        if (isOurEcho(state, event)) break; // 我们自己的回显(跨标签页识别)
        if (event.data.source.kind === 'user') {
          // 用户手动介入: 清零上限与跨标签页发送计数
          state.consecutive = 0;
          this.cancelPending(sessionId, '用户手动发送消息');
        }
        break;
      default:
        break;
    }
  }

  // ---------- host 帧 ----------

  /**
   * Whether a turn failure deserves an automatic continue: either the static
   * classifier says transient, or the failover circuit claims it (the next
   * request will leave the dead route — FR-3).
   */
  private isWorthContinuing(failure: FailureFacts): boolean {
    const config = this.getConfig();
    if (!config.classify) return true;
    if (isTransientFailure(failure, config.retryableErrorPatterns)) return true;
    try {
      return this.extraContinuable?.(failure) === true;
    } catch {
      return false;
    }
  }

  private onTurnFailure(sessionId: SessionId, reason: string, failure: FailureFacts): void {
    const config = this.getConfig();
    if (!this.isWorthContinuing(failure)) {
      const copy = NOTICE_COPY[config.locale];
      const summary = `${failure.code}${failure.status !== undefined ? ` (HTTP ${failure.status})` : ''}`;
      this.log(`跳过 ${sessionId}(${reason}): 永久性失败 ${summary} — ${failure.message}`);
      this.bumpStat({ skipped: 1, code: failure.code });
      if (config.notify) {
        this.notify(
          sessionId,
          copy.notContinuedTitle,
          copy.permanentErrorBody(sessionId, summary),
          this.notifyOptions(sessionId, config.locale),
        );
      }
      return;
    }
    this.schedule(sessionId, reason);
  }

  /** 通知操作按钮与回调(「立即续跑」/「暂停该会话 1 小时」)。 */
  private notifyOptions(sessionId: SessionId, locale: AutoContinueLocale): NotifyOptions {
    const copy = NOTICE_COPY[locale];
    return {
      actions: [
        { action: 'resume', title: copy.resumeAction },
        { action: 'pause1h', title: copy.pauseAction },
      ],
      onAction: (action) => this.onNotifyAction(sessionId, action),
    };
  }

  private onNotifyAction(sessionId: SessionId, action: string): void {
    if (action === 'resume') {
      this.log(`通知按钮: 立即续跑 ${sessionId}`);
      void this.resumeNow(sessionId);
    } else if (action === 'pause1h') {
      this.log(`通知按钮: 暂停 ${sessionId} 1 小时`);
      this.pauseUntil.set(sessionId, Date.now() + 60 * 60 * 1000);
      this.cancelPending(sessionId, '通知按钮暂停该会话');
    }
  }


  /** 内存统计(host 单实例): 按今日桶累计。 */
  private bumpStat(delta: {
    sent?: number;
    skipped?: number;
    recovered?: number;
    failed?: number;
    gaveUp?: number;
    looped?: number;
    nudged?: number;
    code?: string;
  }): void {
    const today = todayKey();
    if (this.dayStats.date !== today) this.dayStats = emptyDayStats();
    if (delta.sent !== undefined) this.dayStats.sent += delta.sent;
    if (delta.skipped !== undefined) this.dayStats.skipped += delta.skipped;
    if (delta.recovered !== undefined) this.dayStats.recovered += delta.recovered;
    if (delta.failed !== undefined) this.dayStats.failed += delta.failed;
    if (delta.gaveUp !== undefined) this.dayStats.gaveUp += delta.gaveUp;
    if (delta.looped !== undefined) this.dayStats.looped += delta.looped;
    if (delta.nudged !== undefined) this.dayStats.nudged += delta.nudged;
    if (delta.code !== undefined) {
      this.dayStats.byCode[delta.code] = (this.dayStats.byCode[delta.code] ?? 0) + 1;
    }
  }

  /** 通知桥: 产生一条通知事件, SSE 端点推给 browser 侧展示。 */
  private notify(
    sessionId: SessionId,
    title: string,
    body: string,
    options?: NotifyOptions,
  ): void {
    const notice: HostNotice = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      body,
      sessionId,
      ...(options?.actions !== undefined && options.actions.length > 0
        ? { actions: options.actions }
        : { actions: [] }),
      at: Date.now(),
    };
    this.notices.push(notice);
    for (const listener of this.noticeListeners) listener();
    this.emitState();
  }

  /** 恢复结果记账: 自动发送后窗口内的回合结束, 判定恢复成功或失败。 */
  private noteRecovery(sessionId: SessionId, outcome: 'completed' | 'error'): void {
    const state = this.state(sessionId);
    if (state.pendingRecoveryAt === 0) return;
    if (Date.now() - state.pendingRecoveryAt > RECOVERY_WINDOW_MS) {
      state.pendingRecoveryAt = 0; // 窗口过期, 不再归属这次发送
      return;
    }
    state.pendingRecoveryAt = 0;
    this.bumpStat(outcome === 'completed' ? { recovered: 1 } : { failed: 1 });
    this.log(`恢复结果(${sessionId}): ${outcome === 'completed' ? '成功' : '失败'}`);
  }

  /** 立即为该会话发送一次自动继续(无视冷却与连续上限; 由通知按钮触发)。 */
  async resumeNow(sessionId: SessionId): Promise<void> {
    if (this.disposed) return;
    const state = this.state(sessionId);
    // Subagent sessions are recovered here too; only active/running sessions are skipped by scan.
    if (state.pendingTimer !== undefined) {
      clearTimeout(state.pendingTimer);
      state.pendingTimer = undefined;
    }
    try {
      await this.fire(sessionId, 'manual:notification', true);
    } catch (error) {
      console.error(`[auto-continue] 手动续跑异常 ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** 本会话当前生效的冷却间隔(自适应退避)。 */
  private cooldownFor(state: SessionState): number {
    const config = this.getConfig();
    return effectiveCooldown(
      state.consecutive,
      config.cooldownMs,
      config.backoffFactor,
      config.backoffMaxMs,
    );
  }

  private schedule(sessionId: SessionId, reason: string, textOverride?: string): void {
    const state = this.state(sessionId);
    const config = this.getConfig();
    // Subagent sessions may be resumed independently after a host restart.
    if (config.paused) {
      this.log(`跳过 ${sessionId}(${reason}): 全局暂停中`);
      return;
    }
    if (Date.now() < (this.pauseUntil.get(sessionId) ?? 0)) {
      this.log(`跳过 ${sessionId}(${reason}): 会话暂停中`);
      return;
    }
    if (state.pendingTimer !== undefined) return; // 已有待发送
    if (Date.now() - state.lastAttemptAt < this.cooldownFor(state)) return; // 冷却期(含失败尝试, 自适应退避)
    if (state.consecutive >= config.maxConsecutive) {
      this.log(
        `跳过 ${sessionId}(${reason}): 已连续自动继续 ${state.consecutive} 次, 等待用户介入或成功回合`,
      );
      return;
    }
    const timer = setTimeout(() => {
      if (state.pendingTimer !== timer) return;
      state.pendingTimer = undefined;
      // 保险丝: 定时器回调内任何异常(含 inactive context)都不得成为未捕获异常炸掉进程。
      try {
        void this.fire(sessionId, reason, false, textOverride).catch((error) => {
          console.error(`[auto-continue] 定时发送异常 ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
        });
      } catch (error) {
        console.error(`[auto-continue] 定时发送异常 ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, config.graceMs);
    state.pendingTimer = timer;
    const template = reason.startsWith('loop:')
      ? config.loopText
      : reason.includes('max-tokens')
        ? config.continueTextMaxTokens
        : config.continueText;
    this.log(
      `检测到非人为中断 ${sessionId}(${reason}), ${config.graceMs}ms 后自动发送「${template}」`,
    );
  }

  private cancelPending(sessionId: SessionId, why: string): void {
    const state = this.state(sessionId);
    if (state.pendingTimer === undefined) return;
    clearTimeout(state.pendingTimer);
    state.pendingTimer = undefined;
    this.log(`取消 ${sessionId} 的自动继续(${why})`);
  }

  private async fire(sessionId: SessionId, reason: string, force = false, textOverride?: string): Promise<void> {
    if (this.disposed) return;
    const state = this.state(sessionId);
    const config = this.getConfig();
    // Subagent sessions may be resumed independently after a host restart.
    if (config.paused) {
      this.log(`跳过 ${sessionId}(${reason}): 全局暂停中`);
      return;
    }
    if (Date.now() < (this.pauseUntil.get(sessionId) ?? 0)) {
      this.log(`跳过 ${sessionId}(${reason}): 会话暂停中`);
      return;
    }
    // 冷却(自适应退避)与连续上限; 通知按钮的强制续跑不受约束
    if (!force && Date.now() - state.lastAttemptAt < this.cooldownFor(state)) {
      this.log(`跳过 ${sessionId}(${reason}): 处于冷却期`);
      return;
    }
    if (!force && state.consecutive >= config.maxConsecutive) {
      this.log(`跳过 ${sessionId}(${reason}): 已连续自动继续 ${state.consecutive} 次, 等待用户介入或成功回合`);
      return;
    }
    // 模板填充: continueText 可含 {code}/{message}/{status}/{tool}/{turn}/{errorCount}/{sessionTitle}/{elapsed} 占位符
    const template = textOverride ?? (reason.startsWith('loop:')
      ? config.loopText
      : reason.includes('max-tokens')
        ? config.continueTextMaxTokens
        : config.continueText);
    const text = this.buildContinueText(config, state, template);
    // 发送: agent.followup 是排队语义(运行中会排入 inbox, 不会打断), 天然安全
    // 冷会话(host 重启后没人打开过)必须先唤醒, 否则 followup 无处可发。
    const agent = await this.ensureLiveAgent(sessionId);
    if (agent === undefined) {
      this.log(`跳过 ${sessionId}(${reason}): 无 live agent`);
      return;
    }
    if (this.disposed) return;
    state.lastAttemptAt = Date.now(); // 先记账: 无论成败, 本次尝试都进入冷却
    try {
      const message = createUserMessage({
        content: [{ type: 'text', text }],
        source: { kind: 'user' },
      });
      // `followup` may publish the matching session event synchronously.
      trackPendingEcho(state, message.id);
      try {
        agent.followup(message);
      } catch (error) {
        forgetPendingEcho(state, message.id);
        throw error;
      }
      const now = Date.now();
      state.consecutive += 1;
      state.pendingRecoveryAt = now; // 等待窗口内的下一个回合结束来判定恢复结果
      this.bumpStat({ sent: 1, ...(state.lastFailure !== undefined ? { code: state.lastFailure.code } : {}) });
      if (reason === 'idle') this.bumpStat({ nudged: 1 });
      this.log(`已自动发送「${text}」到 ${sessionId}(${reason}), 第 ${state.consecutive} 次连续`);
      if (config.notify) {
        const copy = NOTICE_COPY[config.locale];
        this.notify(
          sessionId,
          copy.continuedTitle,
          copy.continuedBody(sessionId, text, state.consecutive),
          this.notifyOptions(sessionId, config.locale),
        );
      }
      if (state.consecutive >= config.maxConsecutive) {
        this.bumpStat({ gaveUp: 1 });
        this.log(`达到连续上限 ${config.maxConsecutive} 次, 停止自动继续 ${sessionId}`);
        if (config.notify) {
          const copy = NOTICE_COPY[config.locale];
          this.notify(
            sessionId,
            copy.stoppedTitle,
            copy.stoppedBody(sessionId, state.consecutive),
            this.notifyOptions(sessionId, config.locale),
          );
        }
      }
    } catch (error) {
      this.log(`发送异常 ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 组装本次续跑消息: 模板填充 + 幂等护栏。
   * 护栏依据上一步工具调用的执行状态附加指引, 防止重跑副作用操作:
   * - 结果未确认(可能已部分执行)→ 提示先确认状态、不要重复执行
   * - 已确认成功 → 提示已完成、不要重复执行
   * - 已失败 → 不加护栏(重试工具本来就是目的)
   */
  private buildContinueText(
    config: AutoContinueConfig,
    state: SessionState,
    template: string,
  ): string {
    let text = fillTemplate(template, {
      facts: state.lastFailure,
      tool: state.tools.lastTool(),
      turn: state.lastTurn,
      errorCount: state.consecutive + 1,
      elapsedMs: state.lastFailureAt > 0 ? Date.now() - state.lastFailureAt : undefined,
    });
    if (!config.guardTools) return text;
    const guard = this.currentGuard(state);
    if (guard.kind === 'pending') {
      text += ` ${fillTemplate(config.guardPendingText, { tool: guard.tool, result: guard.result })}`;
    } else if (guard.kind === 'done') {
      text += ` ${fillTemplate(config.guardDoneText, { tool: guard.tool, result: guard.result })}`;
    }
    return text;
  }

  /** 上一步工具调用的护栏状态(实时路径, 由 mux 帧维护)。 */
  private currentGuard(state: SessionState): {
    kind: 'none' | 'pending' | 'done' | 'failed';
    tool?: string;
    result?: string;
  } {
    return state.tools.guard();
  }

  private async bootScanLoop(): Promise<void> {
    await this.scanLoop(Infinity, 3000);
  }

  /** 反复尝试扫描, 直到成功(宿主就绪)或达到次数上限。 */
  private async scanLoop(attempts: number, delayMs: number): Promise<void> {
    for (let attempt = 0; attempt < attempts && !this.disposed; attempt += 1) {
      try {
        // 返回值是"发现并安排了几条中断"(0 也代表扫描成功) —— 只要没抛异常,
        // 就说明宿主已就绪, 本轮启动扫描可以收工。
        await this.scanInterrupted();
        return;
      } catch (error) {
        if (this.disposed) return;
        // 宿主未就绪时每 3s 重试; 只节流记录日志, 避免刷屏。
        if (attempt % 10 === 0) {
          this.log(
            `扫描失败(${attempt + 1}/${attempts === Infinity ? '∞' : attempts}): ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
      if (attempt + 1 < attempts) await sleep(delayMs);
    }
  }

  /**
   * 扫描最近中断过的会话: 最后回合以非人为原因结束(或回合根本没来得及收尾),
   * 且其后没有新回合或用户消息。
   *
   * 关键: host 重启后没有任何 live agent —— agent-loop 的 agents 配置为空,
   * 冷会话要等用户在 UI 里打开才被 resume。因此只扫 `agents.list()` 会永远
   * 扫不到东西, 这里额外枚举持久化的冷会话, 并在发送前把它们唤醒。
   * @returns 本次安排续跑的会话数(宿主未就绪时抛异常)。
   */
  private async scanInterrupted(): Promise<number> {
    const config = this.getConfig();
    if (config.paused) return 0; // 全局暂停: 不做任何扫描
    let scheduled = 0;
    const now = Date.now();
    const candidates: {
      sessionId: SessionId;
      events: readonly SessionEvent[];
      lastActivityAt: number;
      listIndex: number;
      cold?: boolean;
      coldUpdatedAt?: number;
      running?: boolean;
      /** Workspace path for idle-watch matching (live sessions read it free). */
      cwd?: string;
    }[] = [];
    for (const agent of this.ctx.agents.list()) {
      const session = agent.session;
      const events = snapshotSessionEvents(session);
      const lastActivityAt = events.reduce(
        (latest, event) => Math.max(latest, event.time),
        Number.isFinite(session.header.createdAt) ? session.header.createdAt : 0,
      );
      const header = session.header as { cwd?: unknown };
      const cwd = typeof header.cwd === 'string' ? header.cwd : undefined;
      candidates.push({
        sessionId: session.id,
        cwd,
        events,
        lastActivityAt,
        listIndex: candidates.length,
        // 正在跑的回合不是孤儿: 它有 open turn, 但绝不能往里塞「продолжи」
        running: agent.status === 'running',
      });
    }
    const liveIds = new Set(candidates.map((candidate) => candidate.sessionId));
    const controller = this.sessionController();
    if (controller !== undefined && typeof controller.list === 'function') {
      let items: readonly { sessionId?: unknown; updatedAt?: unknown; running?: unknown; parentSessionId?: unknown; origin?: unknown }[] = [];
      try {
        const listed = await controller.list({});
        items = ((listed?.items ?? []) as typeof items);
      } catch (error) {
        this.log(`枚举持久化会话失败: ${error instanceof Error ? error.message : String(error)}`);
      }
      // list() 已按活跃度倒序: 只读最新的一小批, inspect() 会整读日志, 不能全量。
      let inspectedCount = 0;
      for (const item of items) {
        if (inspectedCount >= config.scanLimit) break;
        const sessionId = item?.sessionId;
        if (typeof sessionId !== 'string' || sessionId === '') continue;
        if (liveIds.has(sessionId)) continue;
        if (item.parentSessionId !== undefined && item.origin === 'subagent' && item.running === true) continue;
        const updatedAt = typeof item.updatedAt === 'number' ? item.updatedAt : 0;
        if (updatedAt > 0 && updatedAt < now - config.freshMs) continue;
        // 便宜的状态检查放在 inspect 之前: inspect 会整读(并解压)日志, 很贵。
        const cheap = this.state(sessionId as SessionId);
        if (cheap.pendingTimer !== undefined) continue;
        if (cheap.consecutive >= config.maxConsecutive) continue;
        if (now - cheap.lastAttemptAt < this.cooldownFor(cheap)) continue;
        if (now < (this.pauseUntil.get(sessionId as SessionId) ?? 0)) continue;
        if (now - (this.lastInspectAt.get(sessionId as SessionId) ?? 0) < COLD_INSPECT_TTL_MS) continue;
        // 判定缓存: inspect() 整读并解压日志(可达数 MB)。若上一次读到的 updatedAt
        // 与现在相同, 说明日志没变, 结论必然一样 —— 直接复用, 不要重复读盘。
        const cached = this.coldVerdict.get(sessionId as SessionId);
        if (cached !== undefined && cached.updatedAt === updatedAt && !cached.resumable) continue;
        this.lastInspectAt.set(sessionId as SessionId, now);
        inspectedCount += 1;
        let events: readonly SessionEvent[] | undefined;
        try {
          const inspect = controller.inspect as (
            (id: SessionId) => Promise<{ events?: readonly SessionEvent[] } | undefined>
          ) | undefined;
          const inspected = await inspect?.(sessionId as SessionId);
          events = inspected?.events;
        } catch {
          continue; // 会话可能刚被移除
        }
        if (!Array.isArray(events) || events.length === 0) continue;
        // Coarse pre-filter: interrupted/error → interrupt path; completed →
        // idle-watch candidate (silence + workspace checked later).
        // 精判在下面的统一循环里。粗筛为假就记进缓存, 下次同一 updatedAt 不再读盘。
        let lastKind: string | undefined;
        for (let i = events.length - 1; i >= 0; i -= 1) {
          const event = events[i];
          if (event !== undefined && event.type === 'turn/end') {
            lastKind = readReasonKind((event.data as { reason?: unknown }).reason);
            break;
          }
        }
        const worthChecking = looksInterrupted(events) || lastKind === 'completed';
        this.coldVerdict.set(sessionId as SessionId, { updatedAt, resumable: worthChecking });
        if (!worthChecking) continue;
        candidates.push({
          sessionId: sessionId as SessionId,
          events,
          lastActivityAt: events.reduce((latest, event) => Math.max(latest, event.time ?? 0), updatedAt),
          listIndex: candidates.length,
          cold: true,
          coldUpdatedAt: updatedAt,
          running: item.running === true,
        });
      }
    }
    candidates.sort(
      (left, right) =>
        right.lastActivityAt - left.lastActivityAt || left.listIndex - right.listIndex,
    );
    for (const candidate of candidates.slice(0, config.scanLimit)) {
      if (this.disposed) return scheduled;
      if (candidate.running) continue; // 回合正在跑: 不是中断, 不干预
      const state = this.state(candidate.sessionId);
      if (state.pendingTimer !== undefined) continue;
      if (state.consecutive >= config.maxConsecutive) continue;
      if (now - state.lastAttemptAt < this.cooldownFor(state)) continue;
      if (now < (this.pauseUntil.get(candidate.sessionId) ?? 0)) continue; // 会话暂停中
      const events = candidate.events;
      // 从尾部找最后一个 turn/end
      let lastEnd: SessionEvent<'turn/end'> | undefined;
      for (let i = events.length - 1; i >= 0; i -= 1) {
        const event = events[i];
        if (event !== undefined && event.type === 'turn/end') {
          lastEnd = event;
          break;
        }
      }
      const openTurnSeq = openTurnStartSeq(events);
      const openTurn = openTurnSeq !== undefined;
      if (lastEnd === undefined && !openTurn) continue;
      let reasonKind: string | undefined;
      if (openTurn) {
        // 回合根本没来得及收尾(宿主被强杀): 等同 interrupted
        reasonKind = 'interrupted';
      } else {
        const reason = lastEnd!.data.reason;
        reasonKind = readReasonKind(reason);
        if (reasonKind === 'completed') {
          // Completed-but-silent sessions are the idle-watch's business, not
          // the interrupt path's: nudge watched fleet sessions, else skip.
          // Human stops (aborted/blocked) and unknown kinds never qualify.
          if (await this.maybeNudgeIdle(candidate, lastEnd!, now, config)) scheduled += 1;
          continue;
        }
        if (reasonKind === undefined || !isNonHumanReason(reasonKind)) {
          if (candidate.cold) this.coldVerdict.set(candidate.sessionId, { updatedAt: candidate.coldUpdatedAt!, resumable: false });
          continue;
        }
      }
      const lastAt = openTurn
        ? events[events.length - 1]?.time ?? candidate.lastActivityAt
        : lastEnd!.time;
      if (lastAt < now - config.freshMs) {
        // 结论只依赖事件内容: 日志没变就不可能变, 记下来免得每次重读。
        if (candidate.cold) this.coldVerdict.set(candidate.sessionId, { updatedAt: candidate.coldUpdatedAt!, resumable: false });
        continue; // 太久远, 不翻旧账
      }
      // 孤儿回合: 只看这个未收尾回合内部的事件; 已收尾回合: 只看 turn/end 之后的事件。
      const boundarySeq = openTurn ? openTurnSeq! : lastEnd!.seq;
      const inScope = (event: SessionEvent): boolean =>
        openTurn ? event.seq >= boundarySeq : event.seq > boundarySeq;
      let superseded = false;
      for (const event of events) {
        if (!inScope(event)) continue;
        // 孤儿回合被后来补上的 turn/end 收尾 = 已经处理过了
        if (openTurn && event.type === 'turn/end') superseded = true;
        // 已收尾回合之后又开了新回合 = 已经处理过了
        if (!openTurn && event.type === 'turn/start') superseded = true;
        if (event.type === 'user/message' && event.data.source.kind === 'user') superseded = true;
        if (superseded) break;
      }
      if (superseded) {
        // 已被后续回合/用户消息覆盖 —— 同样只依赖内容, 缓存掉。
        if (candidate.cold) this.coldVerdict.set(candidate.sessionId, { updatedAt: candidate.coldUpdatedAt!, resumable: false });
        continue;
      }
      // 幂等护栏: 从历史事件里重建上一步工具调用的执行状态
      this.applyGuardFromEvents(state, events, boundarySeq);
      const scanReason = `scan:turn/end:${reasonKind}`;
      this.log(
        `扫描发现中断 ${candidate.sessionId}(turn/end:${reasonKind}${candidate.cold ? ', 冷会话' : ''}), 交给恢复策略处理`,
      );
      if (reasonKind === 'error' && lastEnd !== undefined) {
        const failure = parseFailureFacts((lastEnd.data.reason as { error?: unknown }).error);
        if (failure === undefined) {
          console.error(`[auto-continue] 忽略畸形扫描 turn/end ${candidate.sessionId}: error details 无法解释`);
          continue;
        }
        state.lastFailure = failure;
        state.lastTurn = lastEnd.data.turn;
        state.lastFailureAt = lastEnd.time;
        // Permanent failures (unknown model etc.) can never be auto-resumed.
        // Breaker-claimed codes (AUTH/BILLING/…) ARE resumable — the next
        // request leaves the dead route — so consult the same verdict here.
        if (!this.isWorthContinuing(failure)) {
          if (candidate.cold) {
            this.coldVerdict.set(candidate.sessionId, {
              updatedAt: candidate.coldUpdatedAt!,
              resumable: false,
            });
          }
        }
        this.onTurnFailure(candidate.sessionId, scanReason, state.lastFailure);
      } else {
        this.schedule(candidate.sessionId, scanReason);
      }
      scheduled += 1;
    }
    return scheduled;
  }

  /** host 侧会话控制器(枚举冷会话 / 读取历史 / 唤醒会话); 未挂载时返回 undefined。 */
  private sessionController():
    | {
        list?: (request: unknown) => Promise<{ items?: readonly unknown[] } | undefined>;
        inspect?: (sessionId: SessionId) => Promise<{ events?: readonly SessionEvent[] } | undefined>;
        resolveAgent?: (sessionId: SessionId) => Promise<{ agent?: Agent } | undefined>;
      }
    | undefined {
    try {
      return this.ctx.get('sessionController', false) as never;
    } catch {
      return undefined;
    }
  }

  /**
   * 取 live agent; 会话是冷的(host 重启后没人打开过)就通过 sessionController
   * 唤醒它 —— 否则 followup 无处可发。
   */
  private async ensureLiveAgent(sessionId: SessionId): Promise<Agent | undefined> {
    const live = this.ctx.agents.get(sessionId);
    if (live !== undefined) return live;
    const controller = this.sessionController();
    if (controller === undefined || typeof controller.resolveAgent !== 'function') return undefined;
    try {
      const found = await controller.resolveAgent(sessionId);
      if (found !== undefined && found !== null && found.agent !== undefined) return found.agent;
    } catch (error) {
      this.log(
        `唤醒会话失败 ${sessionId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return this.ctx.agents.get(sessionId);
  }

  /** 从历史事件恢复上一步工具调用状态(扫描路径的幂等护栏)。 */
  private applyGuardFromEvents(
    state: SessionState,
    events: readonly SessionEvent[],
    untilSeq: number,
  ): void {
    state.tools.restore(events, untilSeq);
  }
}
