import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildResolvedFromSaved, withKnownMcpsOnly } from './resolve.js';
import type { LauncherConfig } from './types.js';

// ---------------------------------------------------------------------------
// withKnownMcpsOnly
// ---------------------------------------------------------------------------

describe('withKnownMcpsOnly', () => {
  it('drops saved grafana, argocd and kubernetes selections, which tpk no longer manages', () => {
    const config: LauncherConfig = {
      selectedMcps: [
        'grafana',
        'cloudwatch',
        'argocd',
        'kubernetes',
        'gcp-observability',
      ],
      cloudwatch: { profile: 'prod' },
    };
    assert.deepStrictEqual(withKnownMcpsOnly(config).selectedMcps, [
      'cloudwatch',
      'gcp-observability',
    ]);
  });

  it('keeps every other field and does not mutate its input', () => {
    const config: LauncherConfig = {
      selectedMcps: ['grafana', 'kubernetes', 'cloudwatch'],
      agent: 'default',
      cloudwatch: { profile: 'prod' },
    };
    const copy = JSON.parse(JSON.stringify(config));
    const result = withKnownMcpsOnly(config);
    assert.deepStrictEqual(result, {
      selectedMcps: ['cloudwatch'],
      agent: 'default',
      cloudwatch: { profile: 'prod' },
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

  it('skips MCPs whose config sub-object is missing', () => {
    const config: LauncherConfig = {
      // cloudwatch in selectedMcps but no cloudwatch sub-object
      selectedMcps: ['cloudwatch', 'gcp-observability'],
      gcpObservability: { project: 'gcp-dev' },
    };
    const result = buildResolvedFromSaved(config);
    // cloudwatch skipped, gcp-observability included
    assert.deepStrictEqual(result, {
      gcpObservability: { project: 'gcp-dev' },
    });
  });

  it('ignores saved grafana, argocd and kubernetes selections instead of failing to resolve', () => {
    const config: LauncherConfig = {
      selectedMcps: ['grafana', 'argocd', 'kubernetes', 'cloudwatch'],
      cloudwatch: { profile: 'dev' },
    };
    const result = buildResolvedFromSaved(config);
    assert.deepStrictEqual(result, { cloudwatch: { profile: 'dev' } });
  });

  it('combines multiple MCPs in a single resolved config', () => {
    const config: LauncherConfig = {
      selectedMcps: ['cloudwatch', 'gcp-observability'],
      cloudwatch: { profile: 'prod' },
      gcpObservability: { project: 'gcp-prod' },
    };
    const result = buildResolvedFromSaved(config);
    assert.deepStrictEqual(result, {
      cloudwatch: { profile: 'prod' },
      gcpObservability: { project: 'gcp-prod' },
    });
  });
});
