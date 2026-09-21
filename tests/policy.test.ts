/**
 * Policy-refusal classification tests.
 * Run: node --test --experimental-strip-types tests/policy.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPolicyRefusal, isTransientFailure } from '../src/continue-core.ts';

const POLICY_MSG =
  '{"error":{"type":"invalid_request_error","code":"invalid_prompt","message":"Invalid prompt: your prompt was flagged as potentially violating our usage policy. Please try again with a different prompt"}}';

describe('isPolicyRefusal', () => {
  it('catches moderation wordings', () => {
    assert.equal(isPolicyRefusal(POLICY_MSG), true);
    assert.equal(isPolicyRefusal('content_policy violation'), true);
    assert.equal(isPolicyRefusal('moderation failed'), true);
  });

  it('ignores ordinary failures', () => {
    assert.equal(isPolicyRefusal('429 rate limited, retry in 60s'), false);
    assert.equal(isPolicyRefusal('504 upstream timed out'), false);
    assert.equal(isPolicyRefusal('401 invalid api key'), false);
  });

  it('policy refusals are not transient (no auto-continue storms)', () => {
    assert.equal(
      isTransientFailure({ code: 'INVALID_REQUEST', message: POLICY_MSG }),
      false,
    );
  });
});
