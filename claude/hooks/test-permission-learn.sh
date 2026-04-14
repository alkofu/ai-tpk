#!/bin/bash
# test-permission-learn.sh — Shell test harness for permission-learn.sh
# Feeds JSON payloads to the hook and asserts expected output.
# Usage: bash claude/hooks/test-permission-learn.sh  (from repo root)
#        bash test-permission-learn.sh               (from hooks directory)
# Exits 1 if any test fails.

HOOK="$(dirname "$0")/permission-learn.sh"

if [ ! -f "$HOOK" ]; then
  printf 'ERROR: Hook not found at %s\n' "$HOOK"
  exit 1
fi

PASS=0
FAIL=0

# test_case DESCRIPTION JSON_PAYLOAD EXPECTED
# EXPECTED is one of: allow | deny | fallthrough
test_case() {
  local description="$1"
  local payload="$2"
  local expected="$3"

  local output
  output=$(printf '%s' "$payload" | bash "$HOOK" 2>/dev/null)

  local result
  if printf '%s' "$output" | grep -q '"allow"'; then
    result="allow"
  elif printf '%s' "$output" | grep -q '"deny"'; then
    result="deny"
  else
    result="fallthrough"
  fi

  if [ "$result" = "$expected" ]; then
    printf 'PASS  %s\n' "$description"
    PASS=$((PASS + 1))
  else
    printf 'FAIL  %s\n' "$description"
    printf '      expected=%s  got=%s\n' "$expected" "$result"
    FAIL=$((FAIL + 1))
  fi
}

# Helper: build a JSON payload for a Bash tool call (compact single-line output
# so the hook's "read -r" receives the full JSON in one read).
make_payload() {
  local command="$1"
  jq -cn --arg cmd "$command" '{tool_name:"Bash",tool_input:{command:$cmd},agent_id:"test-agent",agent_type:"subagent"}'
}

printf '%s\n\n' '=== permission-learn.sh test harness ==='

# --- AUTO-APPROVE cases ---
printf '%s\n' '-- AUTO-APPROVE cases --'

test_case \
  "TC-01: git log with HOME variable matches git *" \
  "$(make_payload 'git log $HOME/repo')" \
  "allow"

test_case \
  "TC-02: ls with tilde matches ls *" \
  "$(make_payload 'ls ~/projects')" \
  "allow"

test_case \
  "TC-03: mkdir -p with variable matches mkdir *" \
  "$(make_payload 'mkdir -p $HOME/.config')" \
  "allow"

test_case \
  "TC-04: cp with two variables matches cp *" \
  "$(make_payload 'cp $SRC $DST')" \
  "allow"

test_case \
  "TC-05: mv with two variables matches mv *" \
  "$(make_payload 'mv $OLD $NEW')" \
  "allow"

test_case \
  "TC-06: git push with variable branch matches git *" \
  "$(make_payload 'git push origin $BRANCH')" \
  "allow"

test_case \
  "TC-07: gh pr create with variable title matches gh pr *" \
  "$(make_payload 'gh pr create --title $TITLE')" \
  "allow"

test_case \
  "TC-08: git log with braced expansion matches git *" \
  "$(make_payload 'git diff ${BRANCH}')" \
  "allow"

test_case \
  "TC-08b: python3 script with variable — python3 should be auto-approved (not -c)" \
  "$(make_payload 'python3 script.py $ARGS')" \
  "allow"

# --- FALLTHROUGH cases ---
printf '\n%s\n' '-- FALLTHROUGH cases --'

test_case \
  "TC-09: git log with dollar-paren in double quotes — command substitution" \
  "$(make_payload 'git log --format="$(date)"')" \
  "fallthrough"

test_case \
  "TC-10: git log with backtick in double quotes — backtick substitution" \
  "$(make_payload 'git log --format="`date`"')" \
  "fallthrough"

test_case \
  "TC-11: git -c with space — git config injection" \
  "$(make_payload 'git -c core.sshCommand=curl push $REMOTE')" \
  "fallthrough"

test_case \
  "TC-12: git -c concatenated (no space) — git config injection" \
  "$(make_payload 'git -ccore.pager=malicious log $BRANCH')" \
  "fallthrough"

test_case \
  "TC-13: python -c with double-quoted code — python code exec" \
  "$(make_payload 'python -c "$CODE"')" \
  "fallthrough"

test_case \
  "TC-14: python -c with single-quoted code — python code exec" \
  "$(make_payload "python -c 'import os; os.system(\"rm -rf /\")'") " \
  "fallthrough"

test_case \
  "TC-15: npx arbitrary package — npx guard" \
  "$(make_payload 'npx $PACKAGE')" \
  "fallthrough"

test_case \
  "TC-16: gh extension install — not in allowedTools" \
  "$(make_payload 'gh extension install $EXT')" \
  "fallthrough"

test_case \
  "TC-17: gh api endpoint — not in allowedTools" \
  "$(make_payload 'gh api $ENDPOINT')" \
  "fallthrough"

test_case \
  "TC-18: cat file — cat not in allowedTools" \
  "$(make_payload 'cat $FILE')" \
  "fallthrough"

test_case \
  "TC-19: git log with unquoted command substitution" \
  "$(make_payload 'git log $(date +%Y)')" \
  "fallthrough"

# --- DENY cases ---
printf '\n%s\n' '-- DENY cases --'

test_case \
  "TC-20: git status && git push — compound command" \
  "$(make_payload 'git status && git push')" \
  "deny"

test_case \
  "TC-21: git commit -n — --no-verify shorthand" \
  "$(make_payload 'git commit -n')" \
  "deny"

# --- AUTO-APPROVE: F-4 dangerous keyword false positive verification ---
printf '\n%s\n' '-- F-4 false positive correction (should AUTO-APPROVE) --'

test_case \
  "TC-22: git log --exec-path=/usr/bin BRANCH — exec-path should not trigger keyword guard" \
  "$(make_payload 'git log --exec-path=/usr/bin $BRANCH')" \
  "allow"

test_case \
  "TC-23: git log --source BRANCH — source flag should not trigger keyword guard" \
  "$(make_payload 'git log --source $BRANCH')" \
  "allow"

# --- Summary ---
printf '\n=== Results: %d passed, %d failed ===\n' "$PASS" "$FAIL"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
