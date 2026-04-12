import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadConfig, saveConfig } from "./config.js";

// ---------------------------------------------------------------------------
// The real CONFIG_FILE path (hardcoded in config.ts — no path injection).
// We back up any existing file before the suite and restore it after.
// ---------------------------------------------------------------------------

const configDir = path.join(os.homedir(), ".config", "myclaude");
// Re-derive using the same logic as config.ts
const REAL_CONFIG_FILE = path.join(
  os.homedir(),
  ".config",
  "myclaude",
  "config.json",
);

// Temp dir for scratch space used in tests that need it
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-tpk-config-test-"));

// Snapshot state before any tests run
let priorContent: string | null = null;
let priorDirExisted = false;

before(() => {
  priorDirExisted = fs.existsSync(configDir);
  if (fs.existsSync(REAL_CONFIG_FILE)) {
    priorContent = fs.readFileSync(REAL_CONFIG_FILE, "utf8");
  }
});

after(() => {
  // Restore original state
  if (priorContent !== null) {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(REAL_CONFIG_FILE, priorContent, "utf8");
  } else if (!priorDirExisted && fs.existsSync(configDir)) {
    // We created the dir during tests; remove it
    fs.rmSync(configDir, { recursive: true });
  } else if (priorDirExisted && fs.existsSync(REAL_CONFIG_FILE)) {
    // Dir existed but file did not — remove just the file
    if (priorContent === null) {
      fs.rmSync(REAL_CONFIG_FILE, { force: true });
    }
  }

  fs.rmSync(tmpDir, { recursive: true });
});

// Helper: ensure the real config file does not exist before a test
function removeConfigFile(): void {
  if (fs.existsSync(REAL_CONFIG_FILE)) {
    fs.rmSync(REAL_CONFIG_FILE);
  }
}

// ---------------------------------------------------------------------------
// loadConfig
// ---------------------------------------------------------------------------

describe("loadConfig", () => {
  it("returns { selectedMcps: [] } when file does not exist", () => {
    removeConfigFile();
    const result = loadConfig();
    assert.deepStrictEqual(result, { selectedMcps: [] });
  });

  it("returns { selectedMcps: [] } when file contains malformed JSON", () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(REAL_CONFIG_FILE, "not valid json {{", "utf8");
    const result = loadConfig();
    assert.deepStrictEqual(result, { selectedMcps: [] });
  });

  it("correctly parses a valid config file", () => {
    const config = {
      selectedMcps: ["grafana", "cloudwatch"],
      cloudwatch: { profile: "my-profile" },
    };
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(REAL_CONFIG_FILE, JSON.stringify(config), "utf8");
    const result = loadConfig();
    assert.deepStrictEqual(result, config);
  });
});

// ---------------------------------------------------------------------------
// saveConfig
// ---------------------------------------------------------------------------

describe("saveConfig", () => {
  it("creates the directory and file when they do not exist", () => {
    // Remove both file and dir so saveConfig must create them from scratch
    if (fs.existsSync(REAL_CONFIG_FILE)) {
      fs.rmSync(REAL_CONFIG_FILE);
    }
    if (fs.existsSync(configDir)) {
      fs.rmSync(configDir, { recursive: true });
    }
    saveConfig({ selectedMcps: ["grafana"] });
    assert.ok(
      fs.existsSync(REAL_CONFIG_FILE),
      "config file should exist after saveConfig",
    );
  });

  it("overwrites an existing config file", () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      REAL_CONFIG_FILE,
      JSON.stringify({ selectedMcps: ["old"] }),
      "utf8",
    );
    saveConfig({ selectedMcps: ["new"] });
    const written = JSON.parse(
      fs.readFileSync(REAL_CONFIG_FILE, "utf8"),
    ) as unknown;
    assert.deepStrictEqual(written, { selectedMcps: ["new"] });
  });

  it("round-trip: saveConfig then loadConfig returns the same data", () => {
    const config = {
      selectedMcps: ["grafana", "cloudwatch"],
      grafana: { clusterId: "prod", role: "viewer" as const },
      cloudwatch: { profile: "default" },
    };
    saveConfig(config);
    const loaded = loadConfig();
    assert.deepStrictEqual(loaded, config);
  });

  it("writes the file with mode 0o600", () => {
    saveConfig({ selectedMcps: [] });
    const mode = fs.statSync(REAL_CONFIG_FILE).mode & 0o777;
    assert.strictEqual(
      mode,
      0o600,
      `expected mode 0o600, got 0o${mode.toString(8)}`,
    );
  });
});
