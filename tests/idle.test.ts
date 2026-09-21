/**
 * Idle-watch decision tests (pure logic, no host needed).
 * Run: node --test --experimental-strip-types tests/idle.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldNudgeIdle, resolveConfig, type IdleWatchInput } from '../src/continue-core.ts';

const base: IdleWatchInput = {
  lastEndKind: 'completed',
  openTurn: false,
  idleMs: 20 * 60 * 1000,
  workspaceCwd: 'D:\\AI\\rovodev\\DK2_worktrees\\dk2-frontend',
  nudgedToday: 0,
  watchWorkspaces: 'DK2_worktrees/dk2-frontend\nDK2_worktrees/dk2-backend',
  nudgeAfterMs: 15 * 60 * 1000,
  nudgePerDay: 48,
};

describe('shouldNudgeIdle', () => {
  it('nudges a stale completed fleet session', () => {
    assert.equal(shouldNudgeIdle(base), true);
  });

  it('never fires on aborted turns (human stopped)', () => {
    assert.equal(shouldNudgeIdle({ ...base, lastEndKind: 'aborted' }), false);
    assert.equal(shouldNudgeIdle({ ...base, lastEndKind: 'error' }), false);
    assert.equal(shouldNudgeIdle({ ...base, lastEndKind: undefined }), false);
  });

  it('never fires with an open turn', () => {
    assert.equal(shouldNudgeIdle({ ...base, openTurn: true }), false);
  });

  it('never fires when fresh, capped, or unlisted', () => {
    assert.equal(shouldNudgeIdle({ ...base, idleMs: 60_000 }), false);
    assert.equal(shouldNudgeIdle({ ...base, nudgedToday: 48 }), false);
    assert.equal(shouldNudgeIdle({ ...base, watchWorkspaces: '' }), false);
    assert.equal(shouldNudgeIdle({ ...base, watchWorkspaces: '   \n ' }), false);
    assert.equal(
      shouldNudgeIdle({ ...base, workspaceCwd: 'C:\\Users\\sergei\\.dsh\\sessions\\telegram-123' }),
      false,
    );
    assert.equal(shouldNudgeIdle({ ...base, workspaceCwd: undefined }), false);
  });

  it('matches case- and slash-insensitively', () => {
    assert.equal(
      shouldNudgeIdle({ ...base, workspaceCwd: 'd:/ai/rovodev/dk2_worktrees/DK2-Backend' }),
      true,
    );
  });
});

describe('idle defaults', () => {
  it('ships live-tuned values with empty allowlist (safe off)', () => {
    const resolved = resolveConfig(undefined);
    assert.equal(resolved.idleWatchWorkspaces, '');
    assert.equal(resolved.idleNudgeText, 'работай');
    assert.equal(resolved.idleNudgeAfterMs, 15 * 60 * 1000);
    assert.equal(resolved.idleNudgePerDay, 48);
  });
});
