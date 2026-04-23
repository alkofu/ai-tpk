#!/usr/bin/env bash
# test-talekeeper-index.sh — automated test fixture for talekeeper-index.sh
#
# Tests:
#   1. A chronicle with two distinct session_ids produces 2 rows and 2
#      distinct session_ids in token_events.
#   2. Re-running the indexer over the same data is idempotent (row count
#      does not change).
#   3. Staging files (talekeeper-raw-*.jsonl) are NOT indexed.
#   4. The indexer exits 0 silently when sqlite3 is absent (PATH restriction).
#
# Usage: bash claude/scripts/test-talekeeper-index.sh
# Exit:  0 on success, 1 on any assertion failure.

set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve the directory containing this test script so absolute paths work
# regardless of cwd.
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INDEXER="$SCRIPT_DIR/talekeeper-index.sh"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
PASS=0
FAIL=0

pass() { printf '[PASS] %s\n' "$1"; PASS=$(( PASS + 1 )); }
fail() { printf '[FAIL] %s\n' "$1" >&2; FAIL=$(( FAIL + 1 )); }

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    pass "$label"
  else
    fail "$label — expected '$expected', got '$actual'"
  fi
}

# ---------------------------------------------------------------------------
# Temp directory — cleaned up on exit
# ---------------------------------------------------------------------------
TMPDIR_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_ROOT"' EXIT

# Create the repo-slug subdirectory (mindepth 2 requirement of the indexer)
LOGS_DIR="$TMPDIR_ROOT/logs"
REPO_DIR="$LOGS_DIR/test-repo"
mkdir -p "$REPO_DIR"

DB="$TMPDIR_ROOT/test.db"

# ---------------------------------------------------------------------------
# Fixture: a single chronicle file with TWO distinct session_ids
# ---------------------------------------------------------------------------
CHRONICLE="$REPO_DIR/talekeeper-fixture-session.jsonl"

cat >"$CHRONICLE" <<'JSONL'
{"session_id":"aaaa-1111","agent_id":"agent-001","timestamp":"2026-04-01T10:00:00Z","agent_type":"bitsmith","event_type":"SubagentStop","verdict":"","input_tokens":100,"output_tokens":200,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}
{"session_id":"bbbb-2222","agent_id":"agent-002","timestamp":"2026-04-01T11:00:00Z","agent_type":"ruinor","event_type":"SubagentStop","verdict":"ACCEPT","input_tokens":50,"output_tokens":75,"cache_creation_input_tokens":10,"cache_read_input_tokens":5}
JSONL

# Also place a staging file to verify it is excluded
STAGING="$REPO_DIR/talekeeper-raw-cccc-3333.jsonl"
cat >"$STAGING" <<'JSONL'
{"session_id":"cccc-3333","agent_id":"agent-003","timestamp":"2026-04-01T12:00:00Z","agent_type":"pathfinder","event_type":"SubagentStop","verdict":"","input_tokens":999,"output_tokens":999,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}
JSONL

# ---------------------------------------------------------------------------
# Test 1: two distinct session_ids are indexed correctly
# ---------------------------------------------------------------------------
TALEKEEPER_DB="$DB" TALEKEEPER_LOGS_ROOT="$LOGS_DIR" bash "$INDEXER" --quiet

distinct_sessions="$(sqlite3 "$DB" "SELECT COUNT(DISTINCT session_id) FROM token_events;")"
assert_eq "distinct session_id count == 2" "2" "$distinct_sessions"

total_rows="$(sqlite3 "$DB" "SELECT COUNT(*) FROM token_events;")"
assert_eq "total row count == 2" "2" "$total_rows"

# ---------------------------------------------------------------------------
# Test 2: idempotency — running again does not change the row count
# ---------------------------------------------------------------------------
TALEKEEPER_DB="$DB" TALEKEEPER_LOGS_ROOT="$LOGS_DIR" bash "$INDEXER" --quiet

total_rows_after="$(sqlite3 "$DB" "SELECT COUNT(*) FROM token_events;")"
assert_eq "row count unchanged after second run (idempotency)" "2" "$total_rows_after"

# ---------------------------------------------------------------------------
# Test 3: staging files (talekeeper-raw-*.jsonl) are NOT indexed
# The fixture placed cccc-3333 only in a staging file; it must not appear.
# ---------------------------------------------------------------------------
staging_session="$(sqlite3 "$DB" "SELECT COUNT(*) FROM token_events WHERE session_id = 'cccc-3333';")"
assert_eq "staging file session not indexed" "0" "$staging_session"

# ---------------------------------------------------------------------------
# Test 4: indexer exits 0 silently when sqlite3 is absent
# Construct a restricted PATH that excludes sqlite3.
# ---------------------------------------------------------------------------

# Build a PATH that keeps bash, find, jq, date but removes sqlite3.
# We do this by making a tempdir with symlinks for everything we need
# except sqlite3.
RESTRICTED_PATH_DIR="$TMPDIR_ROOT/restricted-bin"
mkdir -p "$RESTRICTED_PATH_DIR"

for cmd in bash find jq date wc tr mkdir printf cat rm; do
  cmd_path="$(command -v "$cmd" 2>/dev/null || true)"
  if [[ -n "$cmd_path" ]]; then
    ln -sf "$cmd_path" "$RESTRICTED_PATH_DIR/$cmd"
  fi
done
# Intentionally do NOT symlink sqlite3.

exit_code=0
PATH="$RESTRICTED_PATH_DIR" bash "$INDEXER" --quiet 2>/dev/null || exit_code=$?
assert_eq "exits 0 silently when sqlite3 is absent" "0" "$exit_code"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
printf '\n--- Results: %d passed, %d failed ---\n' "$PASS" "$FAIL"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
