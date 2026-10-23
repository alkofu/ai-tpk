import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatSummaryLines } from './summary.js';
import type { LauncherConfig } from './types.js';

// ---------------------------------------------------------------------------
// formatSummaryLines
// ---------------------------------------------------------------------------

describe('formatSummaryLines', () => {
  it("returns ['No MCPs configured.'] when selectedMcps is empty", () => {
    const config: LauncherConfig = { selectedMcps: [] };
    assert.deepStrictEqual(formatSummaryLines(config), ['No MCPs configured.']);
  });

  it('returns correct line for cloudwatch with profile', () => {
    const config: LauncherConfig = {
      selectedMcps: ['cloudwatch'],
      cloudwatch: { profile: 'prod' },
    };
    assert.deepStrictEqual(formatSummaryLines(config), [
      'CloudWatch: profile prod',
    ]);
  });

  it('returns correct line for gcp-observability with project', () => {
    const config: LauncherConfig = {
      selectedMcps: ['gcp-observability'],
      gcpObservability: { project: 'my-project' },
    };
    assert.deepStrictEqual(formatSummaryLines(config), [
      'GCP Observability: project my-project',
    ]);
  });

  it('returns one line per MCP in order when multiple MCPs are selected', () => {
    const config: LauncherConfig = {
      selectedMcps: ['gcp-observability', 'cloudwatch'],
      cloudwatch: { profile: 'dev' },
      gcpObservability: { project: 'gcp-dev' },
    };
    assert.deepStrictEqual(formatSummaryLines(config), [
      'GCP Observability: project gcp-dev',
      'CloudWatch: profile dev',
    ]);
  });

  it("returns '(not yet configured)' when cloudwatch is in selectedMcps but sub-object is missing", () => {
    const config: LauncherConfig = { selectedMcps: ['cloudwatch'] };
    assert.deepStrictEqual(formatSummaryLines(config), [
      'CloudWatch: (not yet configured)',
    ]);
  });

  it("returns '(not yet configured)' when gcp-observability is in selectedMcps but sub-object is missing", () => {
    const config: LauncherConfig = { selectedMcps: ['gcp-observability'] };
    assert.deepStrictEqual(formatSummaryLines(config), [
      'GCP Observability: (not yet configured)',
    ]);
  });

  it('returns two correct lines when both MCPs are configured', () => {
    const config: LauncherConfig = {
      selectedMcps: ['cloudwatch', 'gcp-observability'],
      cloudwatch: { profile: 'prod' },
      gcpObservability: { project: 'gcp-prod' },
    };
    assert.deepStrictEqual(formatSummaryLines(config), [
      'CloudWatch: profile prod',
      'GCP Observability: project gcp-prod',
    ]);
  });

  it("returns '<name>: (unknown MCP)' for an unknown MCP name", () => {
    const config: LauncherConfig = { selectedMcps: ['future-mcp'] };
    assert.deepStrictEqual(formatSummaryLines(config), [
      'future-mcp: (unknown MCP)',
    ]);
  });

  it('handles a mix of known and unknown MCP names correctly', () => {
    const config: LauncherConfig = {
      selectedMcps: ['cloudwatch', 'future-mcp', 'gcp-observability'],
      cloudwatch: { profile: 'staging' },
      gcpObservability: { project: 'gcp-staging' },
    };
    assert.deepStrictEqual(formatSummaryLines(config), [
      'CloudWatch: profile staging',
      'future-mcp: (unknown MCP)',
      'GCP Observability: project gcp-staging',
    ]);
  });
});
