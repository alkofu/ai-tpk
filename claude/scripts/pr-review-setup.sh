#!/usr/bin/env bash

# This script's internals are exempt from `claude/references/bash-style.md` — that file
# governs agent-level Bash tool calls only. Internal use of `&&`, `;`, `|`, and `$(...)` is
# permitted.

set -euo pipefail

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { printf 'Error: not inside a git repository\n' >&2; exit 1; }

# Arg validation: require a positive integer PR number.
pr_number="${1:-}"
if [[ -z "$pr_number" ]] || ! [[ "$pr_number" =~ ^[1-9][0-9]*$ ]]; then
  printf 'Usage: pr-review-setup.sh <pr-number>\n' >&2
  exit 2
fi
# pr_number is trusted as a numeric identifier below in path components, git refspecs, and gh CLI args.
# Do NOT relax the regex above without reviewing all downstream uses.

repo_root="$(git rev-parse --show-toplevel)"
session_ts="$(date +%Y%m%d-%H%M%S)-$$"

# Note: temp_branch uses '/' separator (git branch convention) while temp_worktree_path uses '-'
# to keep the path segment flat — matches the Worktree Creation Subroutine convention.
temp_branch="review-pr/${pr_number}-${session_ts}"
temp_worktree_path="${repo_root}/.worktrees/review-pr-${pr_number}-${session_ts}"

# Path-prefix safety check fires before any worktree side effects.
if [[ "$temp_worktree_path" != "${repo_root}/.worktrees/review-pr-"* ]]; then
  printf 'Error: derived temp worktree path failed safety check: %s\n' "$temp_worktree_path" >&2
  exit 1
fi

# Self-cleanup trap: if any command below fails, remove the temp worktree and branch
# so no orphan state is left. The command does not need to invoke pr-review-cleanup.sh
# when the setup script exits non-zero.
cleanup_on_error() {
  git -C "${repo_root}" worktree remove --force "${temp_worktree_path}" 2>/dev/null || true
  git -C "${repo_root}" branch -D "${temp_branch}" 2>/dev/null || true
  git -C "${repo_root}" worktree prune 2>/dev/null || true
}
trap cleanup_on_error ERR

mkdir -p "${repo_root}/.worktrees"
git -C "${repo_root}" worktree add --detach "${temp_worktree_path}" HEAD
# Why not 'gh pr checkout': it has no -C/--cwd flag and pollutes the repo's git config with fork
# remotes that persist after cleanup. The explicit fetch+checkout approach avoids both issues.
git -C "${repo_root}" fetch origin "pull/${pr_number}/head:${temp_branch}"
git -C "${temp_worktree_path}" checkout "${temp_branch}"

changed_files_raw="$(gh pr diff "${pr_number}" --name-only)"

# Filter empty strings to guard against trailing newlines from 'gh pr diff --name-only'.
# When changed_files_raw is empty, changed_files_relative is [] (not [""]).
changed_files_relative=$(printf '%s' "$changed_files_raw" | jq -R -s 'split("\n") | map(select(length > 0))')
changed_files_absolute=$(printf '%s' "$changed_files_relative" | jq --arg root "${temp_worktree_path}" 'map($root + "/" + .)')

jq -n \
  --arg session_ts "$session_ts" \
  --arg repo_root "$repo_root" \
  --arg temp_branch "$temp_branch" \
  --arg temp_worktree_path "$temp_worktree_path" \
  --argjson changed_files_relative "$changed_files_relative" \
  --argjson changed_files_absolute "$changed_files_absolute" \
  '{
    session_ts: $session_ts,
    repo_root: $repo_root,
    temp_branch: $temp_branch,
    temp_worktree_path: $temp_worktree_path,
    changed_files_relative: $changed_files_relative,
    changed_files_absolute: $changed_files_absolute
  }'
