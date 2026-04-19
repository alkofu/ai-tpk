#!/usr/bin/env bash

# This script's internals are exempt from `claude/references/bash-style.md` — that file governs
# agent-level Bash tool calls only. Internal use of `&&`, `;`, `|`, and `$(...)` is permitted.

set -euo pipefail

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { printf 'Error: not inside a git repository\n' >&2; exit 1; }

# Verify GitHub authentication.
if ! gh auth status >/dev/null 2>&1; then
  printf 'GitHub authentication is required. Run `gh auth login` and try again.\n' >&2
  exit 1
fi

# Fetch remote-tracking refs so merged-PR data is current.
git fetch origin

# Collect merged PR branch names (one per line) into an array.
merged_branches=()
while IFS= read -r line; do
  [[ -n "$line" ]] && merged_branches+=("$line")
done < <(gh pr list --state merged --json headRefName --limit 1000 | jq -r '.[].headRefName')

# Collect local branch names into an array.
local_branches=()
while IFS= read -r line; do
  [[ -n "$line" ]] && local_branches+=("$line")
done < <(git branch --format='%(refname:short)')

# Detect current branch (may be empty in detached-HEAD state).
current_branch="$(git branch --show-current)"

# Parse `git worktree list --porcelain` into a path-by-branch lookup map.
# Associative array: worktree_path_for_branch[branch]=path
# Skip prunable entries and the first (main) worktree block.
declare -A worktree_path_for_branch
worktree_raw="$(git worktree list --porcelain)"
wt_path=""
wt_branch=""
wt_prunable=false
block_count=0

while IFS= read -r wt_line; do
  if [[ "$wt_line" == worktree\ * ]]; then
    # Flush the previous block before starting a new one.
    if [[ $block_count -gt 1 && -n "$wt_path" && "$wt_prunable" == false ]]; then
      if [[ -n "$wt_branch" && "$wt_branch" != "(detached HEAD)" ]]; then
        worktree_path_for_branch["$wt_branch"]="$wt_path"
      fi
    fi
    wt_path="${wt_line#worktree }"
    wt_branch=""
    wt_prunable=false
    (( block_count++ )) || true
  elif [[ "$wt_line" == branch\ * ]]; then
    raw_branch="${wt_line#branch }"
    wt_branch="${raw_branch#refs/heads/}"
  elif [[ "$wt_line" == "detached" ]]; then
    wt_branch="(detached HEAD)"
  elif [[ "$wt_line" == "prunable"* ]]; then
    wt_prunable=true
  fi
done <<< "$worktree_raw"

# Flush the final block.
if [[ $block_count -gt 1 && -n "$wt_path" && "$wt_prunable" == false ]]; then
  if [[ -n "$wt_branch" && "$wt_branch" != "(detached HEAD)" ]]; then
    worktree_path_for_branch["$wt_branch"]="$wt_path"
  fi
fi

# Build a set of local branches for O(1) lookup.
declare -A local_branch_set
for b in "${local_branches[@]+"${local_branches[@]}"}"; do
  local_branch_set["$b"]=1
done

# Build a set of protected branches.
declare -A protected_set
protected_set["main"]=1
protected_set["master"]=1
protected_set["HEAD"]=1
[[ -n "$current_branch" ]] && protected_set["$current_branch"]=1

# Compute candidates: in merged_branches AND in local_branches AND NOT protected.
candidates=()
declare -A candidate_set
for mb in "${merged_branches[@]+"${merged_branches[@]}"}"; do
  if [[ -n "${local_branch_set[$mb]+_}" && -z "${protected_set[$mb]+_}" ]]; then
    candidates+=("$mb")
    candidate_set["$mb"]=1
  fi
done

# For each candidate, record it for deletion and check whether a worktree exists.
branches_to_delete=("${candidates[@]+"${candidates[@]}"}")
# worktrees_to_remove stored as parallel arrays for branch and path.
wtr_branches=()
wtr_paths=()
for c in "${candidates[@]+"${candidates[@]}"}"; do
  if [[ -n "${worktree_path_for_branch[$c]+_}" ]]; then
    wtr_branches+=("$c")
    wtr_paths+=("${worktree_path_for_branch[$c]}")
  fi
done

# Build skipped_reasons for merged branches that exist locally but were excluded.
# Priority order: protected → current branch.
declare -A skipped_reasons
for mb in "${merged_branches[@]+"${merged_branches[@]}"}"; do
  # Only surface branches that exist locally.
  [[ -z "${local_branch_set[$mb]+_}" ]] && continue
  # Skip if already a candidate.
  [[ -n "${candidate_set[$mb]+_}" ]] && continue
  # Determine reason.
  if [[ "$mb" == "main" || "$mb" == "master" || "$mb" == "HEAD" ]]; then
    skipped_reasons["$mb"]="protected"
  elif [[ -n "$current_branch" && "$mb" == "$current_branch" ]]; then
    skipped_reasons["$mb"]="current branch"
  fi
done

# Cross-check: surface local branches with [gone] upstream that are NOT already candidates.
# These are branches whose PR was likely closed without merge. Priority: after protected/current.
while IFS= read -r ref_line; do
  ref_branch="${ref_line%% *}"
  ref_track="${ref_line##* }"
  [[ "$ref_track" != "[gone]" ]] && continue
  # Already a candidate — skip.
  [[ -n "${candidate_set[$ref_branch]+_}" ]] && continue
  # Only add if not already recorded with a higher-priority reason.
  if [[ -z "${skipped_reasons[$ref_branch]+_}" ]]; then
    skipped_reasons["$ref_branch"]="upstream gone (PR not in merged-list — possibly closed-without-merge)"
  fi
done < <(git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads/)

# Serialize branches_to_delete as a JSON array.
branches_json="$(
  if [[ ${#branches_to_delete[@]} -eq 0 ]]; then
    printf '[]'
  else
    for b in "${branches_to_delete[@]}"; do
      jq -Rn --arg v "$b" '$v'
    done | jq -s .
  fi
)"

# Serialize worktrees_to_remove as a JSON array of {branch, path} objects.
worktrees_json="$(
  if [[ ${#wtr_branches[@]} -eq 0 ]]; then
    printf '[]'
  else
    for i in "${!wtr_branches[@]}"; do
      jq -n --arg branch "${wtr_branches[$i]}" --arg path "${wtr_paths[$i]}" \
        '{"branch": $branch, "path": $path}'
    done | jq -s .
  fi
)"

# Serialize skipped_reasons as a JSON object.
skipped_json="$(
  if [[ ${#skipped_reasons[@]} -eq 0 ]]; then
    printf '{}'
  else
    for sk_br in "${!skipped_reasons[@]}"; do
      jq -n --arg k "$sk_br" --arg v "${skipped_reasons[$sk_br]}" '{($k): $v}'
    done | jq -s 'add // {}'
  fi
)"

# Emit final JSON to stdout.
jq -n \
  --argjson branches_to_delete "$branches_json" \
  --argjson worktrees_to_remove "$worktrees_json" \
  --argjson skipped_reasons "$skipped_json" \
  '{
    "branches_to_delete": $branches_to_delete,
    "worktrees_to_remove": $worktrees_to_remove,
    "skipped_reasons": $skipped_reasons
  }'
