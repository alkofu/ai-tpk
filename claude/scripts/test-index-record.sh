#!/bin/bash
# test-index-record.sh — Shell test harness for index-record.sh
# Exercises create/update modes against a scratch HOME so the real
# ~/.ai-tpk/index/records directory is never touched.
# Usage: bash claude/scripts/test-index-record.sh  (from repo root)
#        bash test-index-record.sh                 (from scripts directory)
# Exits 1 if any test fails.

SCRIPT="$(dirname "$0")/index-record.sh"

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

# Each test gets a fresh scratch HOME so records never collide across tests.
new_scratch_home() {
  mktemp -d "${TMPDIR:-/tmp}/index-record-test.XXXXXX"
}

RECORDS_DIR_FOR() {
  printf '%s/.ai-tpk/index/records' "$1"
}

printf '%s\n\n' '=== index-record.sh test harness ==='

# --- TC-01: valid create writes stage/created_ts/updated_ts ---
HOME_1=$(new_scratch_home)
KEY_1=$(HOME="$HOME_1" bash "$SCRIPT" --mode create --key "widget-alpha" --type idea --repo-slug "ai-tpk" --summary "First widget" 2>/tmp/tc01.err)
FILE_1="$(RECORDS_DIR_FOR "$HOME_1")/widget-alpha.json"
if [ "$KEY_1" = "widget-alpha" ] && [ -f "$FILE_1" ] \
  && jq -e '.stage == "idea" and (.created_ts | length) > 0 and (.updated_ts | length) > 0' "$FILE_1" >/dev/null 2>&1; then
  pass "TC-01: valid create writes stage/created_ts/updated_ts"
else
  fail "TC-01: valid create writes stage/created_ts/updated_ts" "key=$KEY_1 file=$FILE_1 $(cat /tmp/tc01.err 2>/dev/null)"
fi

# --- TC-02: --type session --status active round-trips ---
HOME_2=$(new_scratch_home)
HOME="$HOME_2" bash "$SCRIPT" --mode create --key "worktree-beta" --type session --status active --repo-slug "ai-tpk" >/tmp/tc02.out 2>/tmp/tc02.err
FILE_2="$(RECORDS_DIR_FOR "$HOME_2")/worktree-beta.json"
if jq -e '.stage == "session" and .status == "active"' "$FILE_2" >/dev/null 2>&1; then
  pass "TC-02: --type session --status active round-trips correctly"
else
  fail "TC-02: --type session --status active round-trips correctly" "$(cat "$FILE_2" 2>/dev/null) $(cat /tmp/tc02.err 2>/dev/null)"
fi

# --- TC-03: issue/pr serialize as JSON integers not strings ---
HOME_3=$(new_scratch_home)
HOME="$HOME_3" bash "$SCRIPT" --mode create --key "widget-gamma" --type issue --repo-slug "ai-tpk" --issue 42 --pr 7 >/tmp/tc03.out 2>/tmp/tc03.err
FILE_3="$(RECORDS_DIR_FOR "$HOME_3")/widget-gamma.json"
if jq -e '.issue == 42 and .pr == 7 and (.issue | type) == "number" and (.pr | type) == "number"' "$FILE_3" >/dev/null 2>&1; then
  pass "TC-03: issue/pr serialize as JSON integers not strings"
else
  fail "TC-03: issue/pr serialize as JSON integers not strings" "$(cat "$FILE_3" 2>/dev/null) $(cat /tmp/tc03.err 2>/dev/null)"
fi

# --- TC-04: colliding key produces {key}-2.json, original untouched, -2 printed ---
HOME_4=$(new_scratch_home)
HOME="$HOME_4" bash "$SCRIPT" --mode create --key "dup-key" --type idea --repo-slug "ai-tpk" --summary "original" >/tmp/tc04a.out 2>/tmp/tc04a.err
KEY_4B=$(HOME="$HOME_4" bash "$SCRIPT" --mode create --key "dup-key" --type idea --repo-slug "ai-tpk" --summary "second" 2>/tmp/tc04b.err)
FILE_4A="$(RECORDS_DIR_FOR "$HOME_4")/dup-key.json"
FILE_4B="$(RECORDS_DIR_FOR "$HOME_4")/dup-key-2.json"
if [ "$KEY_4B" = "dup-key-2" ] && [ -f "$FILE_4B" ] \
  && jq -e '.summary == "original"' "$FILE_4A" >/dev/null 2>&1 \
  && jq -e '.summary == "second"' "$FILE_4B" >/dev/null 2>&1; then
  pass "TC-04: colliding key produces {key}-2.json (original untouched, -2 printed)"
else
  fail "TC-04: colliding key produces {key}-2.json (original untouched, -2 printed)" "printed=$KEY_4B $(cat /tmp/tc04b.err 2>/dev/null)"
fi

# --- TC-05: update merges into existing file, preserves earlier fields + created_ts, bumps updated_ts ---
HOME_5=$(new_scratch_home)
HOME="$HOME_5" bash "$SCRIPT" --mode create --key "update-target" --type idea --repo-slug "ai-tpk" --summary "keep me" >/tmp/tc05a.out 2>/tmp/tc05a.err
FILE_5="$(RECORDS_DIR_FOR "$HOME_5")/update-target.json"
CREATED_TS_5=$(jq -r '.created_ts' "$FILE_5")
sleep 1
HOME="$HOME_5" bash "$SCRIPT" --mode update --key "update-target" --type issue --issue 99 >/tmp/tc05b.out 2>/tmp/tc05b.err
if jq -e --arg cts "$CREATED_TS_5" \
  '.stage == "issue" and .issue == 99 and .summary == "keep me" and .created_ts == $cts and (.updated_ts != $cts)' \
  "$FILE_5" >/dev/null 2>&1; then
  pass "TC-05: update merges preserving earlier fields + created_ts, bumps updated_ts"
else
  fail "TC-05: update merges preserving earlier fields + created_ts, bumps updated_ts" "$(cat "$FILE_5" 2>/dev/null) $(cat /tmp/tc05b.err 2>/dev/null)"
fi

# --- TC-06: update against missing file exits non-zero ---
HOME_6=$(new_scratch_home)
if HOME="$HOME_6" bash "$SCRIPT" --mode update --key "does-not-exist" --status active >/tmp/tc06.out 2>/tmp/tc06.err; then
  fail "TC-06: update against missing file exits non-zero" "expected non-zero exit, got 0"
else
  pass "TC-06: update against missing file exits non-zero"
fi

# --- TC-07: invalid --type exits non-zero ---
HOME_7=$(new_scratch_home)
if HOME="$HOME_7" bash "$SCRIPT" --mode create --key "bad-type" --type bogus --repo-slug "ai-tpk" >/tmp/tc07.out 2>/tmp/tc07.err; then
  fail "TC-07: invalid --type exits non-zero" "expected non-zero exit, got 0"
else
  pass "TC-07: invalid --type exits non-zero"
fi

# --- Cleanup ---
rm -rf "$HOME_1" "$HOME_2" "$HOME_3" "$HOME_4" "$HOME_5" "$HOME_6" "$HOME_7"
rm -f /tmp/tc0[0-9]*.out /tmp/tc0[0-9]*.err

printf '\n=== Results: %d passed, %d failed ===\n' "$PASS" "$FAIL"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
