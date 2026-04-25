import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { installLauncherScript } from './launcher-install.js';

function makeFakeRepo(
  root: string,
  { withBundle = true }: { withBundle?: boolean } = {},
): void {
  const launcherDir = path.join(root, 'src', 'launcher');
  fs.mkdirSync(launcherDir, { recursive: true });

  const shContent =
    ['#!/usr/bin/env bash', 'exec node "$HOME/.ai-tpk/launcher.cjs" "$@"'].join(
      '\n',
    ) + '\n';
  fs.writeFileSync(path.join(launcherDir, 'tpk.sh'), shContent);
  fs.chmodSync(path.join(launcherDir, 'tpk.sh'), 0o755);

  if (withBundle) {
    const distDir = path.join(root, 'dist');
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(
      path.join(distDir, 'launcher.cjs'),
      '// fake launcher bundle\n',
    );
  }
}

describe('installLauncherScript', () => {
  let fakeRepo: string;
  let fakeHome: string;

  before(() => {
    fakeRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-test-repo-'));
    fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-test-home-'));
    makeFakeRepo(fakeRepo);
    installLauncherScript(fakeRepo, { homeDir: fakeHome });
  });

  after(() => {
    fs.rmSync(fakeRepo, { recursive: true, force: true });
    fs.rmSync(fakeHome, { recursive: true, force: true });
  });

  it('copies dist/launcher.cjs to ~/.ai-tpk/launcher.cjs', () => {
    const destBundle = path.join(fakeHome, '.ai-tpk', 'launcher.cjs');
    assert.ok(fs.existsSync(destBundle));
    const content = fs.readFileSync(destBundle, 'utf8');
    assert.ok(content.includes('fake launcher bundle'));
  });

  it("creates ~/.ai-tpk/ directory if it doesn't exist", () => {
    const aiTpkDir = path.join(fakeHome, '.ai-tpk');
    assert.ok(fs.existsSync(aiTpkDir));
    assert.ok(fs.statSync(aiTpkDir).isDirectory());
  });

  it('throws if dist/launcher.cjs is missing', () => {
    const freshRepo = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-fresh-repo-'),
    );
    const freshHome = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-fresh-home-'),
    );
    try {
      makeFakeRepo(freshRepo, { withBundle: false });
      assert.throws(
        () => installLauncherScript(freshRepo, { homeDir: freshHome }),
        /dist\/launcher\.cjs not found/,
      );
      assert.ok(!fs.existsSync(path.join(freshHome, '.ai-tpk')));
    } finally {
      fs.rmSync(freshRepo, { recursive: true, force: true });
      fs.rmSync(freshHome, { recursive: true, force: true });
    }
  });

  it('installs ~/bin/tpk wrapper with correct content and permissions', () => {
    const binScript = path.join(fakeHome, 'bin', 'tpk');
    assert.ok(fs.existsSync(binScript));
    const content = fs.readFileSync(binScript, 'utf8');
    assert.ok(content.startsWith('#!/usr/bin/env bash'));
    assert.ok(content.includes('.ai-tpk/launcher.cjs'));
    const mode = fs.statSync(binScript).mode & 0o777;
    assert.equal(mode, 0o755);
  });

  it('removes old ~/.claude/launcher/ on re-install (migration cleanup)', () => {
    const oldLauncherDir = path.join(fakeHome, '.claude', 'launcher');
    fs.mkdirSync(oldLauncherDir, { recursive: true });
    fs.writeFileSync(path.join(oldLauncherDir, 'main.ts'), '// old main');

    installLauncherScript(fakeRepo, { homeDir: fakeHome });

    assert.ok(!fs.existsSync(oldLauncherDir));
    assert.ok(fs.existsSync(path.join(fakeHome, '.ai-tpk', 'launcher.cjs')));
  });

  it('preserves unrelated ~/.ai-tpk/ files on re-install', () => {
    fs.writeFileSync(
      path.join(fakeHome, '.ai-tpk', 'other-tool.json'),
      '{"tool":"other"}',
    );

    installLauncherScript(fakeRepo, { homeDir: fakeHome });

    assert.ok(fs.existsSync(path.join(fakeHome, '.ai-tpk', 'other-tool.json')));
    assert.ok(fs.existsSync(path.join(fakeHome, '.ai-tpk', 'launcher.cjs')));
  });

  it('removes stale ~/.ai-tpk/launcher.js on re-install', () => {
    const staleJs = path.join(fakeHome, '.ai-tpk', 'launcher.js');
    fs.writeFileSync(staleJs, '// stale bundle\n');

    installLauncherScript(fakeRepo, { homeDir: fakeHome });

    assert.ok(!fs.existsSync(staleJs));
    assert.ok(fs.existsSync(path.join(fakeHome, '.ai-tpk', 'launcher.cjs')));
  });

  // -------------------------------------------------------------------------
  // 8g migration block tests (test-first: written before the migration code)
  // -------------------------------------------------------------------------

  it('8g: copies ~/.config/myclaude/config.json to ~/.config/tpk/config.json when source exists and dest is absent', () => {
    const isolatedRepo = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-8g-happy-repo-'),
    );
    const isolatedHome = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-8g-happy-home-'),
    );
    try {
      makeFakeRepo(isolatedRepo);
      const legacyDir = path.join(isolatedHome, '.config', 'myclaude');
      fs.mkdirSync(legacyDir, { recursive: true });
      const legacySrc = path.join(legacyDir, 'config.json');
      fs.writeFileSync(legacySrc, '{"selectedMcps":["grafana"]}', 'utf8');
      fs.chmodSync(legacySrc, 0o600);

      installLauncherScript(isolatedRepo, { homeDir: isolatedHome });

      const dest = path.join(isolatedHome, '.config', 'tpk', 'config.json');
      assert.ok(fs.existsSync(dest), 'dest config.json should exist');
      assert.strictEqual(
        fs.readFileSync(dest, 'utf8'),
        '{"selectedMcps":["grafana"]}',
      );
      assert.strictEqual(fs.statSync(dest).mode & 0o777, 0o600);
      // Source must still exist
      assert.ok(
        fs.existsSync(legacySrc),
        'source config.json must be preserved',
      );
    } finally {
      fs.rmSync(isolatedRepo, { recursive: true, force: true });
      fs.rmSync(isolatedHome, { recursive: true, force: true });
    }
  });

  it('8g: skips copy and logs warning when dest ~/.config/tpk/config.json already exists', () => {
    const isolatedRepo = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-8g-skip-repo-'),
    );
    const isolatedHome = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-8g-skip-home-'),
    );
    try {
      makeFakeRepo(isolatedRepo);
      const legacyDir = path.join(isolatedHome, '.config', 'myclaude');
      fs.mkdirSync(legacyDir, { recursive: true });
      const legacySrc = path.join(legacyDir, 'config.json');
      fs.writeFileSync(legacySrc, '{"selectedMcps":["grafana"]}', 'utf8');
      fs.chmodSync(legacySrc, 0o600);

      const tpkDir = path.join(isolatedHome, '.config', 'tpk');
      fs.mkdirSync(tpkDir, { recursive: true });
      const dest = path.join(tpkDir, 'config.json');
      fs.writeFileSync(dest, '{"selectedMcps":["argocd"]}', 'utf8');
      fs.chmodSync(dest, 0o600);

      const originalLog = console.log;
      const logLines: string[] = [];
      console.log = (...args: unknown[]) => logLines.push(args.join(' '));
      try {
        installLauncherScript(isolatedRepo, { homeDir: isolatedHome });
      } finally {
        console.log = originalLog;
      }

      // Dest must retain original content — not overwritten
      assert.strictEqual(
        fs.readFileSync(dest, 'utf8'),
        '{"selectedMcps":["argocd"]}',
      );
      // A log line must mention the skip
      assert.ok(
        logLines.some(
          (l) =>
            l.includes('Skipping copy') &&
            l.includes('~/.config/tpk/config.json'),
        ),
        `expected skip log line, got: ${logLines.join(' | ')}`,
      );
    } finally {
      fs.rmSync(isolatedRepo, { recursive: true, force: true });
      fs.rmSync(isolatedHome, { recursive: true, force: true });
    }
  });

  it('8g: no-op when source ~/.config/myclaude/config.json is absent', () => {
    const isolatedRepo = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-8g-noop-repo-'),
    );
    const isolatedHome = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-8g-noop-home-'),
    );
    try {
      makeFakeRepo(isolatedRepo);

      installLauncherScript(isolatedRepo, { homeDir: isolatedHome });

      const dest = path.join(isolatedHome, '.config', 'tpk', 'config.json');
      assert.ok(
        !fs.existsSync(dest),
        'dest should not exist when source is absent',
      );
    } finally {
      fs.rmSync(isolatedRepo, { recursive: true, force: true });
      fs.rmSync(isolatedHome, { recursive: true, force: true });
    }
  });

  it('8g: migration does not run when 8e short-circuits via symlink', () => {
    const isolatedRepo = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-8g-symlink-repo-'),
    );
    const isolatedHome = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-8g-symlink-home-'),
    );
    try {
      makeFakeRepo(isolatedRepo);
      // Pre-create ~/bin/tpk as a symlink to short-circuit 8e
      const binDir = path.join(isolatedHome, 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.symlinkSync('/usr/bin/true', path.join(binDir, 'tpk'));

      // Pre-create source ~/.config/myclaude/config.json
      const legacyDir = path.join(isolatedHome, '.config', 'myclaude');
      fs.mkdirSync(legacyDir, { recursive: true });
      fs.writeFileSync(
        path.join(legacyDir, 'config.json'),
        '{"selectedMcps":["grafana"]}',
        'utf8',
      );

      installLauncherScript(isolatedRepo, { homeDir: isolatedHome });

      // 8g must NOT have run because 8e returned early
      const dest = path.join(isolatedHome, '.config', 'tpk', 'config.json');
      assert.ok(
        !fs.existsSync(dest),
        'config.json must not be copied when 8e short-circuits',
      );
    } finally {
      fs.rmSync(isolatedRepo, { recursive: true, force: true });
      fs.rmSync(isolatedHome, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // 8h migration block tests (test-first: written before the migration code)
  // -------------------------------------------------------------------------

  it('8h: copies ~/.config/argocd-accounts.json to ~/.config/tpk/argocd-accounts.json preserving mode 0600', () => {
    const isolatedRepo = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-8h-argocd-repo-'),
    );
    const isolatedHome = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-8h-argocd-home-'),
    );
    try {
      makeFakeRepo(isolatedRepo);
      const legacySrc = path.join(
        isolatedHome,
        '.config',
        'argocd-accounts.json',
      );
      fs.mkdirSync(path.join(isolatedHome, '.config'), { recursive: true });
      fs.writeFileSync(
        legacySrc,
        '{"my-cluster":{"url":"https://x","token":"t"}}',
        'utf8',
      );
      fs.chmodSync(legacySrc, 0o600);

      installLauncherScript(isolatedRepo, { homeDir: isolatedHome });

      const dest = path.join(
        isolatedHome,
        '.config',
        'tpk',
        'argocd-accounts.json',
      );
      assert.ok(fs.existsSync(dest), 'dest argocd-accounts.json should exist');
      assert.strictEqual(
        fs.readFileSync(dest, 'utf8'),
        '{"my-cluster":{"url":"https://x","token":"t"}}',
      );
      assert.strictEqual(fs.statSync(dest).mode & 0o777, 0o600);
      assert.ok(
        fs.existsSync(legacySrc),
        'source argocd-accounts.json must be preserved',
      );
    } finally {
      fs.rmSync(isolatedRepo, { recursive: true, force: true });
      fs.rmSync(isolatedHome, { recursive: true, force: true });
    }
  });

  it('8h: copies ~/.config/github-pats.json to ~/.config/tpk/github-pats.json preserving mode 0600', () => {
    const isolatedRepo = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-8h-github-repo-'),
    );
    const isolatedHome = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-8h-github-home-'),
    );
    try {
      makeFakeRepo(isolatedRepo);
      const legacySrc = path.join(isolatedHome, '.config', 'github-pats.json');
      fs.mkdirSync(path.join(isolatedHome, '.config'), { recursive: true });
      fs.writeFileSync(legacySrc, '{"personal":"ghp_xxx"}', 'utf8');
      fs.chmodSync(legacySrc, 0o600);

      installLauncherScript(isolatedRepo, { homeDir: isolatedHome });

      const dest = path.join(
        isolatedHome,
        '.config',
        'tpk',
        'github-pats.json',
      );
      assert.ok(fs.existsSync(dest), 'dest github-pats.json should exist');
      assert.strictEqual(
        fs.readFileSync(dest, 'utf8'),
        '{"personal":"ghp_xxx"}',
      );
      assert.strictEqual(fs.statSync(dest).mode & 0o777, 0o600);
      assert.ok(
        fs.existsSync(legacySrc),
        'source github-pats.json must be preserved',
      );
    } finally {
      fs.rmSync(isolatedRepo, { recursive: true, force: true });
      fs.rmSync(isolatedHome, { recursive: true, force: true });
    }
  });

  it('8h: copies ~/.config/grafana-clusters.yaml to ~/.config/tpk/grafana-clusters.yaml preserving mode 0644', () => {
    const isolatedRepo = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-8h-grafana-repo-'),
    );
    const isolatedHome = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-8h-grafana-home-'),
    );
    try {
      makeFakeRepo(isolatedRepo);
      const legacySrc = path.join(
        isolatedHome,
        '.config',
        'grafana-clusters.yaml',
      );
      fs.mkdirSync(path.join(isolatedHome, '.config'), { recursive: true });
      const yamlContent =
        'clusters:\n  - id: prod\n    name: Production\n    url: https://g.example.com\n    viewer_token: tok\n';
      fs.writeFileSync(legacySrc, yamlContent, 'utf8');
      fs.chmodSync(legacySrc, 0o644);

      installLauncherScript(isolatedRepo, { homeDir: isolatedHome });

      const dest = path.join(
        isolatedHome,
        '.config',
        'tpk',
        'grafana-clusters.yaml',
      );
      assert.ok(fs.existsSync(dest), 'dest grafana-clusters.yaml should exist');
      assert.strictEqual(fs.readFileSync(dest, 'utf8'), yamlContent);
      assert.strictEqual(fs.statSync(dest).mode & 0o777, 0o644);
      assert.ok(
        fs.existsSync(legacySrc),
        'source grafana-clusters.yaml must be preserved',
      );
    } finally {
      fs.rmSync(isolatedRepo, { recursive: true, force: true });
      fs.rmSync(isolatedHome, { recursive: true, force: true });
    }
  });

  it('8h: skips copy and logs warning when dest ~/.config/tpk/argocd-accounts.json already exists', () => {
    const isolatedRepo = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-8h-skip-repo-'),
    );
    const isolatedHome = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-8h-skip-home-'),
    );
    try {
      makeFakeRepo(isolatedRepo);
      // Source argocd-accounts.json with content A
      fs.mkdirSync(path.join(isolatedHome, '.config'), { recursive: true });
      const legacySrc = path.join(
        isolatedHome,
        '.config',
        'argocd-accounts.json',
      );
      fs.writeFileSync(legacySrc, '{"source":"A"}', 'utf8');
      fs.chmodSync(legacySrc, 0o600);

      // Dest already exists with content B
      const tpkDir = path.join(isolatedHome, '.config', 'tpk');
      fs.mkdirSync(tpkDir, { recursive: true });
      const dest = path.join(tpkDir, 'argocd-accounts.json');
      fs.writeFileSync(dest, '{"dest":"B"}', 'utf8');
      fs.chmodSync(dest, 0o600);

      const originalLog = console.log;
      const logLines: string[] = [];
      console.log = (...args: unknown[]) => logLines.push(args.join(' '));
      try {
        installLauncherScript(isolatedRepo, { homeDir: isolatedHome });
      } finally {
        console.log = originalLog;
      }

      // Dest must retain content B — not overwritten
      assert.strictEqual(fs.readFileSync(dest, 'utf8'), '{"dest":"B"}');
      // A log line must mention the skip for argocd
      assert.ok(
        logLines.some(
          (l) =>
            l.includes('Skipping copy') &&
            l.includes('~/.config/tpk/argocd-accounts.json'),
        ),
        `expected skip log line for argocd-accounts.json, got: ${logLines.join(' | ')}`,
      );
    } finally {
      fs.rmSync(isolatedRepo, { recursive: true, force: true });
      fs.rmSync(isolatedHome, { recursive: true, force: true });
    }
  });

  it('8h: migration does not run when 8e short-circuits via symlink', () => {
    const isolatedRepo = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-8h-symlink-repo-'),
    );
    const isolatedHome = fs.mkdtempSync(
      path.join(os.tmpdir(), 'launcher-test-8h-symlink-home-'),
    );
    try {
      makeFakeRepo(isolatedRepo);
      // Pre-create ~/bin/tpk as a symlink to short-circuit 8e
      const binDir = path.join(isolatedHome, 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.symlinkSync('/usr/bin/true', path.join(binDir, 'tpk'));

      // Pre-create source ~/.config/argocd-accounts.json
      fs.mkdirSync(path.join(isolatedHome, '.config'), { recursive: true });
      const legacySrc = path.join(
        isolatedHome,
        '.config',
        'argocd-accounts.json',
      );
      fs.writeFileSync(
        legacySrc,
        '{"cluster":{"url":"x","token":"y"}}',
        'utf8',
      );
      fs.chmodSync(legacySrc, 0o600);

      installLauncherScript(isolatedRepo, { homeDir: isolatedHome });

      // 8h must NOT have run because 8e returned early
      const dest = path.join(
        isolatedHome,
        '.config',
        'tpk',
        'argocd-accounts.json',
      );
      assert.ok(
        !fs.existsSync(dest),
        'argocd-accounts.json must not be copied when 8e short-circuits',
      );
    } finally {
      fs.rmSync(isolatedRepo, { recursive: true, force: true });
      fs.rmSync(isolatedHome, { recursive: true, force: true });
    }
  });
});
