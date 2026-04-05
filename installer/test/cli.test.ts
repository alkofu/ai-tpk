import { describe, it, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../cli.js";

class ExitSentinel extends Error {
  constructor(public readonly code: number) {
    super(`process.exit(${code})`);
  }
}

afterEach(() => {
  mock.restoreAll();
});

describe("parseArgs", () => {
  it("returns symlink mode with no args", () => {
    const result = parseArgs([]);
    assert.deepStrictEqual(result, { mode: "symlink" });
  });

  it("returns copy mode with --copy", () => {
    const result = parseArgs(["--copy"]);
    assert.deepStrictEqual(result, { mode: "copy" });
  });

  it("exits 1 on unknown flag", () => {
    mock.method(process, "exit", (code: number) => {
      throw new ExitSentinel(code);
    });
    assert.throws(
      () => parseArgs(["--bogus"]),
      (err: unknown) => err instanceof ExitSentinel && err.code === 1
    );
  });

  it("exits 0 on --help", () => {
    mock.method(process, "exit", (code: number) => {
      throw new ExitSentinel(code);
    });
    // Also mock console.log to suppress output during tests
    mock.method(console, "log", () => {});
    assert.throws(
      () => parseArgs(["--help"]),
      (err: unknown) => err instanceof ExitSentinel && err.code === 0
    );
  });

  it("exits 0 on -h alias", () => {
    mock.method(process, "exit", (code: number) => {
      throw new ExitSentinel(code);
    });
    mock.method(console, "log", () => {});
    assert.throws(
      () => parseArgs(["-h"]),
      (err: unknown) => err instanceof ExitSentinel && err.code === 0
    );
  });
});
