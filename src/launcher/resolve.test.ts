import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { buildResolvedFromSaved } from "./resolve.js";
import type { LauncherConfig } from "./types.js";

// ---------------------------------------------------------------------------
// Temp directory for fixture YAML files
// ---------------------------------------------------------------------------

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-tpk-resolve-test-"));

before(() => {
  // tmpDir already created above via mkdtempSync
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

// ---------------------------------------------------------------------------
// YAML fixture helpers
// ---------------------------------------------------------------------------

function writeGrafanaFixture(
  clusters: Array<{
    id: string;
    name: string;
    url: string;
    viewer_token: string;
    editor_token: string;
  }>,
): string {
  const lines = ["clusters:"];
  for (const c of clusters) {
    lines.push(`  - id: "${c.id}"`);
    lines.push(`    name: "${c.name}"`);
    lines.push(`    url: "${c.url}"`);
    lines.push(`    viewer_token: "${c.viewer_token}"`);
    lines.push(`    editor_token: "${c.editor_token}"`);
  }
  const filePath = path.join(tmpDir, `grafana-${Date.now()}.yaml`);
  fs.writeFileSync(filePath, lines.join("\n"), {
    mode: 0o600,
    encoding: "utf8",
  });
  return filePath;
}

const fakeCluster = {
  id: "prod-eu",
  name: "Production EU",
  url: "https://grafana.prod-eu.example.com",
  viewer_token: "viewer-tok-abc",
  editor_token: "editor-tok-xyz",
};

// ---------------------------------------------------------------------------
// buildResolvedFromSaved
// ---------------------------------------------------------------------------

describe("buildResolvedFromSaved", () => {
  it("returns {} when selectedMcps is empty", () => {
    const config: LauncherConfig = { selectedMcps: [] };
    const result = buildResolvedFromSaved(config);
    assert.deepStrictEqual(result, {});
  });

  it("returns { cloudwatch: { profile } } for cloudwatch-only config", () => {
    const config: LauncherConfig = {
      selectedMcps: ["cloudwatch"],
      cloudwatch: { profile: "my-profile" },
    };
    const result = buildResolvedFromSaved(config);
    assert.deepStrictEqual(result, { cloudwatch: { profile: "my-profile" } });
  });

  it("returns { gcpObservability: { project } } for gcp-only config", () => {
    const config: LauncherConfig = {
      selectedMcps: ["gcp-observability"],
      gcpObservability: { project: "my-gcp-project" },
    };
    const result = buildResolvedFromSaved(config);
    assert.deepStrictEqual(result, {
      gcpObservability: { project: "my-gcp-project" },
    });
  });

  it("returns { kubernetes: { context } } for kubernetes-only config", () => {
    const config: LauncherConfig = {
      selectedMcps: ["kubernetes"],
      kubernetes: { context: "staging-cluster" },
    };
    const result = buildResolvedFromSaved(config);
    assert.deepStrictEqual(result, {
      kubernetes: { context: "staging-cluster" },
    });
  });

  it("skips MCPs whose config sub-object is missing", () => {
    const config: LauncherConfig = {
      // cloudwatch in selectedMcps but no cloudwatch sub-object
      selectedMcps: ["cloudwatch", "kubernetes"],
      kubernetes: { context: "dev-cluster" },
    };
    const result = buildResolvedFromSaved(config);
    // cloudwatch skipped, kubernetes included
    assert.deepStrictEqual(result, { kubernetes: { context: "dev-cluster" } });
  });

  it("returns correct ResolvedConfig with grafana cluster when cluster is found in fixture", () => {
    const fixturePath = writeGrafanaFixture([fakeCluster]);
    const config: LauncherConfig = {
      selectedMcps: ["grafana"],
      grafana: { clusterId: "prod-eu", role: "viewer" },
    };
    const result = buildResolvedFromSaved(config, fixturePath);
    assert.ok(result !== null, "expected non-null result");
    assert.deepStrictEqual(result!.grafana, {
      cluster: {
        id: fakeCluster.id,
        name: fakeCluster.name,
        url: fakeCluster.url,
        viewer_token: fakeCluster.viewer_token,
        editor_token: fakeCluster.editor_token,
      },
      role: "viewer",
    });
  });

  it("returns null when grafana cluster ID is not in fixture (stale ID)", () => {
    const fixturePath = writeGrafanaFixture([fakeCluster]);
    const config: LauncherConfig = {
      selectedMcps: ["grafana"],
      grafana: { clusterId: "stale-cluster-id", role: "viewer" },
    };
    const result = buildResolvedFromSaved(config, fixturePath);
    assert.strictEqual(result, null);
  });

  it("returns null when grafana YAML fixture file does not exist", () => {
    const missingPath = path.join(tmpDir, "nonexistent-grafana.yaml");
    const config: LauncherConfig = {
      selectedMcps: ["grafana"],
      grafana: { clusterId: "prod-eu", role: "editor" },
    };
    const result = buildResolvedFromSaved(config, missingPath);
    assert.strictEqual(result, null);
  });

  it("combines multiple MCPs in a single resolved config", () => {
    const config: LauncherConfig = {
      selectedMcps: ["cloudwatch", "gcp-observability", "kubernetes"],
      cloudwatch: { profile: "prod" },
      gcpObservability: { project: "gcp-prod" },
      kubernetes: { context: "prod-cluster" },
    };
    const result = buildResolvedFromSaved(config);
    assert.deepStrictEqual(result, {
      cloudwatch: { profile: "prod" },
      gcpObservability: { project: "gcp-prod" },
      kubernetes: { context: "prod-cluster" },
    });
  });
});
