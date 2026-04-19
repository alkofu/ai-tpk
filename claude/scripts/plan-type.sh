#!/usr/bin/env bash
set -euo pipefail

# plan-type.sh — Frontmatter routing helper for the Dungeon Master agent.
#
# Usage: plan-type.sh <plan-file-path>
#
# Prints exactly one of three tokens to stdout:
#   quill    — plan has documentation-primary: true in its first 5 lines
#   bitsmith — plan does not have the tag (standard plan)
#   error    — plan file is missing, unreadable, or has malformed frontmatter
#
# Always exits 0. Callers branch on the stdout token, not the exit code.
# On the error path, a one-line diagnostic is written to stderr.

PLAN_PATH="${1:-}"

if [[ -z "$PLAN_PATH" ]]; then
  printf 'error\n'
  printf 'plan-type.sh: missing plan file path argument\n' >&2
  exit 0
fi

if [[ ! -f "$PLAN_PATH" ]]; then
  printf 'error\n'
  printf 'plan-type.sh: file not found: %s\n' "$PLAN_PATH" >&2
  exit 0
fi

if [[ ! -r "$PLAN_PATH" ]]; then
  printf 'error\n'
  printf 'plan-type.sh: cannot read file: %s\n' "$PLAN_PATH" >&2
  exit 0
fi

MATCH_COUNT=$(head -n 5 "$PLAN_PATH" | grep -c '^documentation-primary: true$' || true)

# Ruinor F-3: coerce empty MATCH_COUNT (e.g., grep read error) to "0" so the
# fallback is bitsmith (the safe default) rather than a misleading stderr message.
if [[ -z "$MATCH_COUNT" ]]; then
  MATCH_COUNT=0
fi

if [[ "$MATCH_COUNT" == "1" ]]; then
  printf 'quill\n'
elif [[ "$MATCH_COUNT" == "0" ]]; then
  printf 'bitsmith\n'
else
  printf 'error\n'
  printf 'plan-type.sh: malformed frontmatter (%s matches found, expected 0 or 1)\n' "$MATCH_COUNT" >&2
fi

exit 0
