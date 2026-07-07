#!/usr/bin/env bash
set -euo pipefail

# ensure-pushed.sh — Push-state verification helper for the Dungeon Master agent.
#
# Usage: ensure-pushed.sh <worktree-path> <branch-name>
#
# Prints exactly one of three tokens to stdout:
#   pushed      — local HEAD is even with or behind the remote; nothing local is at risk
#   needs-push  — uncommitted changes exist, no upstream configured, or local commits not on remote
#   error       — arguments missing/invalid, not a git directory, branch mismatch, or fetch failure
#
# Always exits 0. Callers branch on the stdout token, not the exit code.
# On error/diagnostic paths, a human-readable message is written to stderr.

WORKTREE="${1:-}"
BRANCH="${2:-}"

# Step 1: Validate positional arguments are non-empty.
if [[ -z "$WORKTREE" || -z "$BRANCH" ]]; then
  printf 'error\n'
  printf 'ensure-pushed.sh: missing required arguments (usage: ensure-pushed.sh <worktree-path> <branch-name>)\n' >&2
  exit 0
fi

# Step 2: Validate $1 exists and is a git directory.
if ! git -C "$WORKTREE" rev-parse --git-dir >/dev/null 2>&1; then
  printf 'error\n'
  printf 'ensure-pushed.sh: not a git directory: %s\n' "$WORKTREE" >&2
  exit 0
fi

# Step 3: Branch consistency — compare current branch to expected.
CURRENT_BRANCH=$(git -C "$WORKTREE" branch --show-current)
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  printf 'error\n'
  printf 'ensure-pushed.sh: branch mismatch — expected "%s", currently on "%s"\n' "$BRANCH" "$CURRENT_BRANCH" >&2
  exit 0
fi

# Step 4: Detect uncommitted changes.
PORCELAIN=$(git -C "$WORKTREE" status --porcelain)
if [[ -n "$PORCELAIN" ]]; then
  printf 'needs-push\n'
  printf 'ensure-pushed.sh: uncommitted changes exist in %s\n' "$WORKTREE" >&2
  exit 0
fi

# Step 5: Verify upstream is configured.
UPSTREAM=$(git -C "$WORKTREE" rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || true)
if [[ -z "$UPSTREAM" ]]; then
  printf 'needs-push\n'
  printf 'ensure-pushed.sh: no upstream tracking branch configured for "%s"\n' "$BRANCH" >&2
  exit 0
fi

# Step 6: Fetch (narrow scope, with retry).
# The shared .git object store means concurrent ai-tpk sessions share fetch lock
# contention on .git/packed-refs.lock. The narrow 'fetch origin <branch>' scope
# (not unscoped 'fetch') is intentional — it minimizes lock-holding time and
# cross-branch side effects. The single retry with backoff absorbs transient contention.
if ! git -C "$WORKTREE" fetch origin "$BRANCH" 2>/dev/null; then
  sleep 1
  if ! git -C "$WORKTREE" fetch origin "$BRANCH" 2>/dev/null; then
    printf 'error\n'
    printf 'ensure-pushed.sh: fetch failed for origin/%s (tried twice)\n' "$BRANCH" >&2
    exit 0
  fi
fi

# Step 7: Count local commits not on remote.
local_count=$(git -C "$WORKTREE" rev-list --count "origin/$BRANCH"..HEAD)

if [[ "$local_count" -gt 0 ]]; then
  remote_count=$(git -C "$WORKTREE" rev-list --count HEAD.."origin/$BRANCH")
  if [[ "$remote_count" -gt 0 ]]; then
    printf 'ensure-pushed.sh: branch is diverged: %s local commits ahead, %s remote commits not in local\n' "$local_count" "$remote_count" >&2
  fi
  printf 'needs-push\n'
  exit 0
fi

# Local is even with or behind remote — nothing local is at risk.
printf 'pushed\n'
exit 0
