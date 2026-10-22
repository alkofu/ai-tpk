import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildResolvedFromSaved, withKnownMcpsOnly } from './resolve.js';
import type { LauncherConfig } from './types.js';

// ---------------------------------------------------------------------------
// withKnownMcpsOnly
// ---------------------------------------------------------------------------

describe('withKnownMcpsOnly', () => {
  it('drops a saved grafana selection, which tpk no longer manages', () => {
    const config: LauncherConfig = {
      selectedMcps: ['grafana', 'cloudwatch', 'kubernetes'],
      cloudwatch: { profile: 'prod' },
    };
    assert.deepStrictEqual(withKnownMcpsOnly(config).selectedMcps, [
      'cloudwatch',
      'kubernetes',
    ]);
  });

  it('keeps every other field and does not mutate its input', () => {
    const config: LauncherConfig = {
      selectedMcps: ['grafana', 'argocd'],
      agent: 'default',
      argocd: { clusterId: 'prod' },
    };
    const copy = JSON.parse(JSON.stringify(config));
    const result = withKnownMcpsOnly(config);
    assert.deepStrictEqual(result, {
      selectedMcps: ['argocd'],
      agent: 'default',
      argocd: { clusterId: 'prod' },
    });
    assert.deepStrictEqual(config, copy);
  });
});

// ---------------------------------------------------------------------------
// buildResolvedFromSaved
// ---------------------------------------------------------------------------

describe('buildResolvedFromSaved', () => {
  it('returns {} when selectedMcps is empty', () => {
    const config: LauncherConfig = { selectedMcps: [] };
    const result = buildResolvedFromSaved(config);
    assert.deepStrictEqual(result, {});
  });

  it('returns { cloudwatch: { profile } } for cloudwatch-only config', () => {
    const config: LauncherConfig = {
      selectedMcps: ['cloudwatch'],
      cloudwatch: { profile: 'my-profile' },
    };
    const result = buildResolvedFromSaved(config);
    assert.deepStrictEqual(result, { cloudwatch: { profile: 'my-profile' } });
  });

  it('returns { gcpObservability: { project } } for gcp-only config', () => {
    const config: LauncherConfig = {
      selectedMcps: ['gcp-observability'],
      gcpObservability: { project: 'my-gcp-project' },
    };
    const result = buildResolvedFromSaved(config);
    assert.deepStrictEqual(result, {
      gcpObservability: { project: 'my-gcp-project' },
    });
  });

  it('returns { kubernetes: { context } } for kubernetes-only config', () => {
    const config: LauncherConfig = {
      selectedMcps: ['kubernetes'],
      kubernetes: { context: 'staging-cluster' },
    };
    const result = buildResolvedFromSaved(config);
    assert.deepStrictEqual(result, {
      kubernetes: { context: 'staging-cluster' },
    });
  });

  it('skips MCPs whose config sub-object is missing', () => {
    const config: LauncherConfig = {
      // cloudwatch in selectedMcps but no cloudwatch sub-object
      selectedMcps: ['cloudwatch', 'kubernetes'],
      kubernetes: { context: 'dev-cluster' },
    };
    const result = buildResolvedFromSaved(config);
    // cloudwatch skipped, kubernetes included
    assert.deepStrictEqual(result, { kubernetes: { context: 'dev-cluster' } });
  });

  it('ignores a saved grafana selection instead of failing to resolve', () => {
    const config: LauncherConfig = {
      selectedMcps: ['grafana', 'kubernetes'],
      kubernetes: { context: 'dev-cluster' },
    };
    const result = buildResolvedFromSaved(config);
    assert.deepStrictEqual(result, { kubernetes: { context: 'dev-cluster' } });
  });

  it('combines multiple MCPs in a single resolved config', () => {
    const config: LauncherConfig = {
      selectedMcps: ['cloudwatch', 'gcp-observability', 'kubernetes'],
      cloudwatch: { profile: 'prod' },
      gcpObservability: { project: 'gcp-prod' },
      kubernetes: { context: 'prod-cluster' },
    };
    const result = buildResolvedFromSaved(config);
    assert.deepStrictEqual(result, {
      cloudwatch: { profile: 'prod' },
      gcpObservability: { project: 'gcp-prod' },
      kubernetes: { context: 'prod-cluster' },
    });
  });
});
