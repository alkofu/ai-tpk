#!/usr/bin/env bash
set -euo pipefail
# batch-open-issues.sh
# Spawns one new terminal tab/window per GitHub issue, each running myclaude --skip '/feature-issue <n>'
#
# Usage: batch-open-issues.sh <issue> [<issue> ...]
#
# Supported argument forms:
#   - Bare integer:    42
#   - Full GitHub URL: https://github.com/owner/repo/issues/42
#                      (optional trailing /, #anchor, or ?query accepted)
#
# Exit codes:
#   0 — success (all tabs spawned)
#   2 — missing/invalid args, or required lib not found
#   3 — unsupported terminal (standalone Ghostty, or no recognized terminal)
#   4 — one or more tabs failed to spawn (partial success)
#
# Supported terminals:
#   tmux   — new window via `tmux new-window -c "$PWD"`
#   iTerm2 — new tab via AppleScript (CWD set explicitly via prepended cd; see workaround note below)
#   cmux   — new workspace via `cmux new-workspace --cwd "$PWD" --name "issue-<n>" --command "<cmd>"`
#            cmux binary is located via $PATH first, falling back to
#            /Applications/cmux.app/Contents/Resources/bin/cmux
#
# Dependencies:
#   ~/.claude/hooks/lib-tab-rename.sh — sources _tab_rename_detect_terminal to
#   populate $TERMINAL. Any change to that function's detection contract (the
#   mapping of environment variables to TERMINAL values) requires
#   updating this script in lockstep.
#
# myclaude contract dependency (documented, NOT probed at runtime):
#   This script depends on the post-merge myclaude from the
#   feat/forward-initial-command-to-claude-from-myclaude-cli PR, which extends
#   myclaude to accept an initial-message positional argument alongside --skip.
#   Runtime probing (e.g. myclaude --help) was deliberately removed: the
#   post-merge myclaude has no --help handler — parseArgs rejects unknown flags
#   by exiting non-zero — so any probe pipeline would always fail under
#   set -euo pipefail, breaking the script on every invocation including
#   correctly-installed environments. If running against a stale myclaude (one
#   that predates the merged PR), the user will see N broken Claude sessions
#   rather than one fail-fast error. Fix: re-run install.sh with an updated
#   ai-tpk checkout.
#
# Spawn-vs-success caveat:
#   Successful tab spawn does NOT guarantee myclaude started successfully inside
#   the tab — verify tabs visually.
#
# iTerm2 workaround:
#   iTerm2 new tabs created with 'create tab with default profile' inherit the
#   working directory from the Default profile's setting, not from $PWD of the
#   calling shell. This script works around that limitation by explicitly
#   prepending `cd '$PWD' &&` to the command passed to write text.

if [[ $# -eq 0 ]]; then
  printf 'Usage: batch-open-issues.sh <issue> [<issue> ...]\n' >&2
  exit 2
fi

parse_issue_number() {
  local arg="$1"
  if [[ "$arg" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "$arg"
    return 0
  fi
  if [[ "$arg" =~ ^https?://github\.com/[^/]+/[^/]+/issues/([0-9]+)([/#?].*)?$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi
  printf "batch-open-issues: cannot parse issue identifier '%s'\n" "$arg" >&2
  return 2
}

ISSUE_NUMBERS=()
for arg in "$@"; do
  n=$(parse_issue_number "$arg") || exit 2
  ISSUE_NUMBERS+=("$n")
done

LIB="${HOME}/.claude/hooks/lib-tab-rename.sh"
if [[ ! -f "$LIB" ]]; then
  printf 'batch-open-issues: required library not found at ~/.claude/hooks/lib-tab-rename.sh — re-run install.sh\n' >&2
  exit 2
fi
# shellcheck source=/dev/null
source "$LIB"

_tab_rename_detect_terminal
# $TERMINAL is now set to: tmux, cmux, iterm2, or ""

# open_tab_for_issue <issue-number>
# Dispatches a single tab/window spawn for the given issue number.
# Handles ONLY the supported terminals (tmux, iterm2, cmux). The unsupported-terminal
# cases (standalone Ghostty, empty $TERMINAL) are handled by the pre-loop
# check in the main loop and must never be reached here.
# This function NEVER calls `exit` — it only `return`s. Returns 0 on successful
# spawn, non-zero on spawn failure (or on the defensive default-branch case
# below). The caller (the main loop) decides whether a single failure aborts
# the run or accumulates into a partial-success summary. This separation is
# required because `set -euo pipefail` would otherwise abort the loop on the
# first failed spawn.
open_tab_for_issue() {
  local n="$1"
  case "$TERMINAL" in
    tmux)
      tmux new-window -c "$PWD" "myclaude --skip '/feature-issue ${n}'"
      return $?
      ;;
    iterm2)
      osascript -e "tell application \"iTerm\"
  tell current window to create tab with default profile
  tell current session of current tab of current window to write text \"cd '$PWD' && myclaude --skip '/feature-issue ${n}'\"
end tell"
      return $?
      ;;
    cmux)
      local cmux_bin=""
      if command -v cmux >/dev/null 2>&1; then
        cmux_bin="$(command -v cmux)"
      elif [[ -x /Applications/cmux.app/Contents/Resources/bin/cmux ]]; then
        cmux_bin="/Applications/cmux.app/Contents/Resources/bin/cmux"
      else
        printf 'batch-open-issues: cmux binary not found in PATH or at /Applications/cmux.app/Contents/Resources/bin/cmux — install cmux or ensure /Applications/cmux.app exists, then retry\n' >&2
        return 1
      fi
      "$cmux_bin" new-workspace --cwd "$PWD" --name "issue-${n}" --command "myclaude --skip '/feature-issue ${n}'"
      return $?
      ;;
    *)
      # Defensive default — should be unreachable because the pre-loop check
      # exits before entering the loop for unsupported terminals.
      printf 'batch-open-issues: internal error — open_tab_for_issue called with unsupported TERMINAL=%s\n' "'${TERMINAL}'" >&2
      return 1
      ;;
  esac
}

# Pre-loop unsupported-terminal check — exits before any tab spawning.
if [[ "$TERMINAL" == "cmux" && -z "${CMUX_WORKSPACE_ID:-}" ]]; then
  # TERMINAL=cmux without CMUX_WORKSPACE_ID means lib-tab-rename detected
  # standalone Ghostty (TERM_PROGRAM=ghostty without cmux running). cmux's
  # new-workspace command requires a cmux instance, so this case is genuinely
  # unsupported.
  printf "batch-open-issues: standalone Ghostty (without cmux running) is not supported — open tabs manually and run \`myclaude --skip '/feature-issue <n>'\` in each\n" >&2
  exit 3
elif [[ -z "$TERMINAL" ]]; then
  printf 'batch-open-issues: no supported terminal detected (TMUX, CMUX_WORKSPACE_ID, and the terminal program env var all unset or unrecognized)\n' >&2
  exit 3
fi

# Fan out: one tab per issue. `if ! ...` defangs set -e so a single spawn
# failure does not abort the loop — we collect all failures and report them.
failures=()
successes=()
for n in "${ISSUE_NUMBERS[@]}"; do
  if ! open_tab_for_issue "$n"; then
    printf 'batch-open-issues: failed to spawn tab for issue %s\n' "$n" >&2
    failures+=("$n")
  else
    successes+=("$n")
  fi
done

# Summary
if [[ ${#successes[@]} -gt 0 ]]; then
  printf 'batch-open-issues: spawned %d tab(s) for issues %s\n' "${#successes[@]}" "${successes[*]}"
  printf 'batch-open-issues: NOTE — spawn success does not guarantee myclaude started successfully inside each tab; verify tabs visually.\n'
fi

if [[ ${#failures[@]} -gt 0 ]]; then
  exit 4
fi
exit 0
