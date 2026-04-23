#!/usr/bin/env bash
# talekeeper-index.sh — optional SQLite indexer for Talekeeper session chronicles
# Usage: talekeeper-index.sh [--quiet|--verbose|--help]
#
# Reads all talekeeper-*.jsonl chronicle files (excluding staging files) from
# TALEKEEPER_LOGS_ROOT (default: ~/.ai-tpk/logs) and upserts their rows into
# a SQLite database at TALEKEEPER_DB (default: ~/.ai-tpk/tokens.db).
#
# Exits 0 silently when sqlite3 or jq is not in PATH — the indexer is a no-op
# when its optional dependencies are absent.
#
# Exits 1 with a stderr message if sqlite3 returns non-zero (e.g., SQLITE_BUSY
# after the busy_timeout has elapsed). This is intentional: the indexer is
# user-invoked, so surfacing the failure is the correct behaviour. The script's
# set -euo pipefail already enforces this; do not soften it.

set -euo pipefail

# ---------------------------------------------------------------------------
# Dependency guards — silent no-op when optional tools are absent.
# These must be the first two substantive lines so the script exits 0
# before touching any paths or printing anything.
# ---------------------------------------------------------------------------
command -v sqlite3 >/dev/null 2>&1 || { exit 0; }
command -v jq >/dev/null 2>&1 || { exit 0; }

# ---------------------------------------------------------------------------
# Environment variable overrides — first-class variables, not buried in tests.
# Both exist so test fixtures can isolate the indexer from production data.
# ---------------------------------------------------------------------------
DB_PATH="${TALEKEEPER_DB:-$HOME/.ai-tpk/tokens.db}"
LOGS_ROOT="${TALEKEEPER_LOGS_ROOT:-$HOME/.ai-tpk/logs}"
mkdir -p "$(dirname "$DB_PATH")" 2>/dev/null || true

# ---------------------------------------------------------------------------
# Flags
# ---------------------------------------------------------------------------
VERBOSE=0

show_help() {
  printf '%s\n' \
    'Usage: talekeeper-index.sh [--quiet] [--verbose] [--help]' \
    '' \
    'Index Talekeeper session chronicles into a SQLite token-events database.' \
    '' \
    'Options:' \
    '  --quiet    (default) Print only a single summary line on completion.' \
    '  --verbose  Print one line per file processed.' \
    '  --help     Show this help and exit.' \
    '' \
    'Environment:' \
    '  TALEKEEPER_DB        Override the database path (default: ~/.ai-tpk/tokens.db)' \
    '  TALEKEEPER_LOGS_ROOT Override the logs root path (default: ~/.ai-tpk/logs)' \
    '' \
    'Behaviour:' \
    '  - Exits 0 silently when sqlite3 or jq is not in PATH.' \
    '  - Reads chronicle files under TALEKEEPER_LOGS_ROOT/*/*, excluding staging' \
    '    files matching talekeeper-raw-*.jsonl.' \
    '  - Uses each row'\''s own session_id field as the natural key (not the' \
    '    filename), so legacy mixed-session chronicle files index correctly.' \
    '  - INSERT OR REPLACE keyed on (session_id, agent_id, timestamp) for idempotency.' \
    '  - Sets PRAGMA busy_timeout = 5000 so concurrent indexer runs serialise' \
    '    rather than fail with SQLITE_BUSY.' \
    '  - Exits 1 with a stderr message if sqlite3 exits non-zero.'
}

for arg in "$@"; do
  case "$arg" in
    --verbose) VERBOSE=1 ;;
    --quiet)   VERBOSE=0 ;;
    --help|-h) show_help; exit 0 ;;
    *)
      printf 'talekeeper-index.sh: unknown flag: %s\n' "$arg" >&2
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Orphaned temp file cleanup — runs before indexing.
# This cleanup was deliberately moved out of the enrich hook (to avoid running
# on every Stop event). On a system where the indexer is never run, orphaned
# files accumulate harmlessly until the next invocation.
# ---------------------------------------------------------------------------
find "$LOGS_ROOT" -mindepth 2 -maxdepth 2 -type f -name 'talekeeper-*.jsonl.tmp.*' -mmin +60 -delete 2>/dev/null || true

# ---------------------------------------------------------------------------
# Early exit when the logs root does not exist — nothing to index.
# ---------------------------------------------------------------------------
if [[ ! -d "$LOGS_ROOT" ]]; then
  exit 0
fi

# ---------------------------------------------------------------------------
# Schema initialisation — idempotent via IF NOT EXISTS.
#
# SCHEMA-ANCHOR: talekeeper.token_events.v1
# If you change this schema, update src/installer/token-db.ts (same anchor).
#
# PRAGMA busy_timeout = 5000 ensures concurrent indexer invocations serialise
# rather than fail immediately with SQLITE_BUSY.
# ---------------------------------------------------------------------------
sqlite3 "$DB_PATH" <<'SCHEMA_SQL' >/dev/null
PRAGMA busy_timeout = 5000;
CREATE TABLE IF NOT EXISTS token_events (
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  repo_slug TEXT NOT NULL,
  agent_type TEXT,
  event_type TEXT,
  verdict TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  indexed_at TEXT NOT NULL,
  PRIMARY KEY (session_id, agent_id, timestamp)
);
CREATE INDEX IF NOT EXISTS idx_token_events_repo_session
  ON token_events (repo_slug, session_id);
SCHEMA_SQL

# ---------------------------------------------------------------------------
# Index chronicle files
# ---------------------------------------------------------------------------
TOTAL_ROWS=0
TOTAL_FILES=0

# Temp files — cleaned up on exit.
TSV_TMP="$(mktemp)"
SQL_TMP="$(mktemp)"
trap 'rm -f "$TSV_TMP" "$SQL_TMP"' EXIT

while IFS= read -r -d '' file; do
  repo_slug="$(basename "$(dirname "$file")")"
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  # Stream each row through jq, produce TSV lines for sqlite3 import.
  # Uses each row's own session_id (not the filename) as the natural key —
  # this is what makes legacy mixed-session chronicle files index correctly.
  if ! jq -r \
    --arg repo "$repo_slug" \
    --arg now "$now" \
    'select(has("session_id") and has("agent_id") and has("timestamp"))
    | [
        .session_id,
        .agent_id,
        .timestamp,
        $repo,
        (.agent_type // ""),
        (.event_type // ""),
        (if .verdict == null then "" else .verdict end),
        (.input_tokens // 0),
        (.output_tokens // 0),
        (.cache_creation_input_tokens // 0),
        (.cache_read_input_tokens // 0),
        $now
      ]
    | @tsv' \
    "$file" >"$TSV_TMP" 2>/dev/null; then
    [[ "$VERBOSE" -eq 1 ]] && printf 'warn: jq failed on %s, skipping\n' "$file" >&2
    continue
  fi

  if [[ ! -s "$TSV_TMP" ]]; then
    continue
  fi

  row_count="$(wc -l <"$TSV_TMP" | tr -d ' ')"

  # Build a sqlite3 script file that uses dot-commands for TSV import.
  # Dot-commands (.mode, .import) only work via a script file or stdin —
  # not as a -cmd argument. We write a script to a temp file and pass it
  # to sqlite3 via stdin redirection.
  #
  # Wrapped in BEGIN IMMEDIATE ... COMMIT for transactional consistency.
  # PRAGMA busy_timeout is re-asserted so it applies to this transaction.
  printf '%s\n' \
    "PRAGMA busy_timeout = 5000;" \
    "BEGIN IMMEDIATE;" \
    "CREATE TEMP TABLE IF NOT EXISTS _stage (session_id TEXT, agent_id TEXT, timestamp TEXT, repo_slug TEXT, agent_type TEXT, event_type TEXT, verdict TEXT, input_tokens INTEGER, output_tokens INTEGER, cache_creation_tokens INTEGER, cache_read_tokens INTEGER, indexed_at TEXT);" \
    "DELETE FROM _stage;" \
    ".mode tabs" \
    ".import $TSV_TMP _stage" \
    "INSERT OR REPLACE INTO token_events SELECT * FROM _stage;" \
    "DROP TABLE _stage;" \
    "COMMIT;" \
    >"$SQL_TMP"

  sqlite3 "$DB_PATH" <"$SQL_TMP" >/dev/null

  TOTAL_ROWS=$(( TOTAL_ROWS + row_count ))
  TOTAL_FILES=$(( TOTAL_FILES + 1 ))

  if [[ "$VERBOSE" -eq 1 ]]; then
    printf 'indexed: %s/%s (%d rows)\n' "$repo_slug" "$(basename "$file")" "$row_count"
  fi

done < <(find "$LOGS_ROOT" \
  -mindepth 2 -maxdepth 2 \
  -type f \
  -name 'talekeeper-*.jsonl' \
  -not -name 'talekeeper-raw-*.jsonl' \
  -print0)

printf 'indexed %d rows from %d files into %s\n' "$TOTAL_ROWS" "$TOTAL_FILES" "$DB_PATH"
