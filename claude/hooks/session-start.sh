#!/usr/bin/env bash
# session-start.sh — Sets the terminal tab/window title to an AI-generated
# session name when a Claude Code session starts.
# Supports: iTerm2, tmux, cmux
# Installed to: ~/.claude/hooks/session-start.sh

# Read hook payload from stdin
STDIN_DATA=""
read -r -t 2 STDIN_DATA 2>/dev/null || true
[ -z "$STDIN_DATA" ] && STDIN_DATA='{}'

# Parse cwd from JSON payload; fall back to $PWD if jq unavailable or cwd absent
CWD=""
if command -v jq &>/dev/null; then
  CWD=$(echo "$STDIN_DATA" | jq -r '.cwd // ""' 2>/dev/null)
fi
[ -z "$CWD" ] && CWD="$PWD"

# Gather context
DIR_NAME=$(basename "$CWD")
REPO_NAME=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null | xargs -I{} basename {})
BRANCH_NAME=$(git -C "$CWD" rev-parse --abbrev-ref HEAD 2>/dev/null)

# Check for --name override via payload inspection
if command -v jq &>/dev/null; then
  SESSION_NAME=$(echo "$STDIN_DATA" | jq -r '.session_name // .name // ""' 2>/dev/null)
  if [ -n "$SESSION_NAME" ]; then
    exit 0
  fi
fi

# Check for --name override via process ancestry (walk up to 3 levels)
_check_proc_args() {
  local pid="$1"
  local args
  args=$(ps -o args= -p "$pid" 2>/dev/null)
  # Only check --name (long form). The -n short flag is intentionally omitted:
  # it collides with unrelated processes (e.g. "bash -n", "screen -n") anywhere
  # in the ancestry walk, causing false-positive exits.
  if printf '%s' "$args" | grep -qE '(^| )--name( |$)'; then
    echo "found"
  fi
}

_pid="$PPID"
for _level in 1 2 3; do
  if [ -n "$(_check_proc_args "$_pid")" ]; then
    exit 0
  fi
  _next_ppid=$(ps -o ppid= -p "$_pid" 2>/dev/null | tr -d ' ')
  [ -z "$_next_ppid" ] && break
  [ "$_next_ppid" -le 1 ] && break
  _pid="$_next_ppid"
done

# Detect terminal
# Detection priority: tmux is checked first because when running inside tmux,
# the tmux window name is the visible label regardless of the host terminal
# emulator (e.g., iTerm2 with tmux integration).
TERMINAL=""
if [ -n "${TMUX:-}" ]; then
  TERMINAL="tmux"
elif [ -n "${CMUX_WORKSPACE_ID:-}" ]; then
  TERMINAL="cmux"
elif [ "${TERM_PROGRAM:-}" = "iTerm.app" ]; then
  TERMINAL="iterm2"
elif [ "${TERM_PROGRAM:-}" = "ghostty" ]; then
  TERMINAL="cmux"
else
  exit 0
fi

# Generate AI title
# --bare strips the default system prompt, so --system-prompt provides the
# ONLY system prompt (not appended). Do not switch to --append-system-prompt
# as it appends to nothing under --bare.
TITLE=$(claude -p --bare --model haiku \
  --system-prompt "Respond with ONLY 2-5 words. No punctuation, no quotes, no explanation. Generate a short natural-language title for a coding session." \
  "Project: ${REPO_NAME:-$DIR_NAME}, Branch: ${BRANCH_NAME:-main}, Directory: ${DIR_NAME}" \
  </dev/null 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$TITLE" ]; then
  exit 0
fi

# Sanitize: strip leading/trailing whitespace, truncate to 40 chars
TITLE=$(printf '%s' "$TITLE" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
TITLE="${TITLE:0:40}"
if [ -z "$TITLE" ]; then
  exit 0
fi

# Set terminal title based on detected terminal
if [ "$TERMINAL" = "tmux" ]; then
  tmux rename-window "$TITLE" 2>/dev/null
elif [ "$TERMINAL" = "iterm2" ]; then
  printf '\033]0;%s\007' "$TITLE" 2>/dev/null
elif [ "$TERMINAL" = "cmux" ]; then
  if command -v cmux &>/dev/null; then
    cmux rename-tab "$TITLE" 2>/dev/null
  else
    printf '\033]0;%s\007' "$TITLE" 2>/dev/null
  fi
fi

exit 0
