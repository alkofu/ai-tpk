import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Step 7: initialValue staleness guard logic (Finding 7)
//
// These tests verify the staleness guard expressions that will be used in
// configureCloudWatch and configureGcpObservability.
// They test the logic inline without extracting a shared helper, matching
// the inline approach prescribed by the plan.
// ---------------------------------------------------------------------------

// CloudWatch / GCP pattern: previousValue && list.includes(previousValue) ? previousValue : list[0]
function resolveStringDefault(
  list: string[],
  previous?: string,
): string | undefined {
  return previous && list.includes(previous) ? previous : list[0];
}

describe('CloudWatch initialValue staleness guard', () => {
  it('returns previousProfile when it exists in the list', () => {
    assert.strictEqual(
      resolveStringDefault(['default', 'dev', 'prod'], 'dev'),
      'dev',
    );
  });

  it('returns first profile when previousProfile is not in the list (stale)', () => {
    assert.strictEqual(
      resolveStringDefault(['default', 'dev', 'prod'], 'old-profile'),
      'default',
    );
  });

  it('returns first profile when previousProfile is undefined', () => {
    assert.strictEqual(
      resolveStringDefault(['default', 'dev'], undefined),
      'default',
    );
  });
});
