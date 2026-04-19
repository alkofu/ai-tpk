#!/usr/bin/env bash
# Dev-only test — not installed by install.sh. Run from repo root.
#
# Tests the sidecar-then-fallback REPO_SLUG resolver in:
#   claude/hooks/talekeeper-capture.sh
#   claude/hooks/talekeeper-enrich.sh
#
# Strategy: extract the REPO_SLUG-resolution block from each hook (all lines
# before LOG_DIR=), source it in a subshell with HOME overridden to a temp
# dir, then verify the resolved REPO_SLUG for four cases:
#   Case 1: sidecar present and well-formed   → use sidecar value
#   Case 2: sidecar absent                    → git-based fallback
#   Case 3: sidecar malformed                 → git-based fallback, no stderr
#   Case 4: sidecar stale (wrong repo_slug)   → cross-check corrects it
#
# Usage: bash tests/hooks/test-talekeeper-sidecar.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CAPTURE_HOOK="$REPO_ROOT/claude/hooks/talekeeper-capture.sh"
ENRICH_HOOK="$REPO_ROOT/claude/hooks/talekeeper-enrich.sh"

PASS=0
FAIL=0

_pass() { printf "  PASS: %s\n" "$1"; PASS=$((PASS + 1)); }
_fail() { printf "  FAIL: %s\n" "$1"; FAIL=$((FAIL + 1)); }

# Extract lines from a hook file up to (not including) the LOG_DIR= line.
# Prints the extracted block to stdout.
_extract_resolver_block() {
  local hook_file="$1"
  awk '/^LOG_DIR=/{exit} {print}' "$hook_file"
}

# Resolve REPO_SLUG from a hook by sourcing only the resolver block.
#
#   $1  — hook file path
#   $2  — sidecar file path (absolute path we control in tests)
#   $3  — "stderr" to capture stderr instead of stdout; omit for stdout
#
# HOME is overridden so that $HOME/.ai-tpk/session-context/current.json
# resolves to the temp-controlled sidecar file.
_resolve_slug() {
  local hook_file="$1"
  local sidecar_file="$2"
  local capture_mode="${3:-stdout}"
  # Derive the fake HOME: two levels up from the sidecar file
  # sidecar_file = $TMPDIR_BASE/.ai-tpk/session-context/current.json
  # fake HOME    = $TMPDIR_BASE
  local fake_home
  fake_home="$(dirname "$(dirname "$(dirname "$sidecar_file")")")"
  local block
  block="$(_extract_resolver_block "$hook_file")"

  if [ "$capture_mode" = "stderr" ]; then
    (
      HOME="$fake_home"
      unset REPO_SLUG 2>/dev/null || true
      eval "$block"
      echo "${REPO_SLUG:-}"
    ) 2>&1 >/dev/null || true
  else
    (
      HOME="$fake_home"
      unset REPO_SLUG 2>/dev/null || true
      eval "$block"
      echo "${REPO_SLUG:-}"
    ) 2>/dev/null || true
  fi
}

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

TMPDIR_BASE="$(mktemp -d)"
SIDECAR_DIR="$TMPDIR_BASE/.ai-tpk/session-context"
SIDECAR_FILE="$SIDECAR_DIR/current.json"
mkdir -p "$SIDECAR_DIR"

# Reference: what git derivation alone would produce.
# Use the same idiom the hooks use (no -C flag) so this matches the subshell context.
GIT_DERIVED_SLUG="$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")"

# ---------------------------------------------------------------------------
# talekeeper-capture.sh
# ---------------------------------------------------------------------------
printf "\n=== talekeeper-capture.sh ===\n"

# Case 1: sidecar present and well-formed → slug matches sidecar value.
# Use GIT_DERIVED_SLUG as the sidecar value: this simulates the real scenario
# where session-start.sh wrote the sidecar for this exact repo. The cross-check
# will see slug == git context and leave it unchanged.
printf '{"repo_slug":"%s"}\n' "$GIT_DERIVED_SLUG" > "$SIDECAR_FILE"
RESULT="$(_resolve_slug "$CAPTURE_HOOK" "$SIDECAR_FILE")"
if [ "$RESULT" = "$GIT_DERIVED_SLUG" ]; then
  _pass "Case 1: sidecar present and well-formed → slug matches sidecar value"
else
  _fail "Case 1: expected '$GIT_DERIVED_SLUG', got '$RESULT'"
fi

# Case 2: sidecar absent → fallback to git derivation
rm -f "$SIDECAR_FILE"
RESULT="$(_resolve_slug "$CAPTURE_HOOK" "$SIDECAR_FILE")"
if [ "$RESULT" = "$GIT_DERIVED_SLUG" ]; then
  _pass "Case 2: sidecar absent → slug matches git-derived value ('$GIT_DERIVED_SLUG')"
else
  _fail "Case 2: expected '$GIT_DERIVED_SLUG', got '$RESULT'"
fi

# Case 3: sidecar present but malformed JSON → fallback, no stderr noise
printf 'not-json\n' > "$SIDECAR_FILE"
RESULT="$(_resolve_slug "$CAPTURE_HOOK" "$SIDECAR_FILE" "stdout")"
STDERR_OUT="$(_resolve_slug "$CAPTURE_HOOK" "$SIDECAR_FILE" "stderr")"
if [ "$RESULT" = "$GIT_DERIVED_SLUG" ]; then
  _pass "Case 3: malformed sidecar → slug falls back to git-derived value"
else
  _fail "Case 3: expected '$GIT_DERIVED_SLUG', got '$RESULT'"
fi
if [ -z "$STDERR_OUT" ]; then
  _pass "Case 3: malformed sidecar → no stderr output"
else
  _fail "Case 3: unexpected stderr: '$STDERR_OUT'"
fi

# Case 4: sidecar present with stale/wrong repo_slug → cross-check corrects it
printf '{"repo_slug":"wrong-other-repo"}\n' > "$SIDECAR_FILE"
RESULT="$(_resolve_slug "$CAPTURE_HOOK" "$SIDECAR_FILE")"
if [ "$RESULT" = "$GIT_DERIVED_SLUG" ]; then
  _pass "Case 4: stale sidecar slug → cross-check corrects to git-derived value"
else
  _fail "Case 4: expected '$GIT_DERIVED_SLUG', got '$RESULT' (cross-check not yet implemented)"
fi

# ---------------------------------------------------------------------------
# talekeeper-enrich.sh
# ---------------------------------------------------------------------------
printf "\n=== talekeeper-enrich.sh ===\n"

# Case 1: sidecar present and well-formed → slug matches sidecar value.
# Use GIT_DERIVED_SLUG as the sidecar value (simulates a freshly-written sidecar).
printf '{"repo_slug":"%s"}\n' "$GIT_DERIVED_SLUG" > "$SIDECAR_FILE"
RESULT="$(_resolve_slug "$ENRICH_HOOK" "$SIDECAR_FILE")"
if [ "$RESULT" = "$GIT_DERIVED_SLUG" ]; then
  _pass "Case 1: sidecar present and well-formed → slug matches sidecar value"
else
  _fail "Case 1: expected '$GIT_DERIVED_SLUG', got '$RESULT'"
fi

# Case 2: sidecar absent → fallback to git derivation
rm -f "$SIDECAR_FILE"
RESULT="$(_resolve_slug "$ENRICH_HOOK" "$SIDECAR_FILE")"
if [ "$RESULT" = "$GIT_DERIVED_SLUG" ]; then
  _pass "Case 2: sidecar absent → slug matches git-derived value ('$GIT_DERIVED_SLUG')"
else
  _fail "Case 2: expected '$GIT_DERIVED_SLUG', got '$RESULT'"
fi

# Case 3: sidecar present but malformed JSON → fallback, no stderr noise
printf 'not-json\n' > "$SIDECAR_FILE"
RESULT="$(_resolve_slug "$ENRICH_HOOK" "$SIDECAR_FILE" "stdout")"
STDERR_OUT="$(_resolve_slug "$ENRICH_HOOK" "$SIDECAR_FILE" "stderr")"
if [ "$RESULT" = "$GIT_DERIVED_SLUG" ]; then
  _pass "Case 3: malformed sidecar → slug falls back to git-derived value"
else
  _fail "Case 3: expected '$GIT_DERIVED_SLUG', got '$RESULT'"
fi
if [ -z "$STDERR_OUT" ]; then
  _pass "Case 3: malformed sidecar → no stderr output"
else
  _fail "Case 3: unexpected stderr: '$STDERR_OUT'"
fi

# Case 4: sidecar present with stale/wrong repo_slug → cross-check corrects it
printf '{"repo_slug":"wrong-other-repo"}\n' > "$SIDECAR_FILE"
RESULT="$(_resolve_slug "$ENRICH_HOOK" "$SIDECAR_FILE")"
if [ "$RESULT" = "$GIT_DERIVED_SLUG" ]; then
  _pass "Case 4: stale sidecar slug → cross-check corrects to git-derived value"
else
  _fail "Case 4: expected '$GIT_DERIVED_SLUG', got '$RESULT' (cross-check not yet implemented)"
fi

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
rm -rf "$TMPDIR_BASE"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
printf "\n--- Results: %d passed, %d failed ---\n" "$PASS" "$FAIL"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
