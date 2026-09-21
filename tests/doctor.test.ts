/**
 * Doctor probe classification tests (pure, no host needed).
 * Run: node --test --experimental-strip-types tests/doctor.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyProbeError } from '../src/doctor.ts';

describe('classifyProbeError', () => {
  it('maps transport and rate failures', () => {
    assert.equal(classifyProbeError('429 rate limited, retry in 60s').code, 'RATE_LIMIT');
    assert.equal(classifyProbeError('fetch failed: ECONNRESET').code, 'TRANSPORT');
    assert.equal(classifyProbeError('pi-ai stream idle timeout after 30000ms').code, 'TRANSPORT');
  });

  it('maps auth, quota and server failures', () => {
    assert.equal(classifyProbeError('401 invalid api key').code, 'AUTH');
    assert.equal(classifyProbeError('403 status code (no body)').code, 'AUTH');
    assert.equal(classifyProbeError('insufficient balance').code, 'QUOTA');
    assert.equal(classifyProbeError('503 auth_unavailable').code, 'SERVER');
    assert.equal(classifyProbeError('500 internal server error').code, 'SERVER');
  });

  it('falls back to PI_AI_ERROR with the message preserved', () => {
    const result = classifyProbeError('weird gateway hiccup');
    assert.equal(result.code, 'PI_AI_ERROR');
    assert.ok(result.error.includes('hiccup'));
  });
});
