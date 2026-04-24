#!/usr/bin/env bash

# This script's internals are exempt from `claude/references/bash-style.md` — that file
# governs agent-level Bash tool calls only. Internal use of `&&`, `;`, `|`, and `$(...)` is
# permitted.

set -euo pipefail

# Arg validation: require exactly three positional args.
temp_worktree_path="${1:-}"
repo_root="${2:-}"
temp_branch="${3:-}"
if [[ -z "$temp_worktree_path" ]] || [[ -z "$repo_root" ]] || [[ -z "$temp_branch" ]]; then
  printf 'Usage: pr-review-cleanup.sh <temp-worktree-path> <repo-root> <temp-branch>\n' >&2
  exit 2
fi

# Path-prefix safety check: refuse to act on paths that do not match the expected prefix.
# Exit 0 (not 1) so cleanup never blocks the review summary.
if [[ "$temp_worktree_path" != "${repo_root}/.worktrees/review-pr-"* ]]; then
  printf 'Warning: cleanup refused — path failed safety check: %s\n' "$temp_worktree_path" >&2
  exit 0
fi

# Each cleanup sub-command uses '|| true' rather than 'set +e' so 'set -e'
# still protects the arg validation and path-prefix safety check above.
#
# Ordering: worktree remove must precede branch delete because git refuses to delete a branch
# that is the active checkout of any worktree.
git -C "${repo_root}" worktree remove --force "${temp_worktree_path}" || true
git -C "${repo_root}" branch -D "${temp_branch}" || true
git -C "${repo_root}" worktree prune || true

exit 0
