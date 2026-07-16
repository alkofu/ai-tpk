#!/bin/bash
# test-index-query.sh — Shell test harness for index-query.sh
# Exercises listing/filtering/key-lookup against a scratch HOME so the real
# ~/.ai-tpk/index/records directory is never touched. Fixture record files
# are written directly (not via index-record.sh) to keep this test
# independent of that script.
# Usage: bash claude/scripts/test-index-query.sh  (from repo root)
#        bash test-index-query.sh                 (from scripts directory)
# Exits 1 if any test fails.

SCRIPT="$(dirname "$0")/index-query.sh"

if [ ! -f "$SCRIPT" ]; then
  printf 'ERROR: Script not found at %s\n' "$SCRIPT"
  exit 1
fi

PASS=0
FAIL=0

pass() {
  printf 'PASS  %s\n' "$1"
  PASS=$((PASS + 1))
}

fail() {
  printf 'FAIL  %s\n' "$1"
  printf '      %s\n' "$2"
  FAIL=$((FAIL + 1))
}

new_scratch_home() {
  mktemp -d "${TMPDIR:-/tmp}/index-query-test.XXXXXX"
}

# Writes a fixture record file at $1/.ai-tpk/index/records/$2.json with body $3.
write_fixture() {
  local home="$1"
  local key="$2"
  local body="$3"
  mkdir -p "${home}/.ai-tpk/index/records"
  printf '%s' "$body" >"${home}/.ai-tpk/index/records/${key}.json"
}

printf '%s\n\n' '=== index-query.sh test harness ==='

# --- Shared fixture set for most tests ---
HOME_A=$(new_scratch_home)
write_fixture "$HOME_A" "idea-one" '{"stage":"idea","repo_slug":"ai-tpk","summary":"a fine idea","created_ts":"2026-01-01T00:00:00Z","updated_ts":"2026-01-01T00:00:00Z"}'
write_fixture "$HOME_A" "issue-two" '{"stage":"issue","repo_slug":"ai-tpk","issue":42,"summary":"filed thing","created_ts":"2026-01-02T00:00:00Z","updated_ts":"2026-01-02T00:00:00Z"}'
write_fixture "$HOME_A" "worktree-three" '{"stage":"session","status":"active","repo_slug":"ai-tpk","worktree_slug":"worktree-three","summary":"active session","created_ts":"2026-01-03T00:00:00Z","updated_ts":"2026-01-03T00:00:00Z"}'

# --- TC-01: default listing returns one line per record file ---
LINES=$(HOME="$HOME_A" bash "$SCRIPT" 2>/tmp/tq01.err | wc -l | tr -d ' ')
if [ "$LINES" = "3" ]; then
  pass "TC-01: default listing returns one line per record file"
else
  fail "TC-01: default listing returns one line per record file" "lines=$LINES $(cat /tmp/tq01.err 2>/dev/null)"
fi

# --- TC-02: --type narrows by stage ---
OUT=$(HOME="$HOME_A" bash "$SCRIPT" --type idea 2>/tmp/tq02.err)
LINES2=$(printf '%s\n' "$OUT" | grep -c 'idea-one')
if [ "$LINES2" = "1" ] && ! printf '%s\n' "$OUT" | grep -q 'issue-two'; then
  pass "TC-02: --type narrows by stage"
else
  fail "TC-02: --type narrows by stage" "out=$OUT $(cat /tmp/tq02.err 2>/dev/null)"
fi

# --- TC-03: --issue N --type issue --format key returns exactly the matching key ---
OUT3=$(HOME="$HOME_A" bash "$SCRIPT" --issue 42 --type issue --format key 2>/tmp/tq03.err)
if [ "$OUT3" = "issue-two" ]; then
  pass "TC-03: --issue N --type issue --format key returns exactly the matching key"
else
  fail "TC-03: --issue N --type issue --format key returns exactly the matching key" "out=$OUT3 $(cat /tmp/tq03.err 2>/dev/null)"
fi

# --- TC-04: --worktree-slug <s> --format key returns the matching session record's key ---
OUT4=$(HOME="$HOME_A" bash "$SCRIPT" --worktree-slug worktree-three --format key 2>/tmp/tq04.err)
if [ "$OUT4" = "worktree-three" ]; then
  pass "TC-04: --worktree-slug <s> --format key returns the matching session record's key"
else
  fail "TC-04: --worktree-slug <s> --format key returns the matching session record's key" "out=$OUT4 $(cat /tmp/tq04.err 2>/dev/null)"
fi

# --- TC-05: --key <slug> resolves by filename ---
OUT5=$(HOME="$HOME_A" bash "$SCRIPT" --key idea-one --format key 2>/tmp/tq05.err)
if [ "$OUT5" = "idea-one" ]; then
  pass "TC-05: --key <slug> resolves by filename"
else
  fail "TC-05: --key <slug> resolves by filename" "out=$OUT5 $(cat /tmp/tq05.err 2>/dev/null)"
fi

# --- TC-06: --search matches fixed string only, not regex ---
HOME_B=$(new_scratch_home)
write_fixture "$HOME_B" "regex-one" '{"stage":"idea","repo_slug":"ai-tpk","summary":"a.b literal dot","created_ts":"2026-01-01T00:00:00Z","updated_ts":"2026-01-01T00:00:00Z"}'
write_fixture "$HOME_B" "regex-two" '{"stage":"idea","repo_slug":"ai-tpk","summary":"axb matches only if search were treated as regex","created_ts":"2026-01-01T00:00:00Z","updated_ts":"2026-01-01T00:00:00Z"}'
OUT6=$(HOME="$HOME_B" bash "$SCRIPT" --search "a.b" --format key 2>/tmp/tq06.err)
if [ "$OUT6" = "regex-one" ]; then
  pass "TC-06: --search matches fixed string only, not regex"
else
  fail "TC-06: --search matches fixed string only, not regex" "out=$OUT6 $(cat /tmp/tq06.err 2>/dev/null)"
fi

# --- TC-07: empty/absent records directory yields friendly message and exit 0 ---
HOME_C=$(new_scratch_home)
OUT7=$(HOME="$HOME_C" bash "$SCRIPT" 2>/tmp/tq07.err)
RC7=$?
if [ "$RC7" -eq 0 ] && printf '%s\n' "$OUT7" | grep -qi 'no matching records'; then
  pass "TC-07: empty/absent records directory yields friendly message and exit 0"
else
  fail "TC-07: empty/absent records directory yields friendly message and exit 0" "rc=$RC7 out=$OUT7 $(cat /tmp/tq07.err 2>/dev/null)"
fi

# --- Cleanup ---
rm -rf "$HOME_A" "$HOME_B" "$HOME_C"
rm -f /tmp/tq0[0-9]*.err

printf '\n=== Results: %d passed, %d failed ===\n' "$PASS" "$FAIL"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
