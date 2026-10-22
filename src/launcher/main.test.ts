import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildClaudeArgs } from './claude-args.js';

describe('buildClaudeArgs', () => {
  it("returns ['--agent', 'dungeonmaster'] for dungeonmaster when initialMessage is undefined", () => {
    const result = buildClaudeArgs('dungeonmaster', undefined);
    assert.deepStrictEqual(result, ['--agent', 'dungeonmaster']);
  });

  it('appends the message as a third element and preserves internal spaces as a single argv element', () => {
    const result = buildClaudeArgs('dungeonmaster', '/feature-issue 42');
    assert.deepStrictEqual(result, [
      '--agent',
      'dungeonmaster',
      '/feature-issue 42',
    ]);
  });

  it("returns ['--agent', 'dungeonmaster', ''] for an empty string (present but empty message forwarded verbatim)", () => {
    const result = buildClaudeArgs('dungeonmaster', '');
    assert.deepStrictEqual(result, ['--agent', 'dungeonmaster', '']);
  });

  it('returns an empty argv for the default agent when initialMessage is undefined', () => {
    const result = buildClaudeArgs('default', undefined);
    assert.deepStrictEqual(result, []);
  });

  it('returns only the message for the default agent (no --agent flag)', () => {
    const result = buildClaudeArgs('default', '/feature-issue 42');
    assert.deepStrictEqual(result, ['/feature-issue 42']);
  });

  it('returns successive calls with independent arrays (no shared mutable state)', () => {
    buildClaudeArgs('dungeonmaster', 'first');
    const result = buildClaudeArgs('dungeonmaster', undefined);
    assert.deepStrictEqual(result, ['--agent', 'dungeonmaster']);
  });
});
