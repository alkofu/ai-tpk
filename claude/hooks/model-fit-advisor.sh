#!/usr/bin/env bash
# model-fit-advisor.sh -- Classifies the first prompt of a session with Haiku and injects a model-tier
# recommendation into context, so the main model can suggest /model when the session model is a poor fit.
# Fires on: UserPromptSubmit (only acts once per session)
# Installed to: ~/.claude/hooks/model-fit-advisor.sh
#
# Fails open: any missing dependency, error, or unparseable verdict exits 0 with no output.
# Set MODEL_FIT_ADVISOR_DISABLE=1 to turn the hook off without editing settings.

set -Eeuo pipefail

# Recursion guard: the classifier subprocess below must never re-enter this hook
if [[ -n "${MODEL_FIT_ADVISOR_CHILD:-}" || -n "${MODEL_FIT_ADVISOR_DISABLE:-}" ]]; then
  exit 0
fi

if ! command -v jq >/dev/null 2>&1 || ! command -v claude >/dev/null 2>&1; then
  exit 0
fi

STDIN_DATA=$(cat 2>/dev/null || true)
[[ -z "$STDIN_DATA" ]] && exit 0

SESSION_ID=$(printf '%s' "$STDIN_DATA" | jq -r '.session_id // ""' 2>/dev/null || true)
PROMPT=$(printf '%s' "$STDIN_DATA" | jq -r '.prompt // ""' 2>/dev/null || true)
if [[ -z "$SESSION_ID" || -z "$PROMPT" ]]; then
  exit 0
fi

# Single-fire guard: one classification per session, including resumed sessions.
# The marker is written before classifying so a failed or slow call is not retried on every prompt.
MARKER_DIR="$HOME/.claude/model-fit-advised"
MARKER_FILE="$MARKER_DIR/$SESSION_ID"
if [[ -e "$MARKER_FILE" ]]; then
  exit 0
fi
mkdir -p "$MARKER_DIR" 2>/dev/null || exit 0
touch "$MARKER_FILE" 2>/dev/null || exit 0

PROMPT="${PROMPT:0:2000}"

SYSTEM_PROMPT="You route coding-assistant tasks to the cheapest model tier that will do them well. \
Tiers: haiku = trivial, mechanical, or lookup work (rename, typo, run a command, simple question). \
sonnet = typical software work (implement a feature, fix a bug with a known cause, write tests, refactor a module). \
opus = hard work (ambiguous root-cause debugging, architecture or design decisions, security review, large cross-cutting changes, subtle concurrency). \
When unsure between two tiers, pick the higher one. \
Respond with exactly one line: <tier>: <reason in at most 15 words>. No other text."

# --bare is avoided because it skips keychain/OAuth login; hooks, tools and MCP are disabled instead
VERDICT=$(MODEL_FIT_ADVISOR_CHILD=1 claude -p --model haiku \
  --settings '{"disableAllHooks":true}' --strict-mcp-config --tools "" \
  --system-prompt "$SYSTEM_PROMPT" \
  "Task: ${PROMPT}" \
  </dev/null 2>/dev/null || true)

VERDICT=$(printf '%s' "$VERDICT" | tr -d '\r' | head -n 1)
if [[ ! "$VERDICT" =~ ^(haiku|sonnet|opus):[[:space:]]*(.+)$ ]]; then
  exit 0
fi
TIER="${BASH_REMATCH[1]}"
REASON="${BASH_REMATCH[2]:0:200}"

CONTEXT="[model-fit-advisor] A Haiku classifier rated this session's first task as needing the '${TIER}' tier (${REASON}). \
Compare this with the model you are running as. If they differ by a tier or more, open your reply with one short line \
suggesting the user run '/model ${TIER}' (upgrade or downgrade), noting that switching later re-reads the context uncached. \
If they match, say nothing about it. Then handle the task normally; do not wait for the user to switch."

jq -n --arg ctx "$CONTEXT" \
  '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: $ctx}}'

exit 0
