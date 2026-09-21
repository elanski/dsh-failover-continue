/**
 * Revert-home decision tests: only sessions sitting where OUR walk put them
 * return home; manual picker choices are never touched.
 * Run: node --test --experimental-strip-types tests/revert.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { revertDecision } from '../src/circuit.ts';

const HOME = { provider: 'workbuddy-zen', model: 'cline/z-ai/glm-5.3-flash' };
const LUNA = { provider: 'cockpit', model: 'gpt-5.6-luna' };
const BAI = { provider: 'workbuddy-zen', model: 'bai/qwen3.8-flash' };

describe('revertDecision', () => {
  it('reverts a session left on our walk target when home is healthy', () => {
    assert.equal(
      revertDecision({ primary: LUNA, home: HOME, trailLast: LUNA, homeOpen: false }),
      true,
    );
  });

  it('never touches a manual picker choice (primary diverged from trail)', () => {
    assert.equal(
      revertDecision({ primary: BAI, home: HOME, trailLast: LUNA, homeOpen: false }),
      false,
    );
  });

  it('does nothing without a walk trail', () => {
    assert.equal(
      revertDecision({ primary: LUNA, home: HOME, trailLast: undefined, homeOpen: false }),
      false,
    );
  });

  it('does nothing when already home or home is open', () => {
    assert.equal(
      revertDecision({ primary: HOME, home: HOME, trailLast: LUNA, homeOpen: false }),
      false,
    );
    assert.equal(
      revertDecision({ primary: LUNA, home: HOME, trailLast: LUNA, homeOpen: true }),
      false,
    );
  });
});
