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

  it('returns correct line for argocd with clusterId', () => {
    const config: LauncherConfig = {
      selectedMcps: ['argocd'],
      argocd: { clusterId: 'prod-eu' },
    };
    assert.deepStrictEqual(formatSummaryLines(config), [
      'ArgoCD: cluster prod-eu',
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

  it('returns correct line for kubernetes with context', () => {
    const config: LauncherConfig = {
      selectedMcps: ['kubernetes'],
      kubernetes: { context: 'staging-cluster' },
    };
    assert.deepStrictEqual(formatSummaryLines(config), [
      'Kubernetes: context staging-cluster',
    ]);
  });

  it('returns one line per MCP in order when multiple MCPs are selected', () => {
    const config: LauncherConfig = {
      selectedMcps: ['cloudwatch', 'kubernetes'],
      cloudwatch: { profile: 'dev' },
      kubernetes: { context: 'dev-cluster' },
    };
    assert.deepStrictEqual(formatSummaryLines(config), [
      'CloudWatch: profile dev',
      'Kubernetes: context dev-cluster',
    ]);
  });

  it("returns '(not yet configured)' when argocd is in selectedMcps but sub-object is missing", () => {
    const config: LauncherConfig = { selectedMcps: ['argocd'] };
    assert.deepStrictEqual(formatSummaryLines(config), [
      'ArgoCD: (not yet configured)',
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

  it("returns '(not yet configured)' when kubernetes is in selectedMcps but sub-object is missing", () => {
    const config: LauncherConfig = { selectedMcps: ['kubernetes'] };
    assert.deepStrictEqual(formatSummaryLines(config), [
      'Kubernetes: (not yet configured)',
    ]);
  });

  it('returns four correct lines when all four MCPs are configured', () => {
    const config: LauncherConfig = {
      selectedMcps: ['cloudwatch', 'gcp-observability', 'kubernetes', 'argocd'],
      cloudwatch: { profile: 'prod' },
      gcpObservability: { project: 'gcp-prod' },
      kubernetes: { context: 'prod-cluster' },
      argocd: { clusterId: 'prod-us' },
    };
    assert.deepStrictEqual(formatSummaryLines(config), [
      'CloudWatch: profile prod',
      'GCP Observability: project gcp-prod',
      'Kubernetes: context prod-cluster',
      'ArgoCD: cluster prod-us',
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
      selectedMcps: ['cloudwatch', 'future-mcp', 'kubernetes'],
      cloudwatch: { profile: 'staging' },
      kubernetes: { context: 'staging-cluster' },
    };
    assert.deepStrictEqual(formatSummaryLines(config), [
      'CloudWatch: profile staging',
      'future-mcp: (unknown MCP)',
      'Kubernetes: context staging-cluster',
    ]);
  });
});
