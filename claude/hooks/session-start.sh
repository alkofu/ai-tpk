#!/usr/bin/env bash
# session-start.sh -- On resume: restores previously stored session title. On fresh start: resets tab to neutral default.
# Fires on: SessionStart (async)
# Installed to: ~/.claude/hooks/session-start.sh

# Read payload from stdin (2-second timeout)
read -r -t 2 STDIN_DATA 2>/dev/null || true
[ -z "$STDIN_DATA" ] && STDIN_DATA='{}'

# Require jq
if ! command -v jq &>/dev/null; then
  exit 0
fi

# Parse session_id and cwd from payload
SESSION_ID=$(echo "$STDIN_DATA" | jq -r '.session_id // ""' 2>/dev/null)
if [ -z "$SESSION_ID" ]; then
  exit 0
fi
CWD=$(echo "$STDIN_DATA" | jq -r '.cwd // ""' 2>/dev/null)
CWD="${CWD:-$PWD}"

# Source shared tab-rename library
# shellcheck source=lib-tab-rename.sh
source "$(dirname "$0")/lib-tab-rename.sh"

# Check for --name override via process ancestry (walk up to 3 levels)
if _tab_rename_check_name_override; then
  exit 0
fi

# Title restore: check if a stored title exists for this session
TITLE_DIR="$HOME/.claude/session-titles"
TITLE_FILE="$TITLE_DIR/$SESSION_ID"

if [ ! -f "$TITLE_FILE" ]; then
  # No stored title for this session (fresh session, e.g. /new).
  # Reset tab to a neutral default so the previous session's title does not persist.
  # Note: consecutive /new invocations each produce a new SESSION_ID with no stored
  # title, so this branch fires correctly for each fresh start in sequence.
  _tab_rename_detect_terminal
  if [ -z "$TERMINAL" ]; then
    exit 0
  fi
  TITLE=$(_tab_rename_default_title "$CWD")
  if [ -n "$TITLE" ]; then
    _tab_rename_set_title "$TITLE"
  fi
  exit 0
fi

TITLE=$(cat "$TITLE_FILE" 2>/dev/null)
if [ -z "$TITLE" ]; then
  exit 0
fi

# Detect terminal and apply title
_tab_rename_detect_terminal
if [ -z "$TERMINAL" ]; then
  exit 0
fi
_tab_rename_set_title "$TITLE"

exit 0
