/**
 * Config resolution tests (pure, no host needed).
 * Run: node --test --experimental-strip-types tests/config.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveFullConfig, DEFAULT_TRIP_CODES } from '../src/index.ts';

describe('defaults encode the live-tuned policy', () => {
  it('threshold 1, hour cooldown, 15m window, cap 5', () => {
    const resolved = resolveFullConfig(undefined);
    assert.equal(resolved.enabled, true);
    assert.equal(resolved.modelCircuitThreshold, 1);
    assert.equal(resolved.modelCooldownMs, 3_600_000);
    assert.equal(resolved.burstWindowMs, 900_000);
    assert.equal(resolved.maxSwitchesPerStep, 5);
    assert.deepEqual(resolved.fallbacks, []);
    assert.ok(resolved.tripCodes.includes('AUTH'));
    assert.ok(resolved.tripCodes.includes('BILLING'));
    assert.ok(resolved.tripCodes.includes('CONTEXT_WINDOW_EXCEEDED'));
    assert.equal(resolved.continue_.continueText, 'продолжи');
    assert.equal(resolved.continue_.maxConsecutive, 10);
  });
});

describe('fallbacks parsing', () => {
  it('keeps valid routes, drops garbage', () => {
    const resolved = resolveFullConfig({
      fallbacks: [
        { provider: 'cockpit', model: 'gpt-5.6-luna' },
        { provider: '', model: 'x' },
        { provider: 'p' },
        'nope',
        { provider: 'workbuddy-zen', model: 'bai/qwen3.8-flash' },
      ],
    });
    assert.deepEqual(resolved.fallbacks, [
      { provider: 'cockpit', model: 'gpt-5.6-luna' },
      { provider: 'workbuddy-zen', model: 'bai/qwen3.8-flash' },
    ]);
  });

  it('empty tripCodes fall back to defaults', () => {
    const resolved = resolveFullConfig({ tripCodes: [] });
    assert.deepEqual(resolved.tripCodes, [...DEFAULT_TRIP_CODES]);
  });

  it('disabled master switch pauses the engine', () => {
    const resolved = resolveFullConfig({ enabled: false });
    assert.equal(resolved.enabled, false);
    assert.equal(resolved.continue_.paused, true);
  });
});
