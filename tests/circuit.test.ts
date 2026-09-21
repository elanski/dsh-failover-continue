/**
 * Unit tests for the two-level circuit breaker.
 * Run: node --test --experimental-strip-types tests/circuit.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker } from '../src/circuit.ts';

function breakerAt(t0 = 1_000_000) {
  let now = t0;
  const breaker = new CircuitBreaker({
    modelCircuitThreshold: 1,
    modelCooldownMs: 3_600_000,
    platformCircuitThreshold: 2,
    platformCooldownMs: 120_000,
    burstWindowMs: 900_000,
    now: () => now,
  });
  return { breaker, advance: (ms: number) => { now += ms; }, clock: () => now };
}

describe('threshold 1 opens on the first failure', () => {
  it('routes to the first healthy fallback on the next request', () => {
    const { breaker } = breakerAt();
    const primary = { provider: 'workbuddy-zen', model: 'deepseek-v4.1-flash' };
    const fallbacks = [
      { provider: 'cockpit', model: 'gpt-5.6-luna' },
      { provider: 'workbuddy-zen', model: 'bai/qwen3.8-flash' },
    ];
    assert.deepEqual(breaker.routeFor(primary, fallbacks), primary);
    const level = breaker.recordFailure(primary.provider, primary.model);
    assert.equal(level, 'model');
    assert.deepEqual(breaker.routeFor(primary, fallbacks), fallbacks[0]);
  });
});

describe('retryAfterMs extends the hold', () => {
  it('honours "retry in 3594s" instead of the 60s default', () => {
    const { breaker, advance, clock } = breakerAt();
    const until = breaker.recordFailure('workbuddy-zen', 'deepseek-v4.1-flash', 3_594_000);
    assert.equal(until, 'model');
    advance(3_600_000 - 1);
    assert.equal(breaker.isOpen('workbuddy-zen', 'deepseek-v4.1-flash'), true);
    advance(2);
    assert.equal(breaker.isOpen('workbuddy-zen', 'deepseek-v4.1-flash'), false);
    assert.ok(clock() > 0);
  });
});

describe('platform circuit', () => {
  it('opens the provider after two distinct models fail', () => {
    const { breaker } = breakerAt();
    assert.equal(breaker.recordFailure('workbuddy-zen', 'a'), 'model');
    assert.equal(breaker.recordFailure('workbuddy-zen', 'b'), 'platform');
    // A never-failed third model of the same provider is fenced off too.
    assert.equal(breaker.isOpen('workbuddy-zen', 'c'), true);
    assert.equal(breaker.hasHealthyFallback([{ provider: 'workbuddy-zen', model: 'c' }]), false);
    assert.equal(breaker.hasHealthyFallback([{ provider: 'cockpit', model: 'x' }]), true);
  });
});

describe('all open returns primary', () => {
  it('surfaces the real failure instead of a silent dead end', () => {
    const { breaker } = breakerAt();
    const primary = { provider: 'p', model: 'm' };
    const fallbacks = [{ provider: 'q', model: 'n' }];
    breaker.recordFailure('p', 'm');
    breaker.recordFailure('q', 'n');
    assert.deepEqual(breaker.routeFor(primary, fallbacks), primary);
  });
});

describe('burst window', () => {
  it('an old failure starts a fresh burst with threshold 2', () => {
    let now = 0;
    const breaker = new CircuitBreaker({
      modelCircuitThreshold: 2,
      modelCooldownMs: 60_000,
      platformCircuitThreshold: 9,
      platformCooldownMs: 60_000,
      burstWindowMs: 1_000,
      now: () => now,
    });
    assert.equal(breaker.recordFailure('p', 'm'), undefined);
    now += 5_000; // outside the window: counter resets
    assert.equal(breaker.recordFailure('p', 'm'), undefined);
    assert.equal(breaker.isOpen('p', 'm'), false);
    now += 10; // inside the window: second strike opens
    assert.equal(breaker.recordFailure('p', 'm'), 'model');
    assert.equal(breaker.isOpen('p', 'm'), true);
  });
});
