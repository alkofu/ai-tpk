#!/usr/bin/env bash

set -euo pipefail

# Accept positional args: $1 = invoking command name ('merge-pr' or 'sync-pr'); $2 = optional working directory (defaults to CWD when absent — used to scope git operations to a worktree).
CMD="${1:-}"
if [[ "$CMD" != "merge-pr" && "$CMD" != "sync-pr" ]]; then
  printf '%s\n' "git-preflight.sh: missing or invalid command name argument (expected 'merge-pr' or 'sync-pr')" >&2
  exit 2
fi

DIR="${2:-}"
if [[ -n "$DIR" ]]; then
  if [[ ! -d "$DIR" ]]; then
    printf '%s\n' "git-preflight.sh: working directory '${DIR}' does not exist or is not a directory" >&2
    exit 2
  fi
  if ! git -C "$DIR" rev-parse --git-dir >/dev/null 2>&1; then
    printf '%s\n' "git-preflight.sh: '${DIR}' is not a git working tree" >&2
    exit 2
  fi
fi
GIT=(git)
[[ -n "$DIR" ]] && GIT=(git -C "$DIR")

# Step 1: Verify GitHub authentication.
if ! gh auth status >/dev/null 2>&1; then
  printf '%s\n' "GitHub authentication is required. Run \`gh auth login\` and try again." >&2
  exit 1
fi

# Step 2: Detect current branch.
BRANCH="$("${GIT[@]}" branch --show-current)"

if [[ -z "$BRANCH" ]]; then
  printf '%s\n' "Cannot operate from a detached HEAD. Check out a branch first." >&2
  exit 1
fi

# Step 3: Guard against protected branches.
if [[ "$BRANCH" == "main" || "$BRANCH" == "master" || "$BRANCH" == "develop" ]]; then
  if [[ "$CMD" == "merge-pr" ]]; then
    printf '%s\n' "Cannot merge a protected branch. Check out your PR branch and run \`/merge-pr\` again." >&2
  else
    printf '%s\n' "Cannot sync a protected branch. Check out your PR branch and run \`/sync-pr\` again." >&2
  fi
  exit 1
fi

# On success: print the branch name to stdout for the caller to capture.
printf '%s\n' "$BRANCH"
