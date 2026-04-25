import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Step 7: initialValue staleness guard logic (Finding 7)
//
// These tests verify the staleness guard expressions that will be used in
// configureCloudWatch, configureGrafana, and configureKubernetes.
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

// Grafana pattern: previousId && list.some(c => c.id === previousId) ? previousId : list[0]?.id
function resolveGrafanaDefault(
  ids: string[],
  previous?: string,
): string | undefined {
  return previous && ids.includes(previous) ? previous : ids[0];
}

// Kubernetes pattern: (previous && list.includes(previous)) ? previous : (currentContext || list[0])
function resolveKubernetesDefault(
  list: string[],
  previous?: string,
  currentContext: string = '',
): string | undefined {
  return previous && list.includes(previous)
    ? previous
    : currentContext || list[0];
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

describe('Grafana initialValue staleness guard', () => {
  it('returns previousClusterId when it exists in the list', () => {
    assert.strictEqual(
      resolveGrafanaDefault(['prod', 'staging', 'dev'], 'staging'),
      'staging',
    );
  });

  it('returns first cluster id when previousClusterId is not in the list (stale)', () => {
    assert.strictEqual(
      resolveGrafanaDefault(['prod', 'staging'], 'deleted-cluster'),
      'prod',
    );
  });

  it('returns first cluster id when previousClusterId is undefined', () => {
    assert.strictEqual(
      resolveGrafanaDefault(['prod', 'staging'], undefined),
      'prod',
    );
  });
});

describe('Kubernetes initialValue staleness guard', () => {
  it('returns previousContext when it exists in the list', () => {
    assert.strictEqual(
      resolveKubernetesDefault(['prod', 'staging', 'dev'], 'staging', 'dev'),
      'staging',
    );
  });

  it('returns currentContext when previousContext is stale and currentContext is in the list', () => {
    assert.strictEqual(
      resolveKubernetesDefault(['prod', 'staging'], 'old-context', 'staging'),
      'staging',
    );
  });

  it('returns first context when both previousContext is stale and currentContext is empty', () => {
    assert.strictEqual(
      resolveKubernetesDefault(['prod', 'staging'], 'old-context', ''),
      'prod',
    );
  });

  it('returns first context when previousContext is undefined and currentContext is empty', () => {
    assert.strictEqual(
      resolveKubernetesDefault(['prod', 'staging'], undefined, ''),
      'prod',
    );
  });
});
