/**
 * Behavioural-equivalence tests for the McpCommand registry.
 *
 * These tests verify that iterating the registry and calling each command's
 * methods produces exactly the same output as the current orchestration
 * functions (buildEnvVars, buildOutroLines, formatSummaryLines). They use the
 * same fixtures as the existing test files as the comparison oracle.
 *
 * At the end of Step 2 these tests FAIL because the registry is empty. They
 * become passing after Steps 3 and 5 populate the registry and wire the
 * orchestration files to use it.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { registry } from './mcp-command.js';
import { buildEnvVars } from './env.js';
import { buildOutroLines } from './outro.js';
import { formatSummaryLines } from './summary.js';
import type {
  ResolvedConfig,
  SkippedMap,
  LauncherConfig,
  GrafanaCluster,
} from './types.js';

// ---------------------------------------------------------------------------
// Dotfile isolation (mirrors env.test.ts strategy)
// ---------------------------------------------------------------------------

const dotfileDir = path.join(os.homedir(), '.claude');
const dotfilePath = path.join(dotfileDir, '.current-aws-profile');
const gcpDotfilePath = path.join(dotfileDir, '.current-gcp-project');
const kubeDotfilePath = path.join(dotfileDir, '.current-kube-context');
const argocdDotfilePath = path.join(dotfileDir, '.current-argocd-cluster');

let priorDotfileContent: string | null = null;
let priorGcpDotfileContent: string | null = null;
let priorKubeDotfileContent: string | null = null;
let priorArgoCdDotfileContent: string | null = null;

before(() => {
  if (fs.existsSync(dotfilePath)) {
    priorDotfileContent = fs.readFileSync(dotfilePath, 'utf8');
  }
  if (fs.existsSync(gcpDotfilePath)) {
    priorGcpDotfileContent = fs.readFileSync(gcpDotfilePath, 'utf8');
  }
  if (fs.existsSync(kubeDotfilePath)) {
    priorKubeDotfileContent = fs.readFileSync(kubeDotfilePath, 'utf8');
  }
  if (fs.existsSync(argocdDotfilePath)) {
    priorArgoCdDotfileContent = fs.readFileSync(argocdDotfilePath, 'utf8');
  }
});

after(() => {
  if (priorDotfileContent !== null) {
    fs.mkdirSync(dotfileDir, { recursive: true });
    fs.writeFileSync(dotfilePath, priorDotfileContent, {
      mode: 0o600,
      encoding: 'utf8',
    });
  } else if (fs.existsSync(dotfilePath)) {
    fs.rmSync(dotfilePath);
  }

  if (priorGcpDotfileContent !== null) {
    fs.mkdirSync(dotfileDir, { recursive: true });
    fs.writeFileSync(gcpDotfilePath, priorGcpDotfileContent, {
      mode: 0o600,
      encoding: 'utf8',
    });
  } else if (fs.existsSync(gcpDotfilePath)) {
    fs.rmSync(gcpDotfilePath);
  }

  if (priorKubeDotfileContent !== null) {
    fs.mkdirSync(dotfileDir, { recursive: true });
    fs.writeFileSync(kubeDotfilePath, priorKubeDotfileContent, {
      mode: 0o600,
      encoding: 'utf8',
    });
  } else if (fs.existsSync(kubeDotfilePath)) {
    fs.rmSync(kubeDotfilePath);
  }

  if (priorArgoCdDotfileContent !== null) {
    fs.mkdirSync(dotfileDir, { recursive: true });
    fs.writeFileSync(argocdDotfilePath, priorArgoCdDotfileContent, {
      mode: 0o600,
      encoding: 'utf8',
    });
  } else if (fs.existsSync(argocdDotfilePath)) {
    fs.rmSync(argocdDotfilePath);
  }
});

// ---------------------------------------------------------------------------
// Fixtures (mirrors env.test.ts and outro.test.ts)
// ---------------------------------------------------------------------------

const fakeCluster: GrafanaCluster = {
  id: 'test-cluster',
  name: 'Test Cluster',
  url: 'https://grafana.test.example.com',
  viewer_token: 'viewer-token-abc',
  editor_token: 'editor-token-xyz',
};

const allMcpsResolved: ResolvedConfig = {
  grafana: { cluster: fakeCluster, role: 'viewer' },
  cloudwatch: { profile: 'my-dev-profile' },
  gcpObservability: { project: 'my-gcp-project' },
  kubernetes: { context: 'my-cluster' },
  argocd: {
    cluster: {
      id: 'argo-prod',
      url: 'https://argocd.example.com',
      token: 'fake-token',
    },
  },
};

// ---------------------------------------------------------------------------
// Helper: build env map by iterating the registry (the new contract)
// ---------------------------------------------------------------------------

function buildEnvVarsViaRegistry(
  resolved: ResolvedConfig,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const cmd of registry) {
    cmd.emitEnvVars(resolved, env);
  }
  return env;
}

// ---------------------------------------------------------------------------
// Helper: build outro lines by iterating the registry (the new contract)
// ---------------------------------------------------------------------------

function buildOutroLinesViaRegistry(
  resolved: ResolvedConfig,
  effectiveSkipped: SkippedMap,
): string[] {
  const lines: string[] = [];
  // Success lines first
  for (const cmd of registry) {
    const isSkipped = Boolean(effectiveSkipped[cmd.skippedKey]);
    if (!isSkipped) {
      const line = cmd.buildOutroSuccessLine(resolved);
      if (line !== null) lines.push(line);
    }
  }
  // Skip lines second (same canonical order)
  for (const cmd of registry) {
    const line = cmd.buildOutroSkipLine(effectiveSkipped[cmd.skippedKey]);
    if (line !== null) lines.push(line);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Helper: build summary lines by iterating the registry
// ---------------------------------------------------------------------------

function formatSummaryLinesViaRegistry(config: LauncherConfig): string[] {
  if (config.selectedMcps.length === 0) return ['No MCPs configured.'];
  return config.selectedMcps.map((name) => {
    const cmd = registry.find((c) => c.id === name);
    if (cmd === undefined) return `${name}: (unknown MCP)`;
    return cmd.buildSummaryLine(config);
  });
}

// ---------------------------------------------------------------------------
// registry length assertion (Step 3 acceptance check)
// ---------------------------------------------------------------------------

describe('registry', () => {
  it('contains exactly five entries in canonical order', () => {
    assert.strictEqual(registry.length, 5);
    assert.deepStrictEqual(
      registry.map((c) => c.id),
      ['grafana', 'cloudwatch', 'gcp-observability', 'kubernetes', 'argocd'],
    );
  });
});

// ---------------------------------------------------------------------------
// Env var behavioural-equivalence tests
// ---------------------------------------------------------------------------

describe('registry emitEnvVars: behavioural equivalence with buildEnvVars', () => {
  it('all MCPs resolved: registry produces same env map as buildEnvVars', () => {
    const oracle = buildEnvVars(allMcpsResolved);
    const actual = buildEnvVarsViaRegistry(allMcpsResolved);
    assert.deepStrictEqual(actual, oracle);
  });

  it('Grafana viewer only: registry produces same env map as buildEnvVars', () => {
    const resolved: ResolvedConfig = {
      grafana: { cluster: fakeCluster, role: 'viewer' },
    };
    const oracle = buildEnvVars(resolved);
    const actual = buildEnvVarsViaRegistry(resolved);
    assert.deepStrictEqual(actual, oracle);
  });

  it('Grafana editor only: registry produces same env map as buildEnvVars', () => {
    const resolved: ResolvedConfig = {
      grafana: { cluster: fakeCluster, role: 'editor' },
    };
    const oracle = buildEnvVars(resolved);
    const actual = buildEnvVarsViaRegistry(resolved);
    assert.deepStrictEqual(actual, oracle);
  });

  it('CloudWatch only: registry produces same env map as buildEnvVars', () => {
    const resolved: ResolvedConfig = {
      cloudwatch: { profile: 'my-dev-profile' },
    };
    const oracle = buildEnvVars(resolved);
    const actual = buildEnvVarsViaRegistry(resolved);
    assert.deepStrictEqual(actual, oracle);
  });

  it('empty config: registry produces same empty env map as buildEnvVars', () => {
    const resolved: ResolvedConfig = {};
    const oracle = buildEnvVars(resolved);
    const actual = buildEnvVarsViaRegistry(resolved);
    assert.deepStrictEqual(actual, oracle);
  });

  it('all five MCPs resolved: env map includes ARGOCD_BASE_URL from ArgoCD fixture', () => {
    const env = buildEnvVarsViaRegistry(allMcpsResolved);
    assert.strictEqual(env['ARGOCD_BASE_URL'], 'https://argocd.example.com');
  });
});

// ---------------------------------------------------------------------------
// Outro line behavioural-equivalence tests
// (mirrors outro.test.ts cases (a), (b), (e), (e2), (g))
// ---------------------------------------------------------------------------

describe('registry buildOutroLines: behavioural equivalence with buildOutroLines', () => {
  it('(a) all MCPs configured and none skipped: same lines as buildOutroLines', () => {
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
    const oracle = buildOutroLines(resolved, effectiveSkipped);
    const actual = buildOutroLinesViaRegistry(resolved, effectiveSkipped);
    assert.deepStrictEqual(actual, oracle);
  });

  it('(b) all MCPs skipped via loader failure: same lines as buildOutroLines', () => {
    const resolved: ResolvedConfig = {};
    const effectiveSkipped: SkippedMap = {
      grafana: 'loader-failed',
      cloudwatch: 'loader-failed',
      gcp: 'loader-failed',
      kubernetes: 'loader-failed',
    };
    const oracle = buildOutroLines(resolved, effectiveSkipped);
    const actual = buildOutroLinesViaRegistry(resolved, effectiveSkipped);
    assert.deepStrictEqual(actual, oracle);
  });

  it('(e) success lines before skip lines in canonical order: same as buildOutroLines', () => {
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
    const oracle = buildOutroLines(resolved, effectiveSkipped);
    const actual = buildOutroLinesViaRegistry(resolved, effectiveSkipped);
    assert.deepStrictEqual(actual, oracle);
  });

  it('(e2) success-first ordering when skipped MCP ranks before resolved: same as buildOutroLines', () => {
    const resolved: ResolvedConfig = {
      cloudwatch: { profile: 'my-aws-profile' },
    };
    const effectiveSkipped: SkippedMap = { grafana: 'loader-failed' };
    const oracle = buildOutroLines(resolved, effectiveSkipped);
    const actual = buildOutroLinesViaRegistry(resolved, effectiveSkipped);
    assert.deepStrictEqual(actual, oracle);
  });

  it("(f) all five MCPs resolved: outro includes 'ArgoCD: argo-prod' line", () => {
    const effectiveSkipped: SkippedMap = {};
    const lines = buildOutroLinesViaRegistry(allMcpsResolved, effectiveSkipped);
    assert.ok(
      lines.includes('ArgoCD: argo-prod'),
      `Expected outro to include "ArgoCD: argo-prod" but got: ${JSON.stringify(lines)}`,
    );
  });

  it('(g) effectiveSkipped=false does not suppress success line: same as buildOutroLines', () => {
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
    const oracle = buildOutroLines(resolved, effectiveSkipped);
    const actual = buildOutroLinesViaRegistry(resolved, effectiveSkipped);
    assert.deepStrictEqual(actual, oracle);
  });
});

// ---------------------------------------------------------------------------
// Summary line behavioural-equivalence tests
// ---------------------------------------------------------------------------

describe('registry buildSummaryLine: behavioural equivalence with formatSummaryLines', () => {
  it('empty selectedMcps: same result as formatSummaryLines', () => {
    const config: LauncherConfig = { selectedMcps: [] };
    const oracle = formatSummaryLines(config);
    const actual = formatSummaryLinesViaRegistry(config);
    assert.deepStrictEqual(actual, oracle);
  });

  it('all five MCPs configured: same lines as formatSummaryLines', () => {
    const config: LauncherConfig = {
      selectedMcps: [
        'grafana',
        'cloudwatch',
        'gcp-observability',
        'kubernetes',
        'argocd',
      ],
      grafana: { clusterId: 'prod-us', role: 'editor' },
      cloudwatch: { profile: 'prod' },
      gcpObservability: { project: 'gcp-prod' },
      kubernetes: { context: 'prod-cluster' },
      argocd: { clusterId: 'argo-prod' },
    };
    const oracle = formatSummaryLines(config);
    const actual = formatSummaryLinesViaRegistry(config);
    assert.deepStrictEqual(actual, oracle);
  });

  it('single MCP cloudwatch: same line as formatSummaryLines', () => {
    const config: LauncherConfig = {
      selectedMcps: ['cloudwatch'],
      cloudwatch: { profile: 'prod' },
    };
    const oracle = formatSummaryLines(config);
    const actual = formatSummaryLinesViaRegistry(config);
    assert.deepStrictEqual(actual, oracle);
  });

  it("unknown MCP in selectedMcps: same '(unknown MCP)' line as formatSummaryLines", () => {
    const config: LauncherConfig = { selectedMcps: ['future-mcp'] };
    const oracle = formatSummaryLines(config);
    const actual = formatSummaryLinesViaRegistry(config);
    assert.deepStrictEqual(actual, oracle);
  });

  it("MCP in selectedMcps with missing sub-object: same '(not yet configured)' line as formatSummaryLines", () => {
    const config: LauncherConfig = { selectedMcps: ['grafana'] };
    const oracle = formatSummaryLines(config);
    const actual = formatSummaryLinesViaRegistry(config);
    assert.deepStrictEqual(actual, oracle);
  });
});
