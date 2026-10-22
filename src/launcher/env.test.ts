import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { buildEnvVars } from './env.js';
import type { ResolvedConfig } from './types.js';

// ---------------------------------------------------------------------------
// Dotfile isolation strategy:
//
// `buildEnvVars` writes ~/.claude/.current-aws-profile whenever CloudWatch is
// configured. We back up the real file before the suite runs and restore it
// (or remove the file) afterwards. This keeps tests hermetic without
// suppressing the real write, which means the dotfile path remains exercised.
// ---------------------------------------------------------------------------

const dotfileDir = path.join(os.homedir(), '.claude');
const dotfilePath = path.join(dotfileDir, '.current-aws-profile');
const gcpDotfilePath = path.join(dotfileDir, '.current-gcp-project');
const kubeDotfilePath = path.join(dotfileDir, '.current-kube-context');

let priorDotfileContent: string | null = null;
let priorGcpDotfileContent: string | null = null;
let priorKubeDotfileContent: string | null = null;

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
});

// ---------------------------------------------------------------------------
// buildEnvVars
// ---------------------------------------------------------------------------

describe('buildEnvVars', () => {
  it('CloudWatch only: returns AWS_PROFILE', () => {
    const config: ResolvedConfig = {
      cloudwatch: { profile: 'my-dev-profile' },
    };
    const env = buildEnvVars(config);
    assert.strictEqual(env['AWS_PROFILE'], 'my-dev-profile');
  });

  it('never emits GRAFANA_* vars: Grafana servers are installer-registered per cluster', () => {
    const config: ResolvedConfig = {
      cloudwatch: { profile: 'prod' },
      gcpObservability: { project: 'my-gcp-project' },
      kubernetes: { context: 'my-cluster' },
    };
    const env = buildEnvVars(config);
    assert.deepStrictEqual(
      Object.keys(env).filter((k) => k.startsWith('GRAFANA_')),
      [],
    );
  });

  it('empty config ({}): returns empty env var map', () => {
    const config: ResolvedConfig = {};
    const env = buildEnvVars(config);
    assert.deepStrictEqual(env, {});
  });

  it('GCP Observability only: returns GOOGLE_CLOUD_PROJECT', () => {
    const config: ResolvedConfig = {
      gcpObservability: { project: 'my-gcp-project' },
    };
    const env = buildEnvVars(config);
    assert.strictEqual(env['GOOGLE_CLOUD_PROJECT'], 'my-gcp-project');
    assert.ok(
      !Object.prototype.hasOwnProperty.call(env, 'AWS_PROFILE'),
      'AWS_PROFILE must not be present when no CloudWatch config',
    );
  });

  it('GCP Observability + CloudWatch combined: both keys present', () => {
    const config: ResolvedConfig = {
      cloudwatch: { profile: 'prod' },
      gcpObservability: { project: 'my-gcp-project' },
    };
    const env = buildEnvVars(config);
    assert.strictEqual(env['AWS_PROFILE'], 'prod');
    assert.strictEqual(env['GOOGLE_CLOUD_PROJECT'], 'my-gcp-project');
  });

  it('Kubernetes only: returns K8S_CONTEXT', () => {
    const config: ResolvedConfig = {
      kubernetes: { context: 'my-cluster' },
    };
    const env = buildEnvVars(config);
    assert.strictEqual(env['K8S_CONTEXT'], 'my-cluster');
    assert.ok(
      !Object.prototype.hasOwnProperty.call(env, 'AWS_PROFILE'),
      'AWS_PROFILE must not be present when no CloudWatch config',
    );
    assert.ok(
      !Object.prototype.hasOwnProperty.call(env, 'GOOGLE_CLOUD_PROJECT'),
      'GOOGLE_CLOUD_PROJECT must not be present when no GCP config',
    );
    // Verify the dotfile was written with the correct content
    assert.strictEqual(
      fs.readFileSync(kubeDotfilePath, 'utf8'),
      'my-cluster\n',
    );
  });

  it('Kubernetes + CloudWatch combined: both keys present', () => {
    const config: ResolvedConfig = {
      cloudwatch: { profile: 'prod' },
      kubernetes: { context: 'production-cluster' },
    };
    const env = buildEnvVars(config);
    assert.strictEqual(env['AWS_PROFILE'], 'prod');
    assert.strictEqual(env['K8S_CONTEXT'], 'production-cluster');
  });

  it('Kubernetes + GCP Observability combined: both keys present', () => {
    const config: ResolvedConfig = {
      gcpObservability: { project: 'my-gcp-project' },
      kubernetes: { context: 'staging-cluster' },
    };
    const env = buildEnvVars(config);
    assert.strictEqual(env['GOOGLE_CLOUD_PROJECT'], 'my-gcp-project');
    assert.strictEqual(env['K8S_CONTEXT'], 'staging-cluster');
  });
});
