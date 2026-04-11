#!/usr/bin/env bash
# lib-tab-rename.sh -- Shared functions for terminal tab rename hooks.
# Sourced by session-start.sh and tab-rename-stop.sh.
# Installed to: ~/.claude/hooks/lib-tab-rename.sh
# This file is NOT executable — it is sourced, not run directly.

# _tab_rename_check_name_override
# Returns 0 (true) if --name was detected in process ancestry, 1 (false) otherwise.
# Callers: if _tab_rename_check_name_override; then <handle --name case>; fi
_tab_rename_check_name_override() {
  local _pid="$PPID"
  local _level _next_ppid _args
  for _level in 1 2 3; do
    _args=$(ps -o args= -p "$_pid" 2>/dev/null)
    # Only check --name (long form). The -n short flag is intentionally omitted:
    # it collides with unrelated processes (e.g. "bash -n", "screen -n") anywhere
    # in the ancestry walk, causing false-positive exits.
    if printf '%s' "$_args" | grep -qE '(^| )--name( |$)'; then
      return 0
    fi
    _next_ppid=$(ps -o ppid= -p "$_pid" 2>/dev/null | tr -d ' ')
    [ -z "$_next_ppid" ] && break
    [ "$_next_ppid" -le 1 ] && break
    _pid="$_next_ppid"
  done
  return 1
}

# _tab_rename_detect_terminal
# Sets the TERMINAL variable to one of: tmux, cmux, iterm2, or "" (unsupported).
# Detection priority: tmux is checked first because when running inside tmux,
# the tmux window name is the visible label regardless of the host terminal
# emulator (e.g., iTerm2 with tmux integration).
_tab_rename_detect_terminal() {
  TERMINAL=""
  if [ -n "${TMUX:-}" ]; then
    TERMINAL="tmux"
  elif [ -n "${CMUX_WORKSPACE_ID:-}" ]; then
    TERMINAL="cmux"
  elif [ "${TERM_PROGRAM:-}" = "iTerm.app" ]; then
    TERMINAL="iterm2"
  elif [ "${TERM_PROGRAM:-}" = "ghostty" ]; then
    TERMINAL="cmux"
  fi
}

# _tab_rename_set_title TITLE
# Applies TITLE to the current terminal tab using the mechanism for $TERMINAL.
# Call _tab_rename_detect_terminal first to set $TERMINAL.
_tab_rename_set_title() {
  local TITLE="$1"
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
}
