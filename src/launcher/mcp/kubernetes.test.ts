import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseKubectxOutput } from "./kubernetes.js";

// Note: loadKubectxContexts() and switchContext() invoke spawnSync("kubectx", ...)
// which requires kubectx on PATH. Their error paths (ENOENT, non-zero exit, empty
// output) are integration-tested manually. parseKubectxOutput() covers the parsing
// logic that is pure and unit-testable.

describe("parseKubectxOutput", () => {
  it("parses a standard kubectx output with multiple contexts", () => {
    const stdout = "production\nstaging\ndevelopment\n";
    assert.deepEqual(parseKubectxOutput(stdout), [
      "production",
      "staging",
      "development",
    ]);
  });

  it("handles empty string (no contexts)", () => {
    assert.deepEqual(parseKubectxOutput(""), []);
  });

  it("filters blank lines", () => {
    const stdout = "production\n\nstaging\n";
    assert.deepEqual(parseKubectxOutput(stdout), ["production", "staging"]);
  });

  it("trims whitespace from context names", () => {
    const stdout = "  production  \n  staging  \n";
    assert.deepEqual(parseKubectxOutput(stdout), ["production", "staging"]);
  });

  it("handles a single context", () => {
    assert.deepEqual(parseKubectxOutput("my-cluster\n"), ["my-cluster"]);
  });
});
