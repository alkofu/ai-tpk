#!/usr/bin/env bash
# tab-rename-stop.sh -- Generates a terminal tab title from the first user-Claude exchange.
# Fires after every turn (Stop hook) but only generates a title once per session.
# Installed to: ~/.claude/hooks/tab-rename-stop.sh

# Read payload from stdin (2-second timeout)
read -r -t 2 STDIN_DATA 2>/dev/null || true
[ -z "$STDIN_DATA" ] && STDIN_DATA='{}'

# Require jq
if ! command -v jq &>/dev/null; then
  exit 0
fi

# Parse payload fields
SESSION_ID=$(echo "$STDIN_DATA" | jq -r '.session_id // ""' 2>/dev/null)
if [ -z "$SESSION_ID" ]; then
  exit 0
fi
TRANSCRIPT_PATH=$(echo "$STDIN_DATA" | jq -r '.transcript_path // ""' 2>/dev/null)
CWD=$(echo "$STDIN_DATA" | jq -r '.cwd // ""' 2>/dev/null)
CWD="${CWD:-$PWD}"

# Single-fire guard: if a title file already exists for this session, exit immediately
TITLE_DIR="$HOME/.claude/session-titles"
TITLE_FILE="$TITLE_DIR/$SESSION_ID"
if [ -f "$TITLE_FILE" ]; then
  exit 0
fi

# Validate transcript path
if [ -z "$TRANSCRIPT_PATH" ] || [ "$TRANSCRIPT_PATH" = "null" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  exit 0
fi

# Source shared tab-rename library
# shellcheck source=lib-tab-rename.sh
source "$(dirname "$0")/lib-tab-rename.sh"

# Check for --name override via process ancestry (walk up to 3 levels)
if _tab_rename_check_name_override; then
  # If a session started with --name is later resumed without --name, the empty sentinel
  # ensures session-start.sh also exits silently — the tab title remains whatever the
  # terminal shows. This is intentional: explicit --name sessions are treated as
  # fixed-identity sessions.
  mkdir -p "$TITLE_DIR"
  touch "$TITLE_FILE"
  exit 0
fi

# Detect first exchange: count non-meta user messages in the transcript
# NOTE: transcript uses "type": "user" (not "human")
# NOTE: guard is >= 1 (not == 1) to avoid race condition where a fast second message
#       would permanently skip title generation; the title-file guard above is the
#       single-fire mechanism
USER_MSG_COUNT=$(jq -c 'select(.type == "user") | select((.isMeta // false) == false)' "$TRANSCRIPT_PATH" 2>/dev/null | wc -l | tr -d ' ')
if [ "${USER_MSG_COUNT:-0}" -lt 1 ] 2>/dev/null; then
  exit 0
fi

# Extract first user prompt from transcript
# message.content may be a string or an array of content blocks
FIRST_PROMPT=$(jq -r 'select(.type == "user") | select((.isMeta // false) == false) | .message.content | if type == "array" then map(select(.type == "text") | .text) | join(" ") else . end' "$TRANSCRIPT_PATH" 2>/dev/null | head -1)
if [ -z "$FIRST_PROMPT" ]; then
  exit 0
fi
FIRST_PROMPT="${FIRST_PROMPT:0:500}"

# Extract last assistant message from Stop payload
LAST_RESPONSE=$(echo "$STDIN_DATA" | jq -r '.last_assistant_message // ""' 2>/dev/null)
LAST_RESPONSE="${LAST_RESPONSE:0:500}"

# Gather lightweight project context
# DRY: calls _tab_rename_default_title; behavior unchanged
REPO_NAME=$(_tab_rename_default_title "$CWD")

# Generate AI title via claude -p (pipe mode does not fire session hooks; --bare strips the default system prompt)
TITLE=$(claude -p --bare --model haiku \
  --system-prompt "Respond with ONLY 2-5 words. No punctuation, no quotes, no explanation. Generate a short natural-language title summarizing this coding session based on the user's request and the assistant's work." \
  "Project: ${REPO_NAME}, User asked: ${FIRST_PROMPT}, Assistant did: ${LAST_RESPONSE}" \
  </dev/null 2>/dev/null)
# shellcheck disable=SC2181  # $? intentionally captured after assignment; compound condition requires separate check
if [ $? -ne 0 ] || [ -z "$TITLE" ]; then
  exit 0
fi

# Sanitize: remove newlines, strip whitespace and truncate to 40 characters
TITLE=$(printf '%s' "$TITLE" | tr -d '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
TITLE="${TITLE:0:40}"
if [ -z "$TITLE" ]; then
  exit 0
fi

# Store title (atomic enough for this use case)
mkdir -p "$TITLE_DIR"
printf '%s' "$TITLE" >"$TITLE_FILE"

# Detect terminal and apply title
_tab_rename_detect_terminal
if [ -z "$TERMINAL" ]; then
  exit 0
fi
_tab_rename_set_title "$TITLE"

exit 0
