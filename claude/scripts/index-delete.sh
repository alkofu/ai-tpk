#!/usr/bin/env bash

set -euo pipefail

# Delete a single record from the cross-session task/session index. See
# session-task-index.md for the full schema and delete semantics this
# script implements.
#
# Usage:
#   index-delete.sh <key>
#
# Idempotent — deleting an absent key is a no-op success, not an error.
# No advisory lock, no whole-file rewrite of anything else — this only
# ever touches the single target file.
#
# Exits:
#   0 — success, whether or not a file was actually removed.
#   1 — missing <key> argument.

RECORDS_DIR="${HOME}/.ai-tpk/index/records"

fail() {
  printf 'index-delete.sh: %s\n' "$1" >&2
  exit 1
}

[ $# -ge 1 ] || fail "usage: index-delete.sh <key>"

KEY="$1"
[ -n "$KEY" ] || fail "usage: index-delete.sh <key>"

TARGET="${RECORDS_DIR}/${KEY}.json"

if [ -f "$TARGET" ]; then
  rm -f "$TARGET"
  printf 'removed: %s\n' "$KEY"
else
  printf 'no such record: %s\n' "$KEY"
fi
