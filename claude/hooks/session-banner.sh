#!/bin/bash
# session-banner.sh — dim session name reminder at natural pause points

SESSIONS_DIR="$HOME/.claude/sessions"

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

# Look up session name
NAME="unnamed"
if [ -f "$SESSIONS_DIR/$SESSION_ID" ]; then
  NAME=$(cat "$SESSIONS_DIR/$SESSION_ID")
fi

# Print dim banner to terminal
printf '\033[2m── session: %s ──\033[0m\n' "$NAME" >> /dev/tty 2>/dev/null || true

exit 0
