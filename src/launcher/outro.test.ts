import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildOutroLines } from './outro.js';
import type { ResolvedConfig, SkippedMap } from './types.js';

describe('buildOutroLines', () => {
  it('(a) returns four success lines in canonical order when all MCPs are configured and none are skipped', () => {
    const resolved: ResolvedConfig = {
      grafana: {
        cluster: {
          id: 'prod-us-east',
          name: 'Production US-East',
          url: 'https://grafana.prod.example.com',
          viewer_token: 'viewer-token',
          editor_token: 'editor-token',
        },
        role: 'viewer',
      },
      cloudwatch: { profile: 'my-aws-profile' },
      gcpObservability: { project: 'my-gcp-project' },
      kubernetes: { context: 'prod-us-east' },
    };
    const effectiveSkipped: SkippedMap = {};

    const lines = buildOutroLines(resolved, effectiveSkipped);

    assert.deepStrictEqual(lines, [
      'Grafana: Production US-East (viewer)',
      'CloudWatch: my-aws-profile',
      'GCP Observability: my-gcp-project',
      'Kubernetes: prod-us-east',
    ]);
  });

  it('(b) returns four skip lines in canonical order when all MCPs are skipped via loader failure', () => {
    const resolved: ResolvedConfig = {};
    const effectiveSkipped: SkippedMap = {
      grafana: 'loader-failed',
      cloudwatch: 'loader-failed',
      gcp: 'loader-failed',
      kubernetes: 'loader-failed',
    };

    const lines = buildOutroLines(resolved, effectiveSkipped);

    assert.deepStrictEqual(lines, [
      'Grafana: skipped (clusters unavailable)',
      'CloudWatch: skipped (profiles unavailable)',
      'GCP Observability: skipped (auth unavailable)',
      'Kubernetes: skipped (contexts unavailable)',
    ]);
  });

  it('(c) returns only the Kubernetes skip line when only Kubernetes is skipped via loader failure', () => {
    const resolved: ResolvedConfig = {};
    const effectiveSkipped: SkippedMap = { kubernetes: 'loader-failed' };

    const lines = buildOutroLines(resolved, effectiveSkipped);

    assert.deepStrictEqual(lines, [
      'Kubernetes: skipped (contexts unavailable)',
    ]);
  });

  it('(d) emits only the switch-failed skip line even when resolved.kubernetes is set (regression test for F-1)', () => {
    const resolved: ResolvedConfig = {
      kubernetes: { context: 'prod-us-east' },
    };
    const effectiveSkipped: SkippedMap = { kubernetes: 'switch-failed' };

    const lines = buildOutroLines(resolved, effectiveSkipped);

    assert.deepStrictEqual(lines, [
      'Kubernetes: skipped (context switch failed)',
    ]);
    // Critically: no success line for the set kubernetes context must appear.
    assert.ok(
      !lines.some((l) => l.startsWith('Kubernetes: prod-us-east')),
      'must not emit a success line alongside the skip line',
    );
  });

  it('(e) emits all success lines first then all skip lines, both in canonical MCP order', () => {
    // buildOutroLines emits all success lines first (canonical order), then all
    // skip lines (same canonical order). CloudWatch has no resolved value here
    // so it only appears as a skip line — after the three success lines.
    const resolved: ResolvedConfig = {
      grafana: {
        cluster: {
          id: 'prod-us-east',
          name: 'Production US-East',
          url: 'https://grafana.prod.example.com',
          viewer_token: 'viewer-token',
          editor_token: 'editor-token',
        },
        role: 'viewer',
      },
      gcpObservability: { project: 'my-gcp-project' },
      kubernetes: { context: 'prod-us-east' },
    };
    const effectiveSkipped: SkippedMap = { cloudwatch: 'loader-failed' };

    const lines = buildOutroLines(resolved, effectiveSkipped);

    assert.deepStrictEqual(lines, [
      'Grafana: Production US-East (viewer)',
      'GCP Observability: my-gcp-project',
      'Kubernetes: prod-us-east',
      'CloudWatch: skipped (profiles unavailable)',
    ]);
  });

  it('(e2) success lines precede skip lines even when the skipped MCP ranks before the resolved one in canonical order', () => {
    // Grafana is skipped (1st in canonical order); CloudWatch resolves (2nd).
    // "All-successes-first" → ["CloudWatch: ...", "Grafana: skipped (...)"].
    // "Per-MCP-interleaved" would produce the opposite: ["Grafana: skipped...", "CloudWatch: ..."].
    // This test distinguishes the two models.
    const resolved: ResolvedConfig = {
      cloudwatch: { profile: 'my-aws-profile' },
    };
    const effectiveSkipped: SkippedMap = { grafana: 'loader-failed' };

    const lines = buildOutroLines(resolved, effectiveSkipped);

    assert.deepStrictEqual(lines, [
      'CloudWatch: my-aws-profile',
      'Grafana: skipped (clusters unavailable)',
    ]);
  });

  it('(f) returns empty array when no MCPs are configured and none are skipped', () => {
    const resolved: ResolvedConfig = {};
    const effectiveSkipped: SkippedMap = {};

    const lines = buildOutroLines(resolved, effectiveSkipped);

    // The "No MCPs configured" fallback message is launchClaude's responsibility
    // (see main.ts lines 56–58); buildOutroLines itself returns an empty array.
    assert.deepStrictEqual(lines, []);
  });

  it('(g) renders success line when effectiveSkipped.<mcp> is false', () => {
    // effectiveSkipped.grafana === false must NOT suppress the success line.
    // Only truthy discriminants suppress the success line.
    const resolved: ResolvedConfig = {
      grafana: {
        cluster: {
          id: 'prod-us-east',
          name: 'Production US-East',
          url: 'https://grafana.prod.example.com',
          viewer_token: 'viewer-token',
          editor_token: 'editor-token',
        },
        role: 'viewer',
      },
    };
    const effectiveSkipped: SkippedMap = { grafana: false };

    const lines = buildOutroLines(resolved, effectiveSkipped);

    assert.deepStrictEqual(lines, ['Grafana: Production US-East (viewer)']);
  });
});
