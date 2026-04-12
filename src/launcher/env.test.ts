import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { buildEnvVars } from "./env.js";
import type { ResolvedConfig, GrafanaCluster } from "./types.js";

// ---------------------------------------------------------------------------
// Dotfile isolation strategy:
//
// `buildEnvVars` writes ~/.claude/.current-aws-profile whenever CloudWatch is
// configured. We back up the real file before the suite runs and restore it
// (or remove the file) afterwards. This keeps tests hermetic without
// suppressing the real write, which means the dotfile path remains exercised.
// ---------------------------------------------------------------------------

const dotfileDir = path.join(os.homedir(), ".claude");
const dotfilePath = path.join(dotfileDir, ".current-aws-profile");

let priorDotfileContent: string | null = null;

before(() => {
  if (fs.existsSync(dotfilePath)) {
    priorDotfileContent = fs.readFileSync(dotfilePath, "utf8");
  }
});

after(() => {
  if (priorDotfileContent !== null) {
    fs.mkdirSync(dotfileDir, { recursive: true });
    fs.writeFileSync(dotfilePath, priorDotfileContent, {
      mode: 0o600,
      encoding: "utf8",
    });
  } else if (fs.existsSync(dotfilePath)) {
    fs.rmSync(dotfilePath);
  }
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fakeCluster: GrafanaCluster = {
  id: "test-cluster",
  name: "Test Cluster",
  url: "https://grafana.test.example.com",
  viewer_token: "viewer-token-abc",
  editor_token: "editor-token-xyz",
};

// ---------------------------------------------------------------------------
// buildEnvVars
// ---------------------------------------------------------------------------

describe("buildEnvVars", () => {
  it("Grafana viewer: sets URL, token from viewer_token, and GRAFANA_DISABLE_WRITE=true", () => {
    const config: ResolvedConfig = {
      grafana: { cluster: fakeCluster, role: "viewer" },
    };
    const env = buildEnvVars(config);
    assert.strictEqual(env["GRAFANA_URL"], fakeCluster.url);
    assert.strictEqual(
      env["GRAFANA_SERVICE_ACCOUNT_TOKEN"],
      fakeCluster.viewer_token,
    );
    assert.strictEqual(env["GRAFANA_DISABLE_WRITE"], "true");
  });

  it("Grafana editor: sets URL and token from editor_token, and GRAFANA_DISABLE_WRITE is absent", () => {
    const config: ResolvedConfig = {
      grafana: { cluster: fakeCluster, role: "editor" },
    };
    const env = buildEnvVars(config);
    assert.strictEqual(env["GRAFANA_URL"], fakeCluster.url);
    assert.strictEqual(
      env["GRAFANA_SERVICE_ACCOUNT_TOKEN"],
      fakeCluster.editor_token,
    );
    assert.ok(
      !Object.prototype.hasOwnProperty.call(env, "GRAFANA_DISABLE_WRITE"),
      "GRAFANA_DISABLE_WRITE must not be present for editor role",
    );
  });

  it("CloudWatch only: returns AWS_PROFILE", () => {
    const config: ResolvedConfig = {
      cloudwatch: { profile: "my-dev-profile" },
    };
    const env = buildEnvVars(config);
    assert.strictEqual(env["AWS_PROFILE"], "my-dev-profile");
    assert.ok(
      !Object.prototype.hasOwnProperty.call(env, "GRAFANA_URL"),
      "GRAFANA_URL must not be present when no Grafana config",
    );
  });

  it("Grafana + CloudWatch combined: all keys merged correctly", () => {
    const config: ResolvedConfig = {
      grafana: { cluster: fakeCluster, role: "viewer" },
      cloudwatch: { profile: "prod" },
    };
    const env = buildEnvVars(config);
    assert.strictEqual(env["GRAFANA_URL"], fakeCluster.url);
    assert.strictEqual(
      env["GRAFANA_SERVICE_ACCOUNT_TOKEN"],
      fakeCluster.viewer_token,
    );
    assert.strictEqual(env["GRAFANA_DISABLE_WRITE"], "true");
    assert.strictEqual(env["AWS_PROFILE"], "prod");
  });

  it("empty config ({}): returns empty env var map", () => {
    const config: ResolvedConfig = {};
    const env = buildEnvVars(config);
    assert.deepStrictEqual(env, {});
  });
});
