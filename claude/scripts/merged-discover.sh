#!/usr/bin/env bash

# This script's internals are exempt from `claude/references/bash-style.md` — that file
# governs agent-level Bash tool calls only. Internal use of `&&`, `;`, `|`, and `$(...)`
# is permitted.

set -euo pipefail

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { printf 'Error: not inside a git repository\n' >&2; exit 1; }

# ---------------------------------------------------------------------------
# git fetch --prune
# Run non-destructively; record success/failure but continue regardless.
# ---------------------------------------------------------------------------
fetch_ok=true
if ! git fetch --prune >/dev/null 2>&1; then
  fetch_ok=false
fi

# ---------------------------------------------------------------------------
# Capture worktree list in porcelain format.
# ---------------------------------------------------------------------------
worktree_output="$(git worktree list --porcelain)"

# ---------------------------------------------------------------------------
# Parse porcelain output block by block.
# Each block is separated by a blank line. Fields of interest:
#   worktree <path>
#   branch refs/heads/<name>   (or absent when detached)
#   detached                   (present instead of branch line when HEAD is detached)
#   prunable                   (present when the worktree is stale/prunable)
# ---------------------------------------------------------------------------
main_path=""
worktrees_json="[]"   # JSON array built incrementally via jq
block_path=""
block_branch=""
block_prunable=false
block_detached=false
first_block=true

flush_block() {
  # Called when a blank line (or EOF) is encountered after a non-empty block.
  [[ -z "$block_path" ]] && return

  if [[ "$block_detached" == "true" ]]; then
    block_branch="(detached HEAD)"
  fi

  if [[ "$first_block" == "true" ]]; then
    main_path="$block_path"
    first_block=false
  else
    # Add to worktrees array only if: not prunable AND path starts with <main_path>/
    if [[ "$block_prunable" == "false" && "$block_path" == "$main_path/"* ]]; then
      worktrees_json="$(printf '%s' "$worktrees_json" | jq \
        --arg p "$block_path" \
        --arg b "$block_branch" \
        '. + [{"path": $p, "branch": $b}]')"
    fi
  fi

  # Reset block state
  block_path=""
  block_branch=""
  block_prunable=false
  block_detached=false
}

while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ -z "$line" ]]; then
    flush_block
  elif [[ "$line" == worktree\ * ]]; then
    block_path="${line#worktree }"
  elif [[ "$line" == branch\ refs/heads/* ]]; then
    block_branch="${line#branch refs/heads/}"
  elif [[ "$line" == "detached" ]]; then
    block_detached=true
  elif [[ "$line" == "prunable"* ]]; then
    block_prunable=true
  fi
done <<< "$worktree_output"

# Flush the last block (no trailing blank line at EOF).
flush_block

# ---------------------------------------------------------------------------
# Detect gone-upstream branches using documented plumbing — NOT `git branch -vv`.
# `git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads/`
# produces `[gone]` in the second column for branches whose upstream is deleted.
# ---------------------------------------------------------------------------
gone_branches_json="[]"

while IFS= read -r ref_line; do
  branch_name="${ref_line%% *}"
  track_info="${ref_line#* }"
  if [[ "$track_info" == "[gone]" ]]; then
    gone_branches_json="$(printf '%s' "$gone_branches_json" | jq --arg b "$branch_name" '. + [$b]')"
  fi
done < <(git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads/)

# ---------------------------------------------------------------------------
# Compute candidates: worktrees whose branch name is in gone_branches,
# excluding detached-HEAD entries.
# ---------------------------------------------------------------------------
candidates_json="$(jq -n \
  --argjson worktrees "$worktrees_json" \
  --argjson gone "$gone_branches_json" \
  '[$worktrees[] | select(.branch != "(detached HEAD)" and (.branch as $b | $gone | index($b) != null)) | .branch]')"

# ---------------------------------------------------------------------------
# Emit final JSON to stdout.
# ---------------------------------------------------------------------------
jq -n \
  --arg main_path "$main_path" \
  --argjson fetch_ok "$fetch_ok" \
  --argjson worktrees "$worktrees_json" \
  --argjson gone_branches "$gone_branches_json" \
  --argjson candidates "$candidates_json" \
  '{
    main_path: $main_path,
    fetch_ok: $fetch_ok,
    worktrees: $worktrees,
    gone_branches: $gone_branches,
    candidates: $candidates
  }'
