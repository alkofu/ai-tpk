#!/usr/bin/env bash
# lib-osc-session-metadata.sh -- Shared functions for OSC 6800 session-metadata emission.
# Sourced by session-start.sh and tab-rename-stop.sh.
# Installed to: ~/.claude/hooks/lib-osc-session-metadata.sh
# This file is NOT executable -- it is sourced, not run directly.

_osc_session_metadata_emit() {
  local CWD="${1:-$PWD}"

  # Defensive: jq is re-checked here so lib-osc-session-metadata.sh is usable
  # standalone without session-start.sh / tab-rename-stop.sh as the caller.
  command -v jq >/dev/null 2>&1 || return 0

  local working_directory="$CWD"
  local mode worktree_slug sidecar
  local toplevel
  # Coupling: the */.worktrees/* glob below is coupled to the Worktree Creation
  # Subroutine's ${REPO_ROOT}/.worktrees/ path convention. If that convention
  # changes, update this hook in the same PR.
  # Use git rev-parse --show-toplevel (not basename $CWD) so that subdirectory
  # CDing (e.g. /repo/.worktrees/feat-foo/src) still resolves to the correct slug.
  toplevel=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null)
  case "$toplevel" in
    */.worktrees/*)
      mode="worktree"
      worktree_slug=$(basename "$toplevel")
      sidecar="$HOME/.ai-tpk/session-context/by-worktree/${worktree_slug}.json"
      ;;
    *)
      mode="advisory"
      ;;
  esac

  local session_ts session_slug pr_num issue_num
  if [ "$mode" = "worktree" ]; then
    # Worktree mode: read from sidecar
    [ -f "$sidecar" ] || return 0
    session_ts=$(jq -r '.SESSION_TS // ""' "$sidecar" 2>/dev/null) || {
      printf 'lib-osc-session-metadata: warning: failed to parse %s\n' "$sidecar" >&2
      return 0
    }
    session_slug=$(jq -r '.SESSION_SLUG // ""' "$sidecar" 2>/dev/null)
    # Read integer fields without -r flag to preserve numeric type (returns raw integer or empty)
    pr_num=$(jq '.PR_NUM // empty' "$sidecar" 2>/dev/null)
    issue_num=$(jq '.ISSUE_NUM // empty' "$sidecar" 2>/dev/null)
    if [ -z "$session_ts" ] || [ -z "$session_slug" ]; then
      printf 'lib-osc-session-metadata: warning: sidecar missing required fields (%s)\n' "$sidecar" >&2
      return 0
    fi
  else
    # Advisory mode: compute locally (no sidecar)
    session_ts=$(date +%Y%m%d-%H%M%S)
    session_slug=$(basename "$CWD")
    pr_num=""
    issue_num=""
  fi

  # Resolve BRANCH or WORKTREE (simplified — no awk parsing of git worktree list)
  local branch worktree
  branch=$(git -C "$CWD" rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ "$branch" = "HEAD" ]; then
    # True detached HEAD -- emit WORKTREE (basename of worktree dir) instead of BRANCH
    # "WORKTREE is the basename of the worktree directory, emitted only when HEAD is detached.
    # BRANCH is the checked-out branch name, emitted in all normal cases."
    worktree=$(basename "$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null)")
    branch=""
  fi

  # Resolve REPO (owner/name)
  local repo
  repo=$(cd "$CWD" 2>/dev/null && gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null)
  if [ -z "$repo" ]; then
    local origin_url
    origin_url=$(git -C "$CWD" remote get-url origin 2>/dev/null)
    if [ -n "$origin_url" ]; then
      repo=$(printf '%s' "$origin_url" | sed -E 's#^(https?://[^/]+/|git@[^:]+:)##; s#\.git$##')
    fi
  fi

  # Build JSON payload
  # with_entries(select(.value != null)) drops null fields entirely.
  # String fields are set to null in jq when empty; integer fields use --argjson with "null" literal.
  # Required fields (SESSION_TS, SESSION_SLUG, WORKING_DIRECTORY) are validated non-empty above.
  local payload pr_arg issue_arg
  pr_arg="${pr_num:-null}"
  issue_arg="${issue_num:-null}"
  payload=$(jq -nc \
    --arg ts "$session_ts" \
    --arg slug "$session_slug" \
    --arg wd "$working_directory" \
    --arg branch "$branch" \
    --arg worktree "$worktree" \
    --arg repo "$repo" \
    --argjson pr "$pr_arg" \
    --argjson issue "$issue_arg" \
    '{
      SESSION_TS: $ts,
      SESSION_SLUG: $slug,
      WORKING_DIRECTORY: $wd,
      BRANCH: (if $branch == "" then null else $branch end),
      WORKTREE: (if $worktree == "" then null else $worktree end),
      REPO: (if $repo == "" then null else $repo end),
      PR_NUM: $pr,
      ISSUE_NUM: $issue
    } | with_entries(select(.value != null))' 2>/dev/null)
  [ -z "$payload" ] && return 0

  # Emit OSC 6800 to /dev/tty (mirrors >/dev/tty 2>/dev/null discipline from lib-tab-rename.sh)
  printf '\033]6800;%s\007' "$payload" >/dev/tty 2>/dev/null
  return 0
}
