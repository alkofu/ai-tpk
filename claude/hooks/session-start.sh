#!/bin/bash
# session-start.sh — fired on SessionStart
# Saves session name and prints a dim banner to identify the terminal

SESSIONS_DIR="$HOME/.claude/sessions"
mkdir -p "$SESSIONS_DIR"

# Read hook payload from stdin
STDIN_DATA=""
read -r -t 2 STDIN_DATA 2>/dev/null || true
[ -z "$STDIN_DATA" ] && STDIN_DATA='{}'

# Extract session_id
SESSION_ID=""
if command -v jq &>/dev/null; then
  SESSION_ID=$(echo "$STDIN_DATA" | jq -r '.session_id // ""' 2>/dev/null)
fi
[ -z "$SESSION_ID" ] && SESSION_ID="unknown"
SESSION_ID="${SESSION_ID//[\/.]/_}"

# Persist session name (from env var set at launch: SESSION_NAME=dm-1 claude ...)
NAME="${SESSION_NAME:-unnamed}"
NAME=$(printf '%s' "$NAME" | tr -cd '[:print:]')
echo "$NAME" > "$SESSIONS_DIR/$SESSION_ID"

# Print dim banner to terminal
printf '\033[2m── session: %s ──\033[0m\n' "$NAME" >> /dev/tty 2>/dev/null || true

exit 0
