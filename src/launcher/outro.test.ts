import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildOutroLines } from './outro.js';
import type { ResolvedConfig, SkippedMap } from './types.js';

describe('buildOutroLines', () => {
  it('(a) returns two success lines in canonical order when all MCPs are configured and none are skipped', () => {
    const resolved: ResolvedConfig = {
      cloudwatch: { profile: 'my-aws-profile' },
      gcpObservability: { project: 'my-gcp-project' },
    };
    const effectiveSkipped: SkippedMap = {};

    const lines = buildOutroLines(resolved, effectiveSkipped);

    assert.deepStrictEqual(lines, [
      'CloudWatch: my-aws-profile',
      'GCP Observability: my-gcp-project',
    ]);
  });

  it('(b) returns two skip lines in canonical order when all MCPs are skipped via loader failure', () => {
    const resolved: ResolvedConfig = {};
    const effectiveSkipped: SkippedMap = {
      cloudwatch: 'loader-failed',
      gcp: 'loader-failed',
    };

    const lines = buildOutroLines(resolved, effectiveSkipped);

    assert.deepStrictEqual(lines, [
      'CloudWatch: skipped (profiles unavailable)',
      'GCP Observability: skipped (auth unavailable)',
    ]);
  });

  it('(c) returns only the GCP Observability skip line when only GCP is skipped via loader failure', () => {
    const resolved: ResolvedConfig = {};
    const effectiveSkipped: SkippedMap = { gcp: 'loader-failed' };

    const lines = buildOutroLines(resolved, effectiveSkipped);

    assert.deepStrictEqual(lines, [
      'GCP Observability: skipped (auth unavailable)',
    ]);
  });

  it('(d) emits only the skip line even when resolved.cloudwatch is set (regression test for F-1)', () => {
    const resolved: ResolvedConfig = {
      cloudwatch: { profile: 'my-aws-profile' },
    };
    const effectiveSkipped: SkippedMap = { cloudwatch: 'loader-failed' };

    const lines = buildOutroLines(resolved, effectiveSkipped);

    assert.deepStrictEqual(lines, [
      'CloudWatch: skipped (profiles unavailable)',
    ]);
    // Critically: no success line for the set cloudwatch profile must appear.
    assert.ok(
      !lines.some((l) => l.startsWith('CloudWatch: my-aws-profile')),
      'must not emit a success line alongside the skip line',
    );
  });

  it('(e) emits success lines first then skip lines, both in canonical MCP order', () => {
    // buildOutroLines emits all success lines first (canonical order), then all
    // skip lines (same canonical order). GCP has no resolved value here so it
    // only appears as a skip line — after the CloudWatch success line.
    const resolved: ResolvedConfig = {
      cloudwatch: { profile: 'my-aws-profile' },
    };
    const effectiveSkipped: SkippedMap = { gcp: 'loader-failed' };

    const lines = buildOutroLines(resolved, effectiveSkipped);

    assert.deepStrictEqual(lines, [
      'CloudWatch: my-aws-profile',
      'GCP Observability: skipped (auth unavailable)',
    ]);
  });

  it('(e2) success lines precede skip lines even when the skipped MCP ranks before the resolved one in canonical order', () => {
    // CloudWatch is skipped (1st in canonical order); GCP resolves (2nd).
    // "All-successes-first" → ["GCP Observability: ...", "CloudWatch: skipped (...)"].
    // "Per-MCP-interleaved" would produce the opposite order.
    // This test distinguishes the two models.
    const resolved: ResolvedConfig = {
      gcpObservability: { project: 'my-gcp-project' },
    };
    const effectiveSkipped: SkippedMap = { cloudwatch: 'loader-failed' };

    const lines = buildOutroLines(resolved, effectiveSkipped);

    assert.deepStrictEqual(lines, [
      'GCP Observability: my-gcp-project',
      'CloudWatch: skipped (profiles unavailable)',
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
    // effectiveSkipped.cloudwatch === false must NOT suppress the success line.
    // Only truthy discriminants suppress the success line.
    const resolved: ResolvedConfig = {
      cloudwatch: { profile: 'my-aws-profile' },
    };
    const effectiveSkipped: SkippedMap = { cloudwatch: false };

    const lines = buildOutroLines(resolved, effectiveSkipped);

    assert.deepStrictEqual(lines, ['CloudWatch: my-aws-profile']);
  });
});
