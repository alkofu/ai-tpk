import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as prompts from "@clack/prompts";
import { loadArgoCdAccounts, argoCdCommand } from "./argocd.js";
import type { ResolvedConfig, LauncherConfig } from "../types.js";

// ---------------------------------------------------------------------------
// Shared temp directory — cleaned up after all tests complete
// ---------------------------------------------------------------------------

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-tpk-argocd-test-"));

after(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

// ---------------------------------------------------------------------------
// Helper: write a file to the temp dir and return its path
// ---------------------------------------------------------------------------

function writeTempFile(name: string, content: string): string {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

// ---------------------------------------------------------------------------
// loadArgoCdAccounts — loader tests
// ---------------------------------------------------------------------------

describe("loadArgoCdAccounts", () => {
  it("valid one cluster → returns one ArgoCdCluster with correct id, url, token", () => {
    const filePath = writeTempFile(
      "one-cluster.json",
      JSON.stringify({
        "prod-east": {
          url: "https://argocd.prod-east.example.com",
          token: "tok-abc",
        },
      }),
    );
    fs.chmodSync(filePath, 0o600);
    const clusters = loadArgoCdAccounts(filePath);
    assert.strictEqual(clusters.length, 1);
    assert.strictEqual(clusters[0]!.id, "prod-east");
    assert.strictEqual(
      clusters[0]!.url,
      "https://argocd.prod-east.example.com",
    );
    assert.strictEqual(clusters[0]!.token, "tok-abc");
  });

  it("valid three clusters → returns three entries sorted alphabetically by id", () => {
    const filePath = writeTempFile(
      "three-clusters.json",
      JSON.stringify({
        charlie: { url: "https://argocd.charlie.example.com", token: "tok-c" },
        alpha: { url: "https://argocd.alpha.example.com", token: "tok-a" },
        bravo: { url: "https://argocd.bravo.example.com", token: "tok-b" },
      }),
    );
    fs.chmodSync(filePath, 0o600);
    const clusters = loadArgoCdAccounts(filePath);
    assert.strictEqual(clusters.length, 3);
    assert.deepStrictEqual(
      clusters.map((c) => c.id),
      ["alpha", "bravo", "charlie"],
    );
  });

  it("missing file → throws with message containing 'ArgoCD accounts file not found'", () => {
    const missingPath = path.join(tmpDir, "does-not-exist.json");
    assert.throws(
      () => loadArgoCdAccounts(missingPath),
      (err: unknown) =>
        err instanceof Error &&
        err.message.includes("ArgoCD accounts file not found"),
    );
  });

  it("invalid JSON → throws with message containing 'is not valid JSON'", () => {
    const filePath = writeTempFile("invalid.json", "{ not valid json }");
    assert.throws(
      () => loadArgoCdAccounts(filePath),
      (err: unknown) =>
        err instanceof Error && err.message.includes("is not valid JSON"),
    );
  });

  it("null value (null JSON) → throws with message containing 'must be a flat JSON object'", () => {
    const filePath = writeTempFile("null-value.json", "null");
    assert.throws(
      () => loadArgoCdAccounts(filePath),
      (err: unknown) =>
        err instanceof Error &&
        err.message.includes("must be a flat JSON object"),
    );
  });

  it("array value ([] JSON) → throws with message containing 'must be a flat JSON object'", () => {
    const filePath = writeTempFile("array-value.json", "[]");
    assert.throws(
      () => loadArgoCdAccounts(filePath),
      (err: unknown) =>
        err instanceof Error &&
        err.message.includes("must be a flat JSON object"),
    );
  });

  it("empty object ({} JSON) → throws with message containing 'contains no clusters'", () => {
    const filePath = writeTempFile("empty-object.json", "{}");
    assert.throws(
      () => loadArgoCdAccounts(filePath),
      (err: unknown) =>
        err instanceof Error && err.message.includes("contains no clusters"),
    );
  });

  it("cluster id with space → throws with message containing 'contains characters outside'", () => {
    const filePath = writeTempFile(
      "bad-id.json",
      JSON.stringify({
        "invalid id": { url: "https://example.com", token: "tok" },
      }),
    );
    assert.throws(
      () => loadArgoCdAccounts(filePath),
      (err: unknown) =>
        err instanceof Error &&
        err.message.includes("contains characters outside"),
    );
  });

  it("missing token field → throws with message containing 'must have string fields'", () => {
    const filePath = writeTempFile(
      "missing-token.json",
      JSON.stringify({ prod: { url: "https://argocd.example.com" } }),
    );
    assert.throws(
      () => loadArgoCdAccounts(filePath),
      (err: unknown) =>
        err instanceof Error && err.message.includes("must have string fields"),
    );
  });

  it("invalid URL (ftp://example) → throws with message containing 'missing or invalid url'", () => {
    const filePath = writeTempFile(
      "ftp-url.json",
      JSON.stringify({ prod: { url: "ftp://example.com", token: "tok" } }),
    );
    assert.throws(
      () => loadArgoCdAccounts(filePath),
      (err: unknown) =>
        err instanceof Error && err.message.includes("missing or invalid url"),
    );
  });

  it("empty token ('') → throws with message containing 'empty token'", () => {
    const filePath = writeTempFile(
      "empty-token.json",
      JSON.stringify({
        prod: { url: "https://argocd.example.com", token: "" },
      }),
    );
    assert.throws(
      () => loadArgoCdAccounts(filePath),
      (err: unknown) =>
        err instanceof Error && err.message.includes("empty token"),
    );
  });

  it("file-mode warning: 0o644 file triggers log.warn with 'is readable by other users'", () => {
    const filePath = writeTempFile(
      "world-readable.json",
      JSON.stringify({
        prod: { url: "https://argocd.example.com", token: "tok" },
      }),
    );
    fs.chmodSync(filePath, 0o644);

    const warnCalls: unknown[][] = [];
    const originalWarn = (
      prompts as unknown as { log: { warn: (...args: unknown[]) => void } }
    ).log.warn;
    (
      prompts as unknown as { log: { warn: (...args: unknown[]) => void } }
    ).log.warn = (...args: unknown[]) => {
      warnCalls.push(args);
    };

    let clusters;
    try {
      clusters = loadArgoCdAccounts(filePath);
    } finally {
      (
        prompts as unknown as { log: { warn: (...args: unknown[]) => void } }
      ).log.warn = originalWarn;
    }

    assert.strictEqual(clusters!.length, 1);
    assert.ok(
      warnCalls.some((args) =>
        args.some(
          (a) =>
            typeof a === "string" && a.includes("is readable by other users"),
        ),
      ),
      "log.warn should have been called with a message containing 'is readable by other users'",
    );
  });
});

// ---------------------------------------------------------------------------
// argoCdCommand — McpCommand contract tests
// ---------------------------------------------------------------------------

describe("argoCdCommand contract", () => {
  // ---------------------------------------------------------------------------
  // before/after for dotfile isolation (emitEnvVars writes .current-argocd-cluster)
  // ---------------------------------------------------------------------------
  const dotfileDir = path.join(os.homedir(), ".claude");
  const argocdDotfilePath = path.join(dotfileDir, ".current-argocd-cluster");
  let priorArgoCdDotfileContent: string | null = null;

  before(() => {
    if (fs.existsSync(argocdDotfilePath)) {
      priorArgoCdDotfileContent = fs.readFileSync(argocdDotfilePath, "utf8");
    }
  });

  after(() => {
    if (priorArgoCdDotfileContent !== null) {
      fs.mkdirSync(dotfileDir, { recursive: true });
      fs.writeFileSync(argocdDotfilePath, priorArgoCdDotfileContent, {
        mode: 0o600,
        encoding: "utf8",
      });
    } else if (fs.existsSync(argocdDotfilePath)) {
      fs.rmSync(argocdDotfilePath);
    }
  });

  it("id, skippedKey, multiselectOption.value are all 'argocd'", () => {
    assert.strictEqual(argoCdCommand.id, "argocd");
    assert.strictEqual(argoCdCommand.skippedKey, "argocd");
    assert.strictEqual(argoCdCommand.multiselectOption.value, "argocd");
  });

  it("buildOutroSuccessLine with undefined argocd → null", () => {
    const resolved: ResolvedConfig = {};
    assert.strictEqual(argoCdCommand.buildOutroSuccessLine(resolved), null);
  });

  it("buildOutroSuccessLine with argocd cluster → 'ArgoCD: prod-east'", () => {
    const resolved: ResolvedConfig = {
      argocd: { cluster: { id: "prod-east", url: "https://x", token: "t" } },
    };
    assert.strictEqual(
      argoCdCommand.buildOutroSuccessLine(resolved),
      "ArgoCD: prod-east",
    );
  });

  it("buildOutroSkipLine(false) → null; buildOutroSkipLine('loader-failed') → skip message", () => {
    assert.strictEqual(argoCdCommand.buildOutroSkipLine(false), null);
    assert.strictEqual(
      argoCdCommand.buildOutroSkipLine("loader-failed"),
      "ArgoCD: skipped (accounts unavailable)",
    );
  });

  it("buildSummaryLine with argocd undefined → '(not yet configured)'", () => {
    const config: LauncherConfig = { selectedMcps: ["argocd"] };
    assert.strictEqual(
      argoCdCommand.buildSummaryLine(config),
      "ArgoCD: (not yet configured)",
    );
  });

  it("buildSummaryLine with clusterId → 'ArgoCD: cluster prod-east'", () => {
    const config: LauncherConfig = {
      selectedMcps: ["argocd"],
      argocd: { clusterId: "prod-east" },
    };
    assert.strictEqual(
      argoCdCommand.buildSummaryLine(config),
      "ArgoCD: cluster prod-east",
    );
  });

  it("emitEnvVars with argocd cluster → sets ARGOCD_BASE_URL and ARGOCD_API_TOKEN", () => {
    const resolved: ResolvedConfig = {
      argocd: {
        cluster: {
          id: "prod-east",
          url: "https://argocd.prod.example.com",
          token: "secret-token",
        },
      },
    };
    const env: Record<string, string> = {};
    // emitEnvVars also calls writeDotfile — that's fine for this test
    argoCdCommand.emitEnvVars(resolved, env);
    assert.strictEqual(
      env["ARGOCD_BASE_URL"],
      "https://argocd.prod.example.com",
    );
    assert.strictEqual(env["ARGOCD_API_TOKEN"], "secret-token");
  });

  it("emitEnvVars with resolved.argocd undefined → env stays empty", () => {
    const resolved: ResolvedConfig = {};
    const env: Record<string, string> = {};
    argoCdCommand.emitEnvVars(resolved, env);
    assert.deepStrictEqual(env, {});
  });
});
