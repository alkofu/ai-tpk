import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadGrafanaClusters } from "../mcp/grafana.js";

// ---------------------------------------------------------------------------
// Shared temp directory — cleaned up after all tests complete
// ---------------------------------------------------------------------------

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-tpk-grafana-test-"));

after(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

// ---------------------------------------------------------------------------
// Helper: write YAML content to a temp file and return the file path
// ---------------------------------------------------------------------------

function writeYaml(name: string, content: string): string {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

// ---------------------------------------------------------------------------
// loadGrafanaClusters
// ---------------------------------------------------------------------------

describe("loadGrafanaClusters", () => {
  it("parses a valid YAML file with viewer_token and editor_token fields", () => {
    const filePath = writeYaml(
      "valid.yaml",
      `
clusters:
  - id: prod
    name: Production
    url: https://grafana.example.com
    viewer_token: viewer-tok-123
    editor_token: editor-tok-456
`,
    );
    const clusters = loadGrafanaClusters(filePath);
    assert.strictEqual(clusters.length, 1);
    assert.deepStrictEqual(clusters[0], {
      id: "prod",
      name: "Production",
      url: "https://grafana.example.com",
      viewer_token: "viewer-tok-123",
      editor_token: "editor-tok-456",
    });
  });

  it("falls back when a cluster has legacy token but no viewer_token/editor_token", () => {
    // The log.warn call from @clack/prompts may emit to stdout — this is acceptable.
    const filePath = writeYaml(
      "legacy.yaml",
      `
clusters:
  - id: staging
    name: Staging
    url: https://staging.grafana.example.com
    token: legacy-tok-789
`,
    );
    const clusters = loadGrafanaClusters(filePath);
    assert.strictEqual(clusters.length, 1);
    assert.strictEqual(clusters[0]?.viewer_token, "legacy-tok-789");
    assert.strictEqual(clusters[0]?.editor_token, "");
  });

  it("throws when the config file does not exist", () => {
    const missingPath = path.join(tmpDir, "does-not-exist.yaml");
    assert.throws(
      () => loadGrafanaClusters(missingPath),
      (err: unknown) =>
        err instanceof Error &&
        err.message.includes("Grafana clusters config not found"),
    );
  });

  it("throws when the file has no clusters key", () => {
    const filePath = writeYaml(
      "no-clusters.yaml",
      `
something_else:
  - id: x
`,
    );
    assert.throws(
      () => loadGrafanaClusters(filePath),
      (err: unknown) =>
        err instanceof Error && err.message.includes("no 'clusters' array"),
    );
  });

  it("throws when the clusters array is empty", () => {
    const filePath = writeYaml(
      "empty-clusters.yaml",
      `
clusters: []
`,
    );
    assert.throws(
      () => loadGrafanaClusters(filePath),
      (err: unknown) =>
        err instanceof Error && err.message.includes("empty 'clusters' array"),
    );
  });

  it("throws when a cluster entry is missing required id or name fields", () => {
    const filePath = writeYaml(
      "missing-fields.yaml",
      `
clusters:
  - url: https://grafana.example.com
    viewer_token: tok
    editor_token: tok2
`,
    );
    assert.throws(
      () => loadGrafanaClusters(filePath),
      (err: unknown) =>
        err instanceof Error && err.message.includes("missing required fields"),
    );
  });

  it("throws when a cluster entry has an invalid or missing url", () => {
    const filePath = writeYaml(
      "bad-url.yaml",
      `
clusters:
  - id: broken
    name: Broken
    url: not-a-url
    viewer_token: tok
    editor_token: tok2
`,
    );
    assert.throws(
      () => loadGrafanaClusters(filePath),
      (err: unknown) =>
        err instanceof Error && err.message.includes("missing or invalid url"),
    );
  });
});
