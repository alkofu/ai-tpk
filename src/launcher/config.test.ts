import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadConfig, saveConfig } from './config.js';

// ---------------------------------------------------------------------------
// Fake-home isolation: swap process.env.HOME to a temp directory so that
// loadConfig / saveConfig (which call os.homedir() internally) never touch
// the real user home. Getter functions re-derive paths at call time, after
// the HOME swap has occurred.
// These getters are deliberately re-defined locally rather than imported from
// `./config.js` so the test computes paths independently and a bug in
// `config.ts`'s path derivation cannot escape detection.
// ---------------------------------------------------------------------------

let originalHome: string | undefined;
let fakeHome: string;

function getConfigDir(): string {
  return path.join(os.homedir(), '.config', 'tpk');
}
function getConfigFile(): string {
  return path.join(getConfigDir(), 'config.json');
}

// Temp dir for scratch space used in tests that need it
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tpk-config-test-'));

before(() => {
  originalHome = process.env.HOME;
  fakeHome = fs.mkdtempSync(
    path.join(os.tmpdir(), 'ai-tpk-config-test-home-'),
  );
  process.env.HOME = fakeHome;
});

after(() => {
  if (originalHome !== undefined) {
    process.env.HOME = originalHome;
  } else {
    delete process.env.HOME;
  }
  fs.rmSync(fakeHome, { recursive: true, force: true });
  fs.rmSync(tmpDir, { recursive: true });
});

// Helper: ensure the config file does not exist before a test
function removeConfigFile(): void {
  if (fs.existsSync(getConfigFile())) {
    fs.rmSync(getConfigFile());
  }
}

// ---------------------------------------------------------------------------
// loadConfig
// ---------------------------------------------------------------------------

describe('loadConfig', () => {
  it('returns { selectedMcps: [] } when file does not exist', () => {
    removeConfigFile();
    const result = loadConfig();
    assert.deepStrictEqual(result, { selectedMcps: [] });
  });

  it('returns { selectedMcps: [] } when file contains malformed JSON', () => {
    fs.mkdirSync(getConfigDir(), { recursive: true });
    fs.writeFileSync(getConfigFile(), 'not valid json {{', 'utf8');
    const result = loadConfig();
    assert.deepStrictEqual(result, { selectedMcps: [] });
  });

  it('correctly parses a valid config file', () => {
    const config = {
      selectedMcps: ['grafana', 'cloudwatch'],
      cloudwatch: { profile: 'my-profile' },
    };
    fs.mkdirSync(getConfigDir(), { recursive: true });
    fs.writeFileSync(getConfigFile(), JSON.stringify(config), 'utf8');
    const result = loadConfig();
    assert.deepStrictEqual(result, config);
  });
});

// ---------------------------------------------------------------------------
// saveConfig
// ---------------------------------------------------------------------------

describe('saveConfig', () => {
  it('creates the directory and file when they do not exist', () => {
    // Remove both file and dir so saveConfig must create them from scratch
    if (fs.existsSync(getConfigFile())) {
      fs.rmSync(getConfigFile());
    }
    if (fs.existsSync(getConfigDir())) {
      fs.rmSync(getConfigDir(), { recursive: true });
    }
    saveConfig({ selectedMcps: ['grafana'] });
    assert.ok(
      fs.existsSync(getConfigFile()),
      'config file should exist after saveConfig',
    );
  });

  it('overwrites an existing config file', () => {
    fs.mkdirSync(getConfigDir(), { recursive: true });
    fs.writeFileSync(
      getConfigFile(),
      JSON.stringify({ selectedMcps: ['old'] }),
      'utf8',
    );
    saveConfig({ selectedMcps: ['new'] });
    const written = JSON.parse(
      fs.readFileSync(getConfigFile(), 'utf8'),
    ) as unknown;
    assert.deepStrictEqual(written, { selectedMcps: ['new'] });
  });

  it('round-trip: saveConfig then loadConfig returns the same data', () => {
    const config = {
      selectedMcps: ['grafana', 'cloudwatch'],
      grafana: { clusterId: 'prod', role: 'viewer' as const },
      cloudwatch: { profile: 'default' },
    };
    saveConfig(config);
    const loaded = loadConfig();
    assert.deepStrictEqual(loaded, config);
  });

  it('writes the file with mode 0o600', () => {
    saveConfig({ selectedMcps: [] });
    const mode = fs.statSync(getConfigFile()).mode & 0o777;
    assert.strictEqual(
      mode,
      0o600,
      `expected mode 0o600, got 0o${mode.toString(8)}`,
    );
  });
});
