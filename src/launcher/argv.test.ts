import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, UnknownFlagError } from "./argv.js";

describe("parseArgs", () => {
  it("returns { skip: false } for an empty argv", () => {
    const result = parseArgs([]);
    assert.deepStrictEqual(result, { skip: false });
  });

  it("returns { skip: true } for ['--skip']", () => {
    const result = parseArgs(["--skip"]);
    assert.deepStrictEqual(result, { skip: true });
  });

  it("returns { skip: true } for duplicate ['--skip', '--skip'] (idempotent)", () => {
    const result = parseArgs(["--skip", "--skip"]);
    assert.deepStrictEqual(result, { skip: true });
  });

  it("throws UnknownFlagError for an unknown flag, message contains the flag and usage hint", () => {
    assert.throws(
      () => parseArgs(["--unknown"]),
      (err: unknown) => {
        assert.ok(
          err instanceof UnknownFlagError,
          "should be UnknownFlagError",
        );
        assert.ok(
          (err as UnknownFlagError).message.includes("--unknown"),
          "message should contain the offending flag",
        );
        assert.ok(
          (err as UnknownFlagError).message.includes(
            "Usage: myclaude [--skip]",
          ),
          "message should contain the usage hint",
        );
        return true;
      },
    );
  });

  it("throws UnknownFlagError for ['--skip', 'extra'] — positional after valid flag", () => {
    assert.throws(
      () => parseArgs(["--skip", "extra"]),
      (err: unknown) => {
        assert.ok(
          err instanceof UnknownFlagError,
          "should be UnknownFlagError",
        );
        assert.ok(
          (err as UnknownFlagError).message.includes("extra"),
          "message should contain 'extra'",
        );
        return true;
      },
    );
  });

  it("throws UnknownFlagError for a bare positional argument", () => {
    assert.throws(
      () => parseArgs(["positional"]),
      (err: unknown) => {
        assert.ok(
          err instanceof UnknownFlagError,
          "should be UnknownFlagError",
        );
        return true;
      },
    );
  });
});
