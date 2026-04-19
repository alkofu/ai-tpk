#!/usr/bin/env bash
# token-summary.sh — emit formatted session token totals for a repo
# Usage: token-summary.sh <repo-slug>
# Output: "<N>k in / <N>k out / <N>k cache-write / <N>k cache-read"  or "unavailable"
# Always exits 0.

set -euo pipefail

REPO_SLUG="${1:-}"
if [[ -z "$REPO_SLUG" ]]; then
  printf 'unavailable\n'
  exit 0
fi

LOG_DIR="$HOME/.ai-tpk/logs/$REPO_SLUG"
CACHE_FILE="$LOG_DIR/latest-token-summary.txt"

# Fast path: read pre-computed cache written by talekeeper-enrich.sh Stop hook
if [[ -s "$CACHE_FILE" ]]; then
  RESULT=$(cat "$CACHE_FILE" 2>/dev/null || true)
  if [[ -n "$RESULT" ]]; then
    printf '%s\n' "$RESULT"
    exit 0
  fi
  # Cache read failed or produced empty output — fall through to jq fallback
fi

# Fallback: compute from most-recent chronicle file
if ! command -v jq &>/dev/null; then
  printf 'unavailable\n'
  exit 0
fi

LATEST=$(ls -t "$LOG_DIR"/talekeeper-*.jsonl 2>/dev/null | grep -v '/talekeeper-raw\.jsonl$' | head -n1 || true)
if [[ -z "$LATEST" ]]; then
  printf 'unavailable\n'
  exit 0
fi

RESULT=$(jq -rs '[.[] | select(has("input_tokens"))] | reduce .[] as $r ({input:0,output:0,cw:0,cr:0}; .input += ($r.input_tokens // 0) | .output += ($r.output_tokens // 0) | .cw += ($r.cache_creation_input_tokens // 0) | .cr += ($r.cache_read_input_tokens // 0)) | "\(.input/1000 | floor)k in / \(.output/1000 | floor)k out / \(.cw/1000 | floor)k cache-write / \(.cr/1000 | floor)k cache-read"' "$LATEST" 2>/dev/null || true)

if [[ -z "$RESULT" ]]; then
  printf 'unavailable\n'
  exit 0
fi

printf '%s\n' "$RESULT"
exit 0
