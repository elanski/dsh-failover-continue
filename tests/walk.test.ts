/**
 * Failure walk with the new chain order (cockpit first).
 * glm TIMEOUT → cockpit → cockpit dies → bai → bai dies (+platform) → primary.
 * Plus: 429 "retry in ~1h" parks the route for ~1h (the old 60s starved the tail).
 * Run: node --test --experimental-strip-types tests/walk.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker } from '../src/circuit.ts';
import { resolveFullConfig } from '../src/index.ts';

function liveBreaker(at = 1_000_000) {
  let now = at;
  const resolved = resolveFullConfig({
    fallbacks: [
      { provider: 'cockpit', model: 'gpt-5.6-luna' },
      { provider: 'workbuddy-zen', model: 'bai/qwen3.8-flash' },
      { provider: 'workbuddy-zen', model: 'deepseek-v4.1-flash' },
    ],
    modelCircuitThreshold: 1,
    modelCooldownMs: 3_600_000,
  });
  const breaker = new CircuitBreaker({
    modelCircuitThreshold: resolved.modelCircuitThreshold,
    modelCooldownMs: resolved.modelCooldownMs,
    platformCircuitThreshold: resolved.platformCircuitThreshold,
    platformCooldownMs: resolved.platformCooldownMs,
    burstWindowMs: resolved.burstWindowMs,
    now: () => now,
  });
  return { breaker, fallbacks: resolved.fallbacks, advance: (ms: number) => { now += ms; } };
}

describe('ordered walk with platform fencing', () => {
  it('glm → cockpit → bai → primary when the provider trips', () => {
    const { breaker, fallbacks } = liveBreaker();
    const primary = { provider: 'workbuddy-zen', model: 'cline/z-ai/glm-5.3-flash' };

    breaker.recordFailure(primary.provider, primary.model); // TIMEOUT
    assert.deepEqual(breaker.routeFor(primary, fallbacks), fallbacks[0], 'glm must leave on first failure');

    breaker.recordFailure('cockpit', 'gpt-5.6-luna'); // cockpit down
    assert.deepEqual(
      breaker.routeFor(primary, fallbacks),
      { provider: 'workbuddy-zen', model: 'bai/qwen3.8-flash' },
      'one cockpit failure must not fence the provider (threshold 2)',
    );

    breaker.recordFailure('workbuddy-zen', 'bai/qwen3.8-flash'); // + platform trips (glm, bai)
    assert.deepEqual(
      breaker.routeFor(primary, fallbacks),
      primary,
      'fenced provider + dead cockpit must surface the primary, not hang',
    );
  });

  it('429 with Retry-After parks the route for ~1h (no tail starvation)', () => {
    const { breaker, fallbacks, advance } = liveBreaker();
    const primary = { provider: 'workbuddy-zen', model: 'deepseek-v4.1-flash' };
    breaker.recordFailure(primary.provider, primary.model, 3_594_000);
    advance(59 * 60_000);
    const target = breaker.routeFor(primary, fallbacks);
    assert.notDeepEqual(target, primary, 'dead primary must not be re-picked after 59 minutes');
    assert.equal(target.provider, 'cockpit');
  });

  it('AUTH opens the route so the engine may continue elsewhere (FR-3)', () => {
    const { breaker, fallbacks } = liveBreaker();
    const primary = { provider: 'workbuddy-zen', model: 'deepseek-v4.1-flash' };
    assert.equal(breaker.recordFailure(primary.provider, primary.model), 'model');
    assert.ok(breaker.hasHealthyFallback(fallbacks));
    assert.deepEqual(breaker.routeFor(primary, fallbacks), fallbacks[0]);
  });
});
