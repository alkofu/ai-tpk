#!/bin/bash
# test-index-delete.sh — Shell test harness for index-delete.sh
# Exercises single-file deletion against a scratch HOME so the real
# ~/.ai-tpk/index/records directory is never touched.
# Usage: bash claude/scripts/test-index-delete.sh  (from repo root)
#        bash test-index-delete.sh                 (from scripts directory)
# Exits 1 if any test fails.

SCRIPT="$(dirname "$0")/index-delete.sh"

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
  mktemp -d "${TMPDIR:-/tmp}/index-delete-test.XXXXXX"
}

write_fixture() {
  local home="$1"
  local key="$2"
  local body="$3"
  mkdir -p "${home}/.ai-tpk/index/records"
  printf '%s' "$body" >"${home}/.ai-tpk/index/records/${key}.json"
}

printf '%s\n\n' '=== index-delete.sh test harness ==='

# --- TC-01: deleting an existing key removes exactly that file, siblings untouched ---
HOME_1=$(new_scratch_home)
write_fixture "$HOME_1" "target" '{"stage":"idea"}'
write_fixture "$HOME_1" "sibling" '{"stage":"idea"}'
OUT_1=$(HOME="$HOME_1" bash "$SCRIPT" "target" 2>/tmp/td01.err)
FILE_TARGET="${HOME_1}/.ai-tpk/index/records/target.json"
FILE_SIBLING="${HOME_1}/.ai-tpk/index/records/sibling.json"
if [ ! -f "$FILE_TARGET" ] && [ -f "$FILE_SIBLING" ] && printf '%s' "$OUT_1" | grep -qi 'removed'; then
  pass "TC-01: deleting an existing key removes exactly that file, siblings untouched"
else
  fail "TC-01: deleting an existing key removes exactly that file, siblings untouched" "out=$OUT_1 target_exists=$([ -f "$FILE_TARGET" ] && echo yes || echo no) sibling_exists=$([ -f "$FILE_SIBLING" ] && echo yes || echo no) $(cat /tmp/td01.err 2>/dev/null)"
fi

# --- TC-02: deleting an absent key is a no-op success (exit 0) ---
HOME_2=$(new_scratch_home)
OUT_2=$(HOME="$HOME_2" bash "$SCRIPT" "does-not-exist" 2>/tmp/td02.err)
RC_2=$?
if [ "$RC_2" -eq 0 ] && printf '%s' "$OUT_2" | grep -qi 'no such record'; then
  pass "TC-02: deleting an absent key is a no-op success (exit 0)"
else
  fail "TC-02: deleting an absent key is a no-op success (exit 0)" "rc=$RC_2 out=$OUT_2 $(cat /tmp/td02.err 2>/dev/null)"
fi

# --- TC-03: missing <key> argument exits non-zero ---
HOME_3=$(new_scratch_home)
if HOME="$HOME_3" bash "$SCRIPT" >/tmp/td03.out 2>/tmp/td03.err; then
  fail "TC-03: missing <key> argument exits non-zero" "expected non-zero exit, got 0"
else
  pass "TC-03: missing <key> argument exits non-zero"
fi

# --- Cleanup ---
rm -rf "$HOME_1" "$HOME_2" "$HOME_3"
rm -f /tmp/td0[0-9]*.out /tmp/td0[0-9]*.err

printf '\n=== Results: %d passed, %d failed ===\n' "$PASS" "$FAIL"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
