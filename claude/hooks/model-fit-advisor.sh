#!/usr/bin/env bash
# model-fit-advisor.sh -- Classifies the first prompt of a session with Haiku and compares the recommended tier
# with the configured model. A mismatch blocks the prompt so the user can run /model and resend; a match passes
# silently. When the configured model is unknown, the recommendation is injected as context instead.
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

# PID of the nearest ancestor process whose command is `claude`, or nothing if none is found within 10 levels
claude_pid() {
  local pid=$PPID depth comm
  for ((depth = 0; depth < 10 && pid > 1; depth++)); do
    comm=$(ps -o comm= -p "$pid" 2>/dev/null || true)
    if [[ "${comm##*/}" == "claude" ]]; then
      printf '%s' "$pid"
      return
    fi
    pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ' || true)
    [[ "$pid" =~ ^[0-9]+$ ]] || return
  done
}

# Value of --model / --model=X in the claude process arguments
launch_model() {
  local args prev="" word
  args=$(ps -o args= -p "$1" 2>/dev/null || true)
  for word in $args; do
    if [[ "$prev" == "--model" ]]; then
      printf '%s' "$word"
      return
    fi
    if [[ "$word" == --model=* ]]; then
      printf '%s' "${word#--model=}"
      return
    fi
    prev="$word"
  done
}

# Epoch seconds when the process started, from ps etime ([[dd-]hh:]mm:ss), which macOS and Linux both support
process_start_epoch() {
  local etime days=0 h=0 m=0 s=0
  local -a parts
  etime=$(ps -o etime= -p "$1" 2>/dev/null | tr -d ' ' || true)
  [[ -n "$etime" ]] || return
  if [[ "$etime" == *-* ]]; then
    days="${etime%%-*}"
    etime="${etime#*-}"
  fi
  IFS=: read -r -a parts <<<"$etime"
  case ${#parts[@]} in
    3) h=${parts[0]} m=${parts[1]} s=${parts[2]} ;;
    2) m=${parts[0]} s=${parts[1]} ;;
    *) return ;;
  esac
  printf '%s' "$(($(date +%s) - ((10#$days * 86400) + (10#$h * 3600) + (10#$m * 60) + 10#$s)))"
}

file_mtime() {
  stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || true
}

# Resolves the model the session is running as. /model saves its choice to settings, so a settings file written
# after claude started wins; otherwise the precedence is the --model launch flag, ANTHROPIC_MODEL, then local,
# project, and user settings.
current_model() {
  local cwd settings_file model pid start_epoch mtime settings_model=""
  cwd=$(printf '%s' "$STDIN_DATA" | jq -r '.cwd // ""' 2>/dev/null || true)
  pid=$(claude_pid)
  start_epoch=""
  [[ -n "$pid" ]] && start_epoch=$(process_start_epoch "$pid")

  for settings_file in "$cwd/.claude/settings.local.json" "$cwd/.claude/settings.json" "$HOME/.claude/settings.json"; do
    [[ -f "$settings_file" ]] || continue
    model=$(jq -r '.model // ""' "$settings_file" 2>/dev/null || true)
    [[ -n "$model" ]] || continue
    mtime=$(file_mtime "$settings_file")
    if [[ -n "$start_epoch" && -n "$mtime" && "$mtime" -gt "$start_epoch" ]]; then
      printf '%s' "$model"
      return
    fi
    [[ -z "$settings_model" ]] && settings_model="$model"
  done

  if [[ -n "$pid" ]]; then
    model=$(launch_model "$pid")
    if [[ -n "$model" ]]; then
      printf '%s' "$model"
      return
    fi
  fi
  if [[ -n "${ANTHROPIC_MODEL:-}" ]]; then
    printf '%s' "$ANTHROPIC_MODEL"
    return
  fi
  printf '%s' "$settings_model"
}

CURRENT_MODEL=$(current_model | tr '[:upper:]' '[:lower:]')
CURRENT_TIER=""
for candidate in haiku sonnet opus; do
  if [[ "$CURRENT_MODEL" == *"$candidate"* ]]; then
    CURRENT_TIER="$candidate"
    break
  fi
done

# Known tier: let a match through silently and block a mismatch so the user can switch before the prompt runs.
# The single-fire marker is already written, so resending the prompt (switched or not) goes through.
if [[ -n "$CURRENT_TIER" ]]; then
  if [[ "$CURRENT_TIER" == "$TIER" ]]; then
    exit 0
  fi
  BLOCK_REASON="[model-fit-advisor] This task was rated '${TIER}' (${REASON}), but the session is on '${CURRENT_TIER}'. \
Run '/model ${TIER}' and resend the prompt, or resend it as-is to keep '${CURRENT_TIER}'."
  jq -n --arg reason "$BLOCK_REASON" '{decision: "block", reason: $reason}'
  exit 0
fi

# Unknown tier (unset, "default", or an unrecognised model): fall back to asking the main model to compare
CONTEXT="[model-fit-advisor] A Haiku classifier rated this session's first task as needing the '${TIER}' tier (${REASON}). \
Compare this with the model you are running as. If they differ by a tier or more, open your reply with one short line \
suggesting the user run '/model ${TIER}' (upgrade or downgrade), noting that switching later re-reads the context uncached. \
If they match, say nothing about it. Then handle the task normally; do not wait for the user to switch."

jq -n --arg ctx "$CONTEXT" \
  '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: $ctx}}'

exit 0
