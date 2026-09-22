/**
 * Priority step-up tests: sessions on OUR walk trail return toward the list
 * head when healthier routes recover; anything else is untouched.
 * Run: node --test --experimental-strip-types tests/stepup.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stepUpIndex } from '../src/circuit.ts';

describe('stepUpIndex', () => {
  it('returns the first healthy position above', () => {
    // [glm ok, deepseek parked, bai ok], from bai(2) -> glm(0)
    assert.equal(stepUpIndex(2, (i) => i !== 1), 0);
    // all above parked -> -1
    assert.equal(stepUpIndex(2, () => false), -1);
    // already at head -> -1
    assert.equal(stepUpIndex(0, () => true), -1);
  });

  it('skips parked routes above', () => {
    // [glm parked, deepseek ok, bai ...], from tail(2) -> deepseek(1)
    assert.equal(stepUpIndex(2, (i) => i === 1), 1);
  });
});
