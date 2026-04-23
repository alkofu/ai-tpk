#!/usr/bin/env bash
# test-talekeeper-enrich.sh — Test suite for talekeeper-enrich.sh per-session behavior
# Run from the repo root: bash claude/hooks/test-talekeeper-enrich.sh
# Exits 0 on success, non-zero on failure.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENRICH_SCRIPT="$SCRIPT_DIR/talekeeper-enrich.sh"

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

# --- Setup ---
TMPDIR_BASE="$(mktemp -d)"
cleanup() { rm -rf "$TMPDIR_BASE"; }
trap cleanup EXIT

REPO_SLUG="test-repo"

# Build a minimal raw staging entry (valid SubagentStop payload written by capture hook)
make_entry() {
  local session_id="$1"
  local agent_id="$2"
  local agent_type="${3:-bitsmith}"
  local ts
  ts="2026-04-22T00:00:00Z"
  printf '{"session_id":"%s","agent_id":"%s","agent_type":"%s","hook_event_name":"SubagentStop","_captured_at":"%s","last_assistant_message":"done"}\n' \
    "$session_id" "$agent_id" "$agent_type" "$ts"
}

# Run the enrich hook with given stdin, using a custom HOME so log paths are isolated.
# The hook uses git rev-parse for REPO_SLUG, so we must cd into a fake git repo whose
# basename matches REPO_SLUG. Stdin is passed via a temp file to avoid read -r -t 2 timeout issues.
run_enrich() {
  local stdin_data="$1"
  local fake_home="$2"
  local repo_slug="${3:-$REPO_SLUG}"

  # Create a stub git repo whose basename matches repo_slug
  local work_dir="$TMPDIR_BASE/repos/$repo_slug"
  mkdir -p "$work_dir"
  if [ ! -d "$work_dir/.git" ]; then
    git -C "$work_dir" init -q
  fi

  # Write stdin to a temp file
  local stdin_file="$TMPDIR_BASE/stdin-$$.txt"
  printf '%s' "$stdin_data" > "$stdin_file"

  # Run the hook from within the fake git repo
  (cd "$work_dir" && HOME="$fake_home" bash "$ENRICH_SCRIPT" < "$stdin_file") 2>/dev/null || true
  rm -f "$stdin_file"
}

# ---------------------------------------------------------------------------
# Test 1: Missing session_id in stdin → exit 0, no files touched
# ---------------------------------------------------------------------------
T1_HOME="$TMPDIR_BASE/t1"
T1_REPO="$T1_HOME/.ai-tpk/logs/$REPO_SLUG"
mkdir -p "$T1_REPO"
# Place a staging file that should NOT be touched
make_entry "other-session" "other-agent" > "$T1_REPO/talekeeper-raw-other-session.jsonl"
OTHER_MTIME_BEFORE="$(stat -f '%m' "$T1_REPO/talekeeper-raw-other-session.jsonl" 2>/dev/null || stat -c '%Y' "$T1_REPO/talekeeper-raw-other-session.jsonl" 2>/dev/null)"

run_enrich '{}' "$T1_HOME"

OTHER_MTIME_AFTER="$(stat -f '%m' "$T1_REPO/talekeeper-raw-other-session.jsonl" 2>/dev/null || stat -c '%Y' "$T1_REPO/talekeeper-raw-other-session.jsonl" 2>/dev/null)"
if [ "$OTHER_MTIME_BEFORE" = "$OTHER_MTIME_AFTER" ]; then
  pass "Test 1a: Missing session_id does not touch other session staging file"
else
  fail "Test 1a: Missing session_id modified other session staging file"
fi

# No chronicle should be created
if ls "$T1_REPO"/talekeeper-*.jsonl 2>/dev/null | grep -qv 'talekeeper-raw-'; then
  fail "Test 1b: Missing session_id created unexpected chronicle file"
else
  pass "Test 1b: Missing session_id created no chronicle file"
fi

# ---------------------------------------------------------------------------
# Test 2: Valid session_id → reads own staging file, writes chronicle, removes staging file
# ---------------------------------------------------------------------------
T2_HOME="$TMPDIR_BASE/t2"
T2_REPO="$T2_HOME/.ai-tpk/logs/$REPO_SLUG"
mkdir -p "$T2_REPO"
SESSION_A="aaaa-1111"
make_entry "$SESSION_A" "agent-x" > "$T2_REPO/talekeeper-raw-${SESSION_A}.jsonl"

run_enrich "{\"session_id\":\"${SESSION_A}\"}" "$T2_HOME"

CHRONICLE="$T2_REPO/talekeeper-${SESSION_A}.jsonl"
if [ -f "$CHRONICLE" ]; then
  pass "Test 2a: Chronicle file created for session A"
else
  fail "Test 2a: Chronicle file NOT created for session A"
fi

if [ ! -f "$T2_REPO/talekeeper-raw-${SESSION_A}.jsonl" ]; then
  pass "Test 2b: Staging file removed after successful enrich"
else
  fail "Test 2b: Staging file still present after enrich"
fi

# ---------------------------------------------------------------------------
# Test 3: Two concurrent sessions produce isolated chronicles
# ---------------------------------------------------------------------------
T3_HOME="$TMPDIR_BASE/t3"
T3_REPO="$T3_HOME/.ai-tpk/logs/$REPO_SLUG"
mkdir -p "$T3_REPO"
SESSION_B="bbbb-2222"
SESSION_C="cccc-3333"
make_entry "$SESSION_B" "agent-y" > "$T3_REPO/talekeeper-raw-${SESSION_B}.jsonl"
make_entry "$SESSION_C" "agent-z" > "$T3_REPO/talekeeper-raw-${SESSION_C}.jsonl"

run_enrich "{\"session_id\":\"${SESSION_B}\"}" "$T3_HOME"

CHRONICLE_B="$T3_REPO/talekeeper-${SESSION_B}.jsonl"
CHRONICLE_C="$T3_REPO/talekeeper-${SESSION_C}.jsonl"
STAGING_C="$T3_REPO/talekeeper-raw-${SESSION_C}.jsonl"

if [ -f "$CHRONICLE_B" ]; then
  pass "Test 3a: Session B chronicle created"
else
  fail "Test 3a: Session B chronicle NOT created"
fi

if [ ! -f "$CHRONICLE_C" ]; then
  pass "Test 3b: Session C chronicle NOT touched (isolation)"
else
  fail "Test 3b: Session C chronicle was created (isolation violated)"
fi

if [ -f "$STAGING_C" ]; then
  pass "Test 3c: Session C staging file untouched (isolation)"
else
  fail "Test 3c: Session C staging file was removed (isolation violated)"
fi

# Verify session B's chronicle contains only session B rows
if [ -f "$CHRONICLE_B" ]; then
  SESSION_IDS_IN_B=$(jq -r '.session_id' "$CHRONICLE_B" 2>/dev/null | sort -u)
  if [ "$SESSION_IDS_IN_B" = "$SESSION_B" ]; then
    pass "Test 3d: Session B chronicle contains only session B rows"
  else
    fail "Test 3d: Session B chronicle contains unexpected session IDs: $SESSION_IDS_IN_B"
  fi
fi

# ---------------------------------------------------------------------------
# Test 4: Per-session token summary cache written
# ---------------------------------------------------------------------------
T4_HOME="$TMPDIR_BASE/t4"
T4_REPO="$T4_HOME/.ai-tpk/logs/$REPO_SLUG"
mkdir -p "$T4_REPO"
SESSION_D="dddd-4444"
make_entry "$SESSION_D" "agent-w" > "$T4_REPO/talekeeper-raw-${SESSION_D}.jsonl"

run_enrich "{\"session_id\":\"${SESSION_D}\"}" "$T4_HOME"

PER_SESSION_CACHE="$T4_REPO/latest-token-summary-${SESSION_D}.txt"
SHARED_CACHE="$T4_REPO/latest-token-summary.txt"

if [ -f "$PER_SESSION_CACHE" ]; then
  pass "Test 4a: Per-session token summary cache written"
else
  fail "Test 4a: Per-session token summary cache NOT written"
fi

if [ -f "$SHARED_CACHE" ]; then
  pass "Test 4b: Shared token summary cache written (backward compat)"
else
  fail "Test 4b: Shared token summary cache NOT written"
fi

# ---------------------------------------------------------------------------
# Test 5: Staging file missing for this session → exit 0 (no chronicle created)
# ---------------------------------------------------------------------------
T5_HOME="$TMPDIR_BASE/t5"
T5_REPO="$T5_HOME/.ai-tpk/logs/$REPO_SLUG"
mkdir -p "$T5_REPO"
SESSION_E="eeee-5555"
# Do NOT create a staging file for session E

run_enrich "{\"session_id\":\"${SESSION_E}\"}" "$T5_HOME"

if ! ls "$T5_REPO"/talekeeper-*.jsonl 2>/dev/null | grep -qv 'talekeeper-raw-'; then
  pass "Test 5: Missing staging file for session → no chronicle created, exit 0"
else
  fail "Test 5: Missing staging file for session created unexpected chronicle"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
