import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as childProcess from "node:child_process";
import {
  TOKEN_DB_SCHEMA_SQL,
  initTokenDb,
  removeLegacySingletonStagingFiles,
} from "./token-db.js";

// ---------------------------------------------------------------------------
// Shared temp directory — cleaned up after all tests complete
// ---------------------------------------------------------------------------

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-tpk-token-db-test-"));

after(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

// ---------------------------------------------------------------------------
// TOKEN_DB_SCHEMA_SQL constant — schema anchor guardrail
// ---------------------------------------------------------------------------

describe("TOKEN_DB_SCHEMA_SQL", () => {
  it("contains the schema anchor comment", () => {
    assert.ok(
      TOKEN_DB_SCHEMA_SQL.includes("SCHEMA-ANCHOR: talekeeper.token_events.v1"),
      "TOKEN_DB_SCHEMA_SQL must contain the SCHEMA-ANCHOR comment so grep finds both copies",
    );
  });

  it("contains the token_events table definition", () => {
    assert.ok(
      TOKEN_DB_SCHEMA_SQL.includes("CREATE TABLE IF NOT EXISTS token_events"),
    );
  });

  it("contains the composite primary key", () => {
    assert.ok(
      TOKEN_DB_SCHEMA_SQL.includes(
        "PRIMARY KEY (session_id, agent_id, timestamp)",
      ),
    );
  });

  it("contains the repo_session index", () => {
    assert.ok(TOKEN_DB_SCHEMA_SQL.includes("idx_token_events_repo_session"));
  });
});

// ---------------------------------------------------------------------------
// initTokenDb — absent sqlite3
// Inject a fake spawnSync that simulates ENOENT (sqlite3 not found).
// ---------------------------------------------------------------------------

// Defined at module scope so the linter does not flag it as a function that
// could be hoisted (consistent-function-scoping rule).
function fakeSpawnSyncAbsent() {
  return {
    pid: null,
    output: [],
    stdout: Buffer.alloc(0),
    stderr: Buffer.alloc(0),
    status: null as number | null,
    signal: null,
    error: Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
  };
}

describe("initTokenDb — absent sqlite3", () => {
  it("does not throw and does not create the DB file when sqlite3 is absent", () => {
    const fakeHome = fs.mkdtempSync(path.join(tmpDir, "home-absent-"));
    const dbPath = path.join(fakeHome, ".ai-tpk", "tokens.db");

    const logs: string[] = [];
    assert.doesNotThrow(() =>
      initTokenDb(fakeHome, (msg) => logs.push(msg), fakeSpawnSyncAbsent),
    );

    // DB file must not have been created
    assert.ok(
      !fs.existsSync(dbPath),
      "DB file must not be created when sqlite3 is absent",
    );

    // One notice line must be logged
    assert.strictEqual(logs.length, 1);
    assert.ok(
      logs[0]?.includes("sqlite3 not found"),
      `expected 'sqlite3 not found' in log message, got: ${logs[0]}`,
    );
  });
});

// ---------------------------------------------------------------------------
// initTokenDb — present sqlite3, successful init
// ---------------------------------------------------------------------------

describe("initTokenDb — present sqlite3, successful init", () => {
  it("does not throw and logs success when sqlite3 is available", () => {
    // Check whether sqlite3 is actually available on this machine.
    const probe = childProcess.spawnSync("sqlite3", ["--version"], {
      stdio: "ignore",
    });
    if (probe.status !== 0 || probe.error) {
      // sqlite3 not available in this environment — skip with a warning.
      console.warn(
        "  [skip] sqlite3 not found in PATH; skipping real-binary init test",
      );
      return;
    }

    const fakeHome = fs.mkdtempSync(path.join(tmpDir, "home-success-"));
    fs.mkdirSync(path.join(fakeHome, ".ai-tpk"), { recursive: true });

    const logs: string[] = [];
    // Use the real spawnSync (no injection — tests with the real binary)
    assert.doesNotThrow(() => initTokenDb(fakeHome, (msg) => logs.push(msg)));

    assert.strictEqual(logs.length, 1);
    assert.ok(
      logs[0]?.includes("Initialized token DB schema"),
      `expected success message, got: ${logs[0]}`,
    );
  });
});

// ---------------------------------------------------------------------------
// initTokenDb — present sqlite3, non-zero exit
// Inject a fake spawnSync: probe succeeds, schema init fails.
// ---------------------------------------------------------------------------

// Call counter lives outside the function so it can be reset per test while
// the function itself remains at module scope (consistent-function-scoping).
let nonZeroCallCount = 0;
function fakeSpawnSyncNonZero() {
  nonZeroCallCount++;
  // First call: probe for sqlite3 — succeed
  if (nonZeroCallCount === 1) {
    return {
      pid: 1,
      output: [],
      stdout: Buffer.alloc(0),
      stderr: Buffer.alloc(0),
      status: 0 as number | null,
      signal: null,
      error: undefined,
    };
  }
  // Second call: schema init — fail
  return {
    pid: 1,
    output: [],
    stdout: Buffer.alloc(0),
    stderr: Buffer.alloc(0),
    status: 1 as number | null,
    signal: null,
    error: undefined,
  };
}

describe("initTokenDb — present sqlite3, non-zero exit", () => {
  it("does not throw and logs a warning when sqlite3 exits non-zero", () => {
    const fakeHome = fs.mkdtempSync(path.join(tmpDir, "home-fail-"));
    nonZeroCallCount = 0; // reset for this test

    const logs: string[] = [];
    assert.doesNotThrow(() =>
      initTokenDb(fakeHome, (msg) => logs.push(msg), fakeSpawnSyncNonZero),
    );

    assert.strictEqual(logs.length, 1);
    assert.ok(
      logs[0]?.toLowerCase().includes("warning"),
      `expected a warning message, got: ${logs[0]}`,
    );
  });
});

// ---------------------------------------------------------------------------
// removeLegacySingletonStagingFiles
// ---------------------------------------------------------------------------

describe("removeLegacySingletonStagingFiles", () => {
  it("removes talekeeper-raw.jsonl from each repo slug directory and logs a notice", () => {
    const fakeHome = fs.mkdtempSync(path.join(tmpDir, "home-legacy-"));
    const logsDir = path.join(fakeHome, ".ai-tpk", "logs");
    const repoDir = path.join(logsDir, "my-repo");
    fs.mkdirSync(repoDir, { recursive: true });

    const legacyFile = path.join(repoDir, "talekeeper-raw.jsonl");
    fs.writeFileSync(legacyFile, "old staging data\n", "utf8");

    const logs: string[] = [];
    removeLegacySingletonStagingFiles(fakeHome, (msg) => logs.push(msg));

    assert.ok(!fs.existsSync(legacyFile), "legacy file must be removed");
    assert.strictEqual(logs.length, 1);
    assert.ok(
      logs[0]?.includes("legacy") || logs[0]?.includes("Removing"),
      `expected legacy removal notice, got: ${logs[0]}`,
    );
  });

  it("does not throw when the logs directory does not exist", () => {
    const fakeHome = fs.mkdtempSync(path.join(tmpDir, "home-no-logs-"));
    const logs: string[] = [];
    assert.doesNotThrow(() =>
      removeLegacySingletonStagingFiles(fakeHome, (msg) => logs.push(msg)),
    );
    assert.strictEqual(logs.length, 0);
  });

  it("does not remove session-namespaced staging files", () => {
    const fakeHome = fs.mkdtempSync(path.join(tmpDir, "home-namespaced-"));
    const logsDir = path.join(fakeHome, ".ai-tpk", "logs");
    const repoDir = path.join(logsDir, "my-repo");
    fs.mkdirSync(repoDir, { recursive: true });

    // Session-namespaced file — must NOT be removed
    const namespacedFile = path.join(repoDir, "talekeeper-raw-abc123.jsonl");
    fs.writeFileSync(namespacedFile, "per-session staging\n", "utf8");

    const logs: string[] = [];
    removeLegacySingletonStagingFiles(fakeHome, (msg) => logs.push(msg));

    assert.ok(
      fs.existsSync(namespacedFile),
      "session-namespaced staging file must NOT be removed",
    );
    assert.strictEqual(logs.length, 0);
  });
});
