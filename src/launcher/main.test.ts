import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildClaudeArgs } from "./claude-args.js";

describe("buildClaudeArgs", () => {
  it("returns ['--agent', 'dungeonmaster'] when initialMessage is undefined", () => {
    const result = buildClaudeArgs(undefined);
    assert.deepStrictEqual(result, ["--agent", "dungeonmaster"]);
  });

  it("appends the message as a third element and preserves internal spaces as a single argv element", () => {
    const result = buildClaudeArgs("/feature-issue 42");
    assert.deepStrictEqual(result, [
      "--agent",
      "dungeonmaster",
      "/feature-issue 42",
    ]);
  });

  it("returns ['--agent', 'dungeonmaster', ''] for an empty string (present but empty message forwarded verbatim)", () => {
    const result = buildClaudeArgs("");
    assert.deepStrictEqual(result, ["--agent", "dungeonmaster", ""]);
  });
});
