import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  deepMergeJson,
  installMergedJson,
  isRepoManagedHook,
  mergeHooks,
} from './settings.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tpk-test-'));

after(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

describe('deepMergeJson', () => {
  it('preserves a base-only top-level key', () => {
    const base = { apiKeyHelper: 'helper.sh', model: 'claude-opus-4-8[1m]' };
    const overlay = { allowedTools: ['Bash'] };
    const merged = deepMergeJson(base, overlay);
    assert.strictEqual(merged.apiKeyHelper, 'helper.sh');
    assert.strictEqual(merged.model, 'claude-opus-4-8[1m]');
  });

  it('takes the overlay value on a conflicting top-level key', () => {
    const base = { defaultMode: 'old-mode' };
    const overlay = { defaultMode: 'new-mode' };
    const merged = deepMergeJson(base, overlay);
    assert.strictEqual(merged.defaultMode, 'new-mode');
  });

  it('deep-merges nested objects, applying template keys and retaining local-only keys', () => {
    const base = {
      env: {
        ANTHROPIC_BASE_URL: 'https://local.example.com',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'old-model',
      },
    };
    const overlay = {
      env: {
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'new-model',
      },
    };
    const merged = deepMergeJson(base, overlay) as typeof base;
    assert.strictEqual(
      merged.env.ANTHROPIC_BASE_URL,
      'https://local.example.com',
    );
    assert.strictEqual(merged.env.ANTHROPIC_DEFAULT_OPUS_MODEL, 'new-model');
  });

  it('replaces a non-whitelisted array key wholesale rather than concatenating', () => {
    const base = { someList: ['Bash', 'Read'] };
    const overlay = { someList: ['Read', 'Write'] };
    const merged = deepMergeJson(base, overlay);
    assert.deepStrictEqual(merged.someList, ['Read', 'Write']);
  });

  it('unions a whitelisted array key, preserving local-only entries after template entries', () => {
    const base = { allowedTools: ['Bash', 'Read'] };
    const overlay = { allowedTools: ['Read', 'Write'] };
    const merged = deepMergeJson(base, overlay);
    assert.deepStrictEqual(merged.allowedTools, ['Read', 'Write', 'Bash']);
  });

  it('deduplicates whitelisted array entries shared across template and live', () => {
    const base = { allowedTools: ['Bash', 'Read', 'Write'] };
    const overlay = { allowedTools: ['Read', 'Write', 'Edit'] };
    const merged = deepMergeJson(base, overlay);
    assert.deepStrictEqual(merged.allowedTools, [
      'Read',
      'Write',
      'Edit',
      'Bash',
    ]);
  });

  it('preserves template ordering at the front of a whitelisted array union', () => {
    const base = { allowedTools: ['Local1', 'Local2'] };
    const overlay = { allowedTools: ['TemplateA', 'TemplateB', 'TemplateC'] };
    const merged = deepMergeJson(base, overlay);
    assert.deepStrictEqual(merged.allowedTools, [
      'TemplateA',
      'TemplateB',
      'TemplateC',
      'Local1',
      'Local2',
    ]);
  });

  it('deduplicates self-duplicate entries within the live-only array before appending', () => {
    const base = { allowedTools: ['Local1', 'Local1', 'Local2'] };
    const overlay = { allowedTools: ['TemplateA'] };
    const merged = deepMergeJson(base, overlay);
    assert.deepStrictEqual(merged.allowedTools, [
      'TemplateA',
      'Local1',
      'Local2',
    ]);
  });

  it('does not mutate its inputs when combining whitelisted array unions', () => {
    const base = { allowedTools: ['Bash'] };
    const overlay = { allowedTools: ['Read'] };
    const baseCopy = JSON.parse(JSON.stringify(base));
    const overlayCopy = JSON.parse(JSON.stringify(overlay));
    deepMergeJson(base, overlay);
    assert.deepStrictEqual(base, baseCopy);
    assert.deepStrictEqual(overlay, overlayCopy);
  });

  it('does not mutate its inputs', () => {
    const base = { env: { A: '1' } };
    const overlay = { env: { B: '2' } };
    const baseCopy = JSON.parse(JSON.stringify(base));
    const overlayCopy = JSON.parse(JSON.stringify(overlay));
    deepMergeJson(base, overlay);
    assert.deepStrictEqual(base, baseCopy);
    assert.deepStrictEqual(overlay, overlayCopy);
  });
});

const HOME = '/home/test';

const repoHook = (script: string, extra: Record<string, unknown> = {}) => ({
  type: 'command',
  command: `bash ~/.claude/hooks/${script}`,
  ...extra,
});

const userHook = (command: string) => ({ type: 'command', command });

describe('isRepoManagedHook', () => {
  it('recognizes every home-anchored form of the installed hooks dir', () => {
    for (const command of [
      'bash ~/.claude/hooks/a.sh',
      'bash $HOME/.claude/hooks/a.sh',
      'bash "${HOME}/.claude/hooks/a.sh"',
      '/home/test/.claude/hooks/a.sh --flag',
    ]) {
      assert.strictEqual(
        isRepoManagedHook({ type: 'command', command }, HOME),
        true,
        command,
      );
    }
  });

  it('does not claim hooks outside the home .claude/hooks dir', () => {
    for (const command of [
      '/home/test/.config/iterm2/cc-status',
      'bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/project.sh',
      'bash /other/home/.claude/hooks/a.sh',
      'bash ~/.claude/scripts/a.sh',
    ]) {
      assert.strictEqual(
        isRepoManagedHook({ type: 'command', command }, HOME),
        false,
        command,
      );
    }
  });

  it('returns false for hooks without a string command', () => {
    assert.strictEqual(isRepoManagedHook({ type: 'prompt' }, HOME), false);
    assert.strictEqual(isRepoManagedHook('not-an-object', HOME), false);
  });
});

describe('mergeHooks', () => {
  it('replaces drifted repo groups with the template and appends user groups', () => {
    // Live repo group lacks `async: true`: a value-based union would keep it
    // alongside the template group and run the hook twice.
    const live = {
      Stop: [
        { hooks: [repoHook('talekeeper-enrich.sh')] },
        { hooks: [userHook('/home/test/.config/iterm2/cc-status')] },
      ],
    };
    const template = {
      Stop: [{ async: true, hooks: [repoHook('talekeeper-enrich.sh')] }],
    };
    assert.deepStrictEqual(mergeHooks(live, template, HOME), {
      Stop: [
        { async: true, hooks: [repoHook('talekeeper-enrich.sh')] },
        { hooks: [userHook('/home/test/.config/iterm2/cc-status')] },
      ],
    });
  });

  it('keeps user hooks from a group that mixes repo and user hooks', () => {
    const live = {
      Stop: [
        {
          matcher: '*',
          hooks: [repoHook('old.sh'), userHook('notify-send done')],
        },
      ],
    };
    const template = { Stop: [{ hooks: [repoHook('new.sh')] }] };
    assert.deepStrictEqual(mergeHooks(live, template, HOME), {
      Stop: [
        { hooks: [repoHook('new.sh')] },
        { matcher: '*', hooks: [userHook('notify-send done')] },
      ],
    });
  });

  it('keeps user-only events the template does not define', () => {
    const live = { Notification: [{ hooks: [userHook('cc-status')] }] };
    const template = { Stop: [{ hooks: [repoHook('a.sh')] }] };
    assert.deepStrictEqual(mergeHooks(live, template, HOME), {
      Stop: [{ hooks: [repoHook('a.sh')] }],
      Notification: [{ hooks: [userHook('cc-status')] }],
    });
  });

  it('drops an event the template removed when only repo hooks remain', () => {
    const live = {
      Stop: [{ hooks: [repoHook('a.sh')] }],
      PreCompact: [{ hooks: [repoHook('removed-from-template.sh')] }],
    };
    const template = { Stop: [{ hooks: [repoHook('a.sh')] }] };
    assert.deepStrictEqual(mergeHooks(live, template, HOME), {
      Stop: [{ hooks: [repoHook('a.sh')] }],
    });
  });

  it('keeps live values with an unrecognized shape unchanged', () => {
    const live = {
      Stop: [{ matcher: 'no-hooks-array' }, 'not-an-object'],
      Custom: { not: 'an array' },
    };
    const template = { Stop: [{ hooks: [repoHook('a.sh')] }] };
    assert.deepStrictEqual(mergeHooks(live, template, HOME), {
      Stop: [
        { hooks: [repoHook('a.sh')] },
        { matcher: 'no-hooks-array' },
        'not-an-object',
      ],
      Custom: { not: 'an array' },
    });
  });

  it('does not mutate its inputs', () => {
    const live = {
      Stop: [{ hooks: [repoHook('a.sh'), userHook('cc-status')] }],
    };
    const template = { Stop: [{ hooks: [repoHook('b.sh')] }] };
    const liveCopy = JSON.parse(JSON.stringify(live));
    const templateCopy = JSON.parse(JSON.stringify(template));
    mergeHooks(live, template, HOME);
    assert.deepStrictEqual(live, liveCopy);
    assert.deepStrictEqual(template, templateCopy);
  });
});

describe('installMergedJson', () => {
  it('preserves user-owned hooks across a merge while the template owns repo hooks', () => {
    const src = path.join(tmpDir, 'template-hooks.json');
    const dest = path.join(tmpDir, 'dest-hooks.json');
    fs.writeFileSync(
      src,
      JSON.stringify({
        hooks: {
          SessionStart: [
            { async: true, hooks: [repoHook('session-start.sh')] },
          ],
        },
      }),
    );
    fs.writeFileSync(
      dest,
      JSON.stringify({
        hooks: {
          SessionStart: [
            { hooks: [repoHook('session-start.sh')] },
            { hooks: [userHook('cc-status')] },
          ],
          UserPromptSubmit: [{ hooks: [userHook('cc-status')] }],
        },
      }),
    );
    installMergedJson(src, dest);
    const merged = JSON.parse(fs.readFileSync(dest, 'utf8'));
    assert.deepStrictEqual(merged.hooks, {
      SessionStart: [
        { async: true, hooks: [repoHook('session-start.sh')] },
        { hooks: [userHook('cc-status')] },
      ],
      UserPromptSubmit: [{ hooks: [userHook('cc-status')] }],
    });
  });

  it('merges into an existing valid-JSON dest and creates a backup', () => {
    const src = path.join(tmpDir, 'template-valid.json');
    const dest = path.join(tmpDir, 'dest-valid.json');
    fs.writeFileSync(
      src,
      JSON.stringify({ allowedTools: ['Bash'], env: { A: 'template' } }),
    );
    fs.writeFileSync(
      dest,
      JSON.stringify({ apiKeyHelper: 'helper.sh', env: { B: 'local' } }),
    );
    installMergedJson(src, dest);
    const merged = JSON.parse(fs.readFileSync(dest, 'utf8'));
    assert.strictEqual(merged.apiKeyHelper, 'helper.sh');
    assert.deepStrictEqual(merged.allowedTools, ['Bash']);
    assert.strictEqual(merged.env.A, 'template');
    assert.strictEqual(merged.env.B, 'local');
    const backups = fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith('dest-valid.json.backup.'));
    assert.strictEqual(backups.length, 1);
  });

  it('writes the template verbatim when dest is missing, without a backup', () => {
    const src = path.join(tmpDir, 'template-missing.json');
    const dest = path.join(tmpDir, 'dest-missing.json');
    fs.writeFileSync(src, JSON.stringify({ allowedTools: ['Bash'] }));
    installMergedJson(src, dest);
    const written = JSON.parse(fs.readFileSync(dest, 'utf8'));
    assert.deepStrictEqual(written, { allowedTools: ['Bash'] });
    const backups = fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith('dest-missing.json.backup.'));
    assert.strictEqual(backups.length, 0);
  });

  it('falls back to overwrite-with-backup when dest is malformed JSON', () => {
    const src = path.join(tmpDir, 'template-malformed.json');
    const dest = path.join(tmpDir, 'dest-malformed.json');
    fs.writeFileSync(src, JSON.stringify({ allowedTools: ['Bash'] }));
    fs.writeFileSync(dest, '{ not valid json');
    assert.doesNotThrow(() => installMergedJson(src, dest));
    const written = JSON.parse(fs.readFileSync(dest, 'utf8'));
    assert.deepStrictEqual(written, { allowedTools: ['Bash'] });
    const backups = fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith('dest-malformed.json.backup.'));
    assert.strictEqual(backups.length, 1);
  });

  it('preserves a local-only allowedTools entry across a merge, alongside template entries', () => {
    const src = path.join(tmpDir, 'template-allowed-tools.json');
    const dest = path.join(tmpDir, 'dest-allowed-tools.json');
    fs.writeFileSync(src, JSON.stringify({ allowedTools: ['Bash', 'Read'] }));
    fs.writeFileSync(
      dest,
      JSON.stringify({ allowedTools: ['Read', 'LocalOnlyTool'] }),
    );
    installMergedJson(src, dest);
    const merged = JSON.parse(fs.readFileSync(dest, 'utf8'));
    assert.deepStrictEqual(merged.allowedTools, [
      'Bash',
      'Read',
      'LocalOnlyTool',
    ]);
    const backups = fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith('dest-allowed-tools.json.backup.'));
    assert.strictEqual(backups.length, 1);
  });

  it('falls back to overwrite-with-backup when dest parses to a non-object', () => {
    const src = path.join(tmpDir, 'template-non-object.json');
    const dest = path.join(tmpDir, 'dest-non-object.json');
    fs.writeFileSync(src, JSON.stringify({ allowedTools: ['Bash'] }));
    fs.writeFileSync(dest, JSON.stringify(['not', 'an', 'object']));
    assert.doesNotThrow(() => installMergedJson(src, dest));
    const written = JSON.parse(fs.readFileSync(dest, 'utf8'));
    assert.deepStrictEqual(written, { allowedTools: ['Bash'] });
    const backups = fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith('dest-non-object.json.backup.'));
    assert.strictEqual(backups.length, 1);
  });
});
