import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { log } from '@clack/prompts';
import { errorMessage, tryLoad } from './utils.js';

describe('errorMessage', () => {
  it('returns the message property when given an Error instance', () => {
    assert.strictEqual(errorMessage(new Error('boom')), 'boom');
  });

  it('returns the string itself when given a plain string', () => {
    assert.strictEqual(
      errorMessage('something went wrong'),
      'something went wrong',
    );
  });

  it('returns a string representation when given a number', () => {
    assert.strictEqual(errorMessage(42), '42');
  });

  it("returns 'null' when given null", () => {
    assert.strictEqual(errorMessage(null), 'null');
  });

  it("returns 'undefined' when given undefined", () => {
    assert.strictEqual(errorMessage(undefined), 'undefined');
  });
});

describe('tryLoad', () => {
  it('returns the callback result and emits no warning on success', (t) => {
    const warnMock = mock.method(log, 'warn', () => {});
    t.after(() => warnMock.mock.restore());

    const result = tryLoad(() => 42, 'test-label');

    assert.strictEqual(result, 42);
    assert.strictEqual(warnMock.mock.calls.length, 0);
  });

  it('returns null and emits the default warning on failure', (t) => {
    const warnMock = mock.method(log, 'warn', () => {});
    t.after(() => warnMock.mock.restore());

    const result = tryLoad(() => {
      throw new Error('boom');
    }, 'test-label');

    assert.strictEqual(result, null);
    assert.strictEqual(warnMock.mock.calls.length, 1);
    assert.strictEqual(
      warnMock.mock.calls[0].arguments[0],
      '[test-label] boom',
    );
  });

  it('emits the custom warning (not the default) when warningMessage is provided', (t) => {
    const warnMock = mock.method(log, 'warn', () => {});
    t.after(() => warnMock.mock.restore());

    const result = tryLoad(
      () => {
        throw new Error('boom');
      },
      'test-label',
      'custom message',
    );

    assert.strictEqual(result, null);
    assert.strictEqual(warnMock.mock.calls.length, 1);
    assert.strictEqual(warnMock.mock.calls[0].arguments[0], 'custom message');
  });

  it('returns the value and emits no warning on success even when warningMessage is supplied', (t) => {
    const warnMock = mock.method(log, 'warn', () => {});
    t.after(() => warnMock.mock.restore());

    const result = tryLoad(() => 'hello', 'test-label', 'should not appear');

    assert.strictEqual(result, 'hello');
    assert.strictEqual(warnMock.mock.calls.length, 0);
  });
});
