import { spawnSync as nodeSpawnSync } from "node:child_process";
import type { SpawnSyncOptionsWithBufferEncoding } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import { c } from "./colors.js";

// SCHEMA-ANCHOR: talekeeper.token_events.v1
// If you change this schema, update claude/scripts/talekeeper-index.sh (same anchor).
// This is a deliberate duplicate per Constitution Principle 2 — the installed indexer
// must be self-contained without back-references to this repo. Use the grep anchor to
// keep the two copies in sync:
//   grep -rn 'SCHEMA-ANCHOR: talekeeper.token_events.v1' .
export const TOKEN_DB_SCHEMA_SQL = [
  "-- SCHEMA-ANCHOR: talekeeper.token_events.v1",
  "PRAGMA busy_timeout = 5000;",
  "CREATE TABLE IF NOT EXISTS token_events (",
  "  session_id TEXT NOT NULL,",
  "  agent_id TEXT NOT NULL,",
  "  timestamp TEXT NOT NULL,",
  "  repo_slug TEXT NOT NULL,",
  "  agent_type TEXT,",
  "  event_type TEXT,",
  "  verdict TEXT,",
  "  input_tokens INTEGER NOT NULL DEFAULT 0,",
  "  output_tokens INTEGER NOT NULL DEFAULT 0,",
  "  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,",
  "  cache_read_tokens INTEGER NOT NULL DEFAULT 0,",
  "  indexed_at TEXT NOT NULL,",
  "  PRIMARY KEY (session_id, agent_id, timestamp)",
  ");",
  "CREATE INDEX IF NOT EXISTS idx_token_events_repo_session",
  "  ON token_events (repo_slug, session_id);",
].join("\n");

// Minimal type matching the spawnSync signature we use.
type SpawnSyncFn = (
  cmd: string,
  args: string[],
  opts?:
    | SpawnSyncOptionsWithBufferEncoding
    | { input: string; stdio: ("pipe" | "ignore")[] },
) => { status: number | null; error?: Error };

export function initTokenDb(
  homeDir: string,
  log: (msg: string) => void,
  // Injectable for testing; defaults to the real spawnSync.
  spawnSyncFn: SpawnSyncFn = nodeSpawnSync as unknown as SpawnSyncFn,
): void {
  const dbPath = path.join(homeDir, ".ai-tpk", "tokens.db");

  // Check sqlite3 availability.
  // The indexer script is fully silent on sqlite3 absence; the installer is
  // allowed (and expected) to surface a one-line user-facing notice during setup.
  const probe = spawnSyncFn("sqlite3", ["--version"], {
    stdio: "ignore",
  } as SpawnSyncOptionsWithBufferEncoding);
  if (probe.status !== 0 || probe.error) {
    log(c.yellow("Skipping SQLite token DB init (sqlite3 not found in PATH)"));
    return;
  }

  // Initialize schema (idempotent — CREATE TABLE IF NOT EXISTS).
  const result = spawnSyncFn("sqlite3", [dbPath], {
    input: TOKEN_DB_SCHEMA_SQL,
    stdio: ["pipe", "ignore", "ignore"],
  } as unknown as SpawnSyncOptionsWithBufferEncoding);

  if (result.status !== 0) {
    log(
      c.yellow(
        "Warning: sqlite3 schema init failed; the indexer will create the schema on first run",
      ),
    );
    return;
  }

  log(c.green(`✓ Initialized token DB schema: ${dbPath}`));
}

export function removeLegacySingletonStagingFiles(
  homeDir: string,
  log: (msg: string) => void,
): void {
  // Remove legacy talekeeper-raw.jsonl files (no session-ID suffix) left over
  // from before per-session staging was introduced. These are staging files
  // (not chronicles), so deletion is safe — the new per-session enrich hook
  // will never read them.
  const logsDir = path.join(homeDir, ".ai-tpk", "logs");

  let slugEntries: fs.Dirent[];
  try {
    slugEntries = fs.readdirSync(logsDir, { withFileTypes: true });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return; // logs dir does not exist yet — nothing to clean
    }
    throw err;
  }

  for (const entry of slugEntries) {
    if (!entry.isDirectory()) continue;
    const legacyPath = path.join(logsDir, entry.name, "talekeeper-raw.jsonl");
    try {
      fs.unlinkSync(legacyPath);
      log(c.yellow(`Removing legacy shared staging file: ${legacyPath}`));
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        continue; // file does not exist — nothing to do
      }
      throw err;
    }
  }
}
