import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as childProcess from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// colors.ts reads NO_COLOR at module load time (const noColor = Boolean(process.env["NO_COLOR"])).
// Testing both branches in the same process is not reliably possible.
// We use child_process.execFileSync to run a small inline script in a fresh process
// with and without NO_COLOR set.

const __filename = fileURLToPath(import.meta.url);
const installerDir = path.dirname(__filename);

function runColorCheck(colorName: string, noColor: boolean): string {
  const script = `
    import { c } from "${path.join(installerDir, 'colors.js')}";
    process.stdout.write(c.${colorName}("hello"));
  `;
  const env = { ...process.env };
  if (noColor) {
    env['NO_COLOR'] = '1';
  } else {
    delete env['NO_COLOR'];
  }
  return childProcess.execFileSync(
    process.execPath,
    ['--input-type=module', '--import', 'tsx/esm'],
    { input: script, env, encoding: 'utf8' },
  );
}

describe('colors', () => {
  it('wraps text in ANSI codes when NO_COLOR is unset', () => {
    const output = runColorCheck('red', false);
    assert.ok(output.includes('\x1b[0;31m'), 'should contain red ANSI code');
    assert.ok(output.includes('hello'));
  });

  it('returns plain text when NO_COLOR=1', () => {
    const output = runColorCheck('red', true);
    assert.ok(
      !output.includes('\x1b['),
      'should not contain any ANSI escape codes',
    );
    assert.strictEqual(output, 'hello');
  });
});
