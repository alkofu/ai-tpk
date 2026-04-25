import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { checkAdcCredentials, loadGcpProjects } from './gcp-observability.js';
import type { GcloudRunner } from './gcp-observability.js';

// ---------------------------------------------------------------------------
// Shared temp directory — cleaned up after all tests complete
// ---------------------------------------------------------------------------

const tmpDir = fs.mkdtempSync(
  path.join(os.tmpdir(), 'ai-tpk-gcp-observability-test-'),
);

after(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

// ---------------------------------------------------------------------------
// Helper: write a file to the temp dir and return its path
// ---------------------------------------------------------------------------

function writeTempFile(name: string, content: string): string {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

// ---------------------------------------------------------------------------
// checkAdcCredentials
// ---------------------------------------------------------------------------

describe('checkAdcCredentials', () => {
  // Save and restore GOOGLE_APPLICATION_CREDENTIALS for env var isolation
  let savedEnvCredPath: string | undefined;

  before(() => {
    savedEnvCredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  });

  after(() => {
    if (savedEnvCredPath !== undefined) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = savedEnvCredPath;
    } else {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
  });

  it('throws when neither GOOGLE_APPLICATION_CREDENTIALS is set nor default ADC path exists', () => {
    const missingPath = path.join(tmpDir, 'does-not-exist.json');
    assert.throws(
      () => checkAdcCredentials(missingPath),
      (err: unknown) => err instanceof Error,
    );
  });

  it('does not throw when default ADC file exists (via adcPath param)', () => {
    const adcFile = writeTempFile(
      'adc-credentials.json',
      '{"type":"authorized_user"}',
    );
    assert.doesNotThrow(() => checkAdcCredentials(adcFile));
  });

  it('does not throw when GOOGLE_APPLICATION_CREDENTIALS points to an existing file (even if default ADC path is missing)', () => {
    const credFile = writeTempFile(
      'env-credentials.json',
      '{"type":"service_account"}',
    );
    const missingAdcPath = path.join(tmpDir, 'missing-adc.json');
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credFile;
    try {
      assert.doesNotThrow(() => checkAdcCredentials(missingAdcPath));
    } finally {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
  });

  it('throws when GOOGLE_APPLICATION_CREDENTIALS points to non-existent file AND default ADC path is missing', () => {
    const missingEnvPath = path.join(tmpDir, 'missing-env-cred.json');
    const missingAdcPath = path.join(tmpDir, 'missing-adc-2.json');
    process.env.GOOGLE_APPLICATION_CREDENTIALS = missingEnvPath;
    try {
      assert.throws(
        () => checkAdcCredentials(missingAdcPath),
        (err: unknown) => err instanceof Error,
      );
    } finally {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
  });

  it('error message includes GOOGLE_APPLICATION_CREDENTIALS and gcloud auth application-default login', () => {
    const missingPath = path.join(tmpDir, 'missing-for-message-test.json');
    let caughtError: Error | null = null;
    try {
      checkAdcCredentials(missingPath);
    } catch (err) {
      if (err instanceof Error) {
        caughtError = err;
      }
    }
    assert.ok(caughtError !== null, 'Expected an error to be thrown');
    assert.ok(
      caughtError!.message.includes('GOOGLE_APPLICATION_CREDENTIALS'),
      'Error message must mention GOOGLE_APPLICATION_CREDENTIALS',
    );
    assert.ok(
      caughtError!.message.includes('gcloud auth application-default login'),
      'Error message must mention gcloud auth application-default login',
    );
  });
});

// ---------------------------------------------------------------------------
// loadGcpProjects
// ---------------------------------------------------------------------------

const runnerNotFound: GcloudRunner = () => {
  const err = new Error('spawnSync gcloud ENOENT') as NodeJS.ErrnoException;
  err.code = 'ENOENT';
  return { status: null, stdout: '', stderr: '', error: err };
};

const runnerNonZeroExit: GcloudRunner = () => ({
  status: 1,
  stdout: '',
  stderr: 'ERROR: (gcloud.projects.list) not authenticated',
});

const runnerEmptyOutput: GcloudRunner = () => ({
  status: 0,
  stdout: '   \n  \n  ',
  stderr: '',
});

const runnerValidOutput: GcloudRunner = () => ({
  status: 0,
  stdout: 'alpha-project\ncharlie-project\nbravo-project\n',
  stderr: '',
});

const runnerWhitespaceOutput: GcloudRunner = () => ({
  status: 0,
  stdout: '\nmy-project\n\nanother-project\n\n',
  stderr: '',
});

const runnerTimeout: GcloudRunner = () => ({
  status: null,
  stdout: '',
  stderr: '',
  signal: 'SIGTERM',
});

describe('loadGcpProjects', () => {
  it('throws when gcloud is not found on PATH', () => {
    assert.throws(
      () => loadGcpProjects(runnerNotFound),
      (err: unknown) =>
        err instanceof Error && err.message.includes('gcloud CLI not found'),
    );
  });

  it('throws with stderr when gcloud exits non-zero', () => {
    assert.throws(
      () => loadGcpProjects(runnerNonZeroExit),
      (err: unknown) =>
        err instanceof Error &&
        err.message.includes('gcloud projects list failed') &&
        err.message.includes('not authenticated'),
    );
  });

  it('throws when gcloud returns empty output', () => {
    assert.throws(
      () => loadGcpProjects(runnerEmptyOutput),
      (err: unknown) =>
        err instanceof Error && err.message.includes('No GCP projects found'),
    );
  });

  it('returns project IDs in the order provided by gcloud', () => {
    const projects = loadGcpProjects(runnerValidOutput);
    assert.deepStrictEqual(projects, [
      'alpha-project',
      'charlie-project',
      'bravo-project',
    ]);
  });

  it('handles trailing newlines and filters empty lines', () => {
    const projects = loadGcpProjects(runnerWhitespaceOutput);
    assert.deepStrictEqual(projects, ['my-project', 'another-project']);
  });

  it('throws when gcloud times out', () => {
    assert.throws(
      () => loadGcpProjects(runnerTimeout),
      (err: unknown) =>
        err instanceof Error && err.message.includes('timed out after 15s'),
    );
  });
});
