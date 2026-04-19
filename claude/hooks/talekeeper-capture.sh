#!/bin/bash
# Talekeeper fast-path: capture raw SubagentStop event data
# Invoked as a command hook -- no LLM, millisecond latency
# Reads event JSON from stdin, appends timestamped entry to raw log

# Prefer the session-context sidecar written by session-start.sh; fall back
# to the original git-based derivation when the sidecar is absent or unreadable.
SIDECAR_FILE="$HOME/.ai-tpk/session-context/current.json"
REPO_SLUG=""
if [ -f "$SIDECAR_FILE" ] && command -v jq &>/dev/null; then
  REPO_SLUG=$(jq -r '.repo_slug // ""' "$SIDECAR_FILE" 2>/dev/null)
fi
if [ -z "$REPO_SLUG" ]; then
  REPO_SLUG="$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")"
fi
# Cross-check: verify the sidecar slug matches the current git context.
# If they differ, the sidecar is stale (written by a different-repo session).
_CURRENT_SLUG="$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")"
if [ "$REPO_SLUG" != "$_CURRENT_SLUG" ]; then
  REPO_SLUG="$_CURRENT_SLUG"
fi
unset _CURRENT_SLUG SIDECAR_FILE
LOG_DIR="$HOME/.ai-tpk/logs/$REPO_SLUG"
LOG_FILE="$LOG_DIR/talekeeper-raw.jsonl"

mkdir -p "$LOG_DIR"

# Read stdin (hook event JSON) with a timeout to avoid hanging
# Use bash built-in read with -t for macOS compatibility (not `timeout` command)
STDIN_DATA=""
read -r -t 2 STDIN_DATA 2>/dev/null || true

# If stdin was empty, use empty object
if [ -z "$STDIN_DATA" ]; then
  STDIN_DATA='{}'
fi

# Skip hook-agent self-capture events (Stop hook agents, not real subagents)
if command -v jq &>/dev/null; then
  AGENT_ID=$(echo "$STDIN_DATA" | jq -r '.agent_id // ""' 2>/dev/null)
  if echo "$AGENT_ID" | grep -q '^hook-agent-'; then
    exit 0
  fi
fi

# Construct a JSONL line: wrap stdin data with a capture timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Use jq if available, else fall back to a minimal entry
if command -v jq &>/dev/null; then
  echo "$STDIN_DATA" | jq -c --arg ts "$TIMESTAMP" '. + {"_captured_at": $ts}' >> "$LOG_FILE" 2>/dev/null
else
  # Fallback: write a minimal JSON line with timestamp only
  printf '{"_captured_at":"%s","_raw_unavailable":true}\n' "$TIMESTAMP" >> "$LOG_FILE" 2>/dev/null
fi

# Always exit 0 -- logging must never block the session
exit 0
