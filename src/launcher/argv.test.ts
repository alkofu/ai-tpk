import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseArgs,
  UnknownFlagError,
  TooManyPositionalsError,
} from "./argv.js";

describe("parseArgs", () => {
  it("returns { skip: false, initialMessage: undefined } for an empty argv", () => {
    const result = parseArgs([]);
    assert.deepStrictEqual(result, { skip: false, initialMessage: undefined });
  });

  it("returns { skip: true, initialMessage: undefined } for ['--skip']", () => {
    const result = parseArgs(["--skip"]);
    assert.deepStrictEqual(result, { skip: true, initialMessage: undefined });
  });

  it("returns { skip: true, initialMessage: undefined } for duplicate ['--skip', '--skip'] (idempotent)", () => {
    const result = parseArgs(["--skip", "--skip"]);
    assert.deepStrictEqual(result, { skip: true, initialMessage: undefined });
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

  it("captures initial message after --skip: parseArgs(['--skip', '/feature-issue 42']) returns { skip: true, initialMessage: '/feature-issue 42' }", () => {
    const result = parseArgs(["--skip", "/feature-issue 42"]);
    assert.deepStrictEqual(result, {
      skip: true,
      initialMessage: "/feature-issue 42",
    });
  });

  it("captures initial message before --skip: parseArgs(['/cmd', '--skip']) returns { skip: true, initialMessage: '/cmd' }", () => {
    const result = parseArgs(["/cmd", "--skip"]);
    assert.deepStrictEqual(result, { skip: true, initialMessage: "/cmd" });
  });

  it("captures initial message without --skip: parseArgs(['/cmd']) returns { skip: false, initialMessage: '/cmd' }", () => {
    const result = parseArgs(["/cmd"]);
    assert.deepStrictEqual(result, { skip: false, initialMessage: "/cmd" });
  });

  it("throws TooManyPositionalsError when two positionals are supplied", () => {
    assert.throws(
      () => parseArgs(["--skip", "a", "b"]),
      (err: unknown) => {
        assert.ok(
          err instanceof TooManyPositionalsError,
          "should be TooManyPositionalsError",
        );
        assert.ok(
          (err as TooManyPositionalsError).message.includes(
            "Too many positional arguments",
          ),
          "message should mention too many positional arguments",
        );
        assert.ok(
          (err as TooManyPositionalsError).message.includes(
            "Usage: myclaude [--skip]",
          ),
          "message should contain the usage hint",
        );
        return true;
      },
    );
  });

  it("still throws UnknownFlagError for an unknown flag in the presence of a positional", () => {
    assert.throws(
      () => parseArgs(["--unknown", "/cmd"]),
      (err: unknown) => {
        assert.ok(
          err instanceof UnknownFlagError,
          "should be UnknownFlagError (not TooManyPositionalsError)",
        );
        return true;
      },
    );
  });

  it("throws UnknownFlagError for a single-dash flag after --skip", () => {
    assert.throws(
      () => parseArgs(["--skip", "-h"]),
      (err: unknown) => {
        assert.ok(
          err instanceof UnknownFlagError,
          "should be UnknownFlagError",
        );
        assert.ok(
          (err as UnknownFlagError).message.includes("-h"),
          "message should contain the offending flag",
        );
        return true;
      },
    );
  });

  it("throws UnknownFlagError for a bare single dash", () => {
    assert.throws(
      () => parseArgs(["-"]),
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
