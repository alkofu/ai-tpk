import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from './cli.js';

class ExitSentinel extends Error {
  constructor(public readonly code: number) {
    super(`process.exit(${code})`);
  }
}

afterEach(() => {
  mock.restoreAll();
});

describe('parseArgs', () => {
  it('returns without error when no args given', () => {
    const result = parseArgs([]);
    assert.deepStrictEqual(result, { targetAgent: 'claude' });
  });

  it("returns targetAgent: 'claude' when --target-agent claude is passed", () => {
    const result = parseArgs(['--target-agent', 'claude']);
    assert.deepStrictEqual(result, { targetAgent: 'claude' });
  });

  it('exits 1 when --target-agent is missing a value', () => {
    mock.method(process, 'exit', (code: number) => {
      throw new ExitSentinel(code);
    });
    const calls: string[] = [];
    mock.method(process.stderr, 'write', (chunk: string) => {
      calls.push(chunk);
      return true;
    });
    assert.throws(
      () => parseArgs(['--target-agent']),
      (err: unknown) => err instanceof ExitSentinel && err.code === 1,
    );
    assert.ok(calls.some((c) => c.includes('--target-agent requires a value')));
  });

  it('exits 1 when --target-agent value is not in the valid list', () => {
    mock.method(process, 'exit', (code: number) => {
      throw new ExitSentinel(code);
    });
    const calls: string[] = [];
    mock.method(process.stderr, 'write', (chunk: string) => {
      calls.push(chunk);
      return true;
    });
    assert.throws(
      () => parseArgs(['--target-agent', 'bogus']),
      (err: unknown) => err instanceof ExitSentinel && err.code === 1,
    );
    assert.ok(calls.some((c) => c.includes('bogus') && c.includes('claude')));
  });

  it('exits 1 when --target-agent value starts with --', () => {
    mock.method(process, 'exit', (code: number) => {
      throw new ExitSentinel(code);
    });
    const calls: string[] = [];
    mock.method(process.stderr, 'write', (chunk: string) => {
      calls.push(chunk);
      return true;
    });
    assert.throws(
      () => parseArgs(['--target-agent', '--help']),
      (err: unknown) => err instanceof ExitSentinel && err.code === 1,
    );
    assert.ok(calls.some((c) => c.includes('--target-agent requires a value')));
  });

  it('exits 1 on unknown flag', () => {
    mock.method(process, 'exit', (code: number) => {
      throw new ExitSentinel(code);
    });
    assert.throws(
      () => parseArgs(['--bogus']),
      (err: unknown) => err instanceof ExitSentinel && err.code === 1,
    );
  });

  it('exits 0 on --help', () => {
    mock.method(process, 'exit', (code: number) => {
      throw new ExitSentinel(code);
    });
    // Also mock console.log to suppress output during tests
    mock.method(console, 'log', () => {});
    assert.throws(
      () => parseArgs(['--help']),
      (err: unknown) => err instanceof ExitSentinel && err.code === 0,
    );
  });

  it('exits 0 on -h alias', () => {
    mock.method(process, 'exit', (code: number) => {
      throw new ExitSentinel(code);
    });
    mock.method(console, 'log', () => {});
    assert.throws(
      () => parseArgs(['-h']),
      (err: unknown) => err instanceof ExitSentinel && err.code === 0,
    );
  });
});
