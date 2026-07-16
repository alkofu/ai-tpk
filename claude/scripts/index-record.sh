#!/usr/bin/env bash

set -euo pipefail

# Create or update a single-file record in the cross-session task/session
# index. See claude/references/session-task-index.md for the full schema,
# lifecycle, and idiom this script implements.
#
# Usage:
#   index-record.sh --mode create --key <slug> --type idea|issue|session --repo-slug <slug> [flags...]
#   index-record.sh --mode update --key <slug> [flags...]
#
# Shared flags: --key --type --status --repo-slug --branch --worktree
#               --worktree-slug --session-ts --issue --pr --summary
#               --tag (repeatable)
#
# Exits:
#   0 — success; the final key used is printed (bare, no .json) as the
#       LAST LINE of stdout in create mode.
#   1 — bad usage, invalid --type, missing jq, update target absent, or
#       collision retries exhausted.

RECORDS_DIR="${HOME}/.ai-tpk/index/records"

MODE=""
KEY=""
TYPE=""
STATUS=""
REPO_SLUG=""
BRANCH=""
WORKTREE=""
WORKTREE_SLUG=""
SESSION_TS=""
ISSUE=""
PR=""
SUMMARY=""
TAGS=()

fail() {
  printf 'index-record.sh: %s\n' "$1" >&2
  exit 1
}

command -v jq >/dev/null 2>&1 || fail "jq is required but not found on PATH"

while [ $# -gt 0 ]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --key)
      KEY="${2:-}"
      shift 2
      ;;
    --type)
      TYPE="${2:-}"
      shift 2
      ;;
    --status)
      STATUS="${2:-}"
      shift 2
      ;;
    --repo-slug)
      REPO_SLUG="${2:-}"
      shift 2
      ;;
    --branch)
      BRANCH="${2:-}"
      shift 2
      ;;
    --worktree)
      WORKTREE="${2:-}"
      shift 2
      ;;
    --worktree-slug)
      WORKTREE_SLUG="${2:-}"
      shift 2
      ;;
    --session-ts)
      SESSION_TS="${2:-}"
      shift 2
      ;;
    --issue)
      ISSUE="${2:-}"
      shift 2
      ;;
    --pr)
      PR="${2:-}"
      shift 2
      ;;
    --summary)
      SUMMARY="${2:-}"
      shift 2
      ;;
    --tag)
      TAGS+=("${2:-}")
      shift 2
      ;;
    *)
      fail "unrecognized argument: $1"
      ;;
  esac
done

[ -n "$MODE" ] || fail "--mode is required (create|update)"
[ "$MODE" = "create" ] || [ "$MODE" = "update" ] || fail "--mode must be create or update (got: $MODE)"
[ -n "$KEY" ] || fail "--key is required"

if [ -n "$TYPE" ]; then
  case "$TYPE" in
    idea | issue | session) ;;
    *) fail "--type must be one of idea|issue|session (got: $TYPE)" ;;
  esac
fi

if [ "$MODE" = "create" ]; then
  [ -n "$TYPE" ] || fail "--type is required in create mode"
  [ -n "$REPO_SLUG" ] || fail "--repo-slug is required in create mode"
fi

# Build the jq --arg/--argjson pipeline shared by both modes. Each optional
# field is only merged in when the corresponding flag was supplied, so
# update mode never clobbers an unspecified field with an empty string.
build_jq_args() {
  JQ_ARGS=()
  JQ_FILTER_PARTS=()

  if [ -n "$TYPE" ]; then
    JQ_ARGS+=(--arg stage "$TYPE")
    JQ_FILTER_PARTS+=("stage: \$stage")
  fi
  if [ -n "$STATUS" ]; then
    JQ_ARGS+=(--arg status "$STATUS")
    JQ_FILTER_PARTS+=("status: \$status")
  fi
  if [ -n "$REPO_SLUG" ]; then
    JQ_ARGS+=(--arg repo_slug "$REPO_SLUG")
    JQ_FILTER_PARTS+=("repo_slug: \$repo_slug")
  fi
  if [ -n "$BRANCH" ]; then
    JQ_ARGS+=(--arg branch "$BRANCH")
    JQ_FILTER_PARTS+=("branch: \$branch")
  fi
  if [ -n "$WORKTREE" ]; then
    JQ_ARGS+=(--arg worktree "$WORKTREE")
    JQ_FILTER_PARTS+=("worktree: \$worktree")
  fi
  if [ -n "$WORKTREE_SLUG" ]; then
    JQ_ARGS+=(--arg worktree_slug "$WORKTREE_SLUG")
    JQ_FILTER_PARTS+=("worktree_slug: \$worktree_slug")
  fi
  if [ -n "$SESSION_TS" ]; then
    JQ_ARGS+=(--arg session_ts "$SESSION_TS")
    JQ_FILTER_PARTS+=("session_ts: \$session_ts")
  fi
  if [ -n "$ISSUE" ]; then
    JQ_ARGS+=(--argjson issue "$ISSUE")
    JQ_FILTER_PARTS+=("issue: \$issue")
  fi
  if [ -n "$PR" ]; then
    JQ_ARGS+=(--argjson pr "$PR")
    JQ_FILTER_PARTS+=("pr: \$pr")
  fi
  if [ -n "$SUMMARY" ]; then
    JQ_ARGS+=(--arg summary "$SUMMARY")
    JQ_FILTER_PARTS+=("summary: \$summary")
  fi
  if [ "${#TAGS[@]}" -gt 0 ]; then
    TAGS_JSON=$(jq -cn --args '$ARGS.positional' "${TAGS[@]}")
    JQ_ARGS+=(--argjson tags "$TAGS_JSON")
    JQ_FILTER_PARTS+=("tags: \$tags")
  fi
}

build_jq_args

JQ_FILTER="{"
FIRST=1
for part in "${JQ_FILTER_PARTS[@]+"${JQ_FILTER_PARTS[@]}"}"; do
  if [ "$FIRST" -eq 1 ]; then
    JQ_FILTER="${JQ_FILTER}${part}"
    FIRST=0
  else
    JQ_FILTER="${JQ_FILTER}, ${part}"
  fi
done
JQ_FILTER="${JQ_FILTER}}"

if [ "$MODE" = "create" ]; then
  mkdir -p "$RECORDS_DIR"

  NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  CANDIDATE_KEY="$KEY"
  ATTEMPT=1
  MAX_ATTEMPTS=10
  while true; do
    TARGET="${RECORDS_DIR}/${CANDIDATE_KEY}.json"

    JQ_ARGS_FULL=("${JQ_ARGS[@]+"${JQ_ARGS[@]}"}" --arg created_ts "$NOW" --arg updated_ts "$NOW")
    FULL_FILTER="${JQ_FILTER} + {created_ts: \$created_ts, updated_ts: \$updated_ts}"

    if (
      set -C
      jq -n "${JQ_ARGS_FULL[@]}" "$FULL_FILTER" >"$TARGET"
    ) 2>/dev/null; then
      printf '%s\n' "$CANDIDATE_KEY"
      exit 0
    fi

    ATTEMPT=$((ATTEMPT + 1))
    if [ "$ATTEMPT" -gt "$MAX_ATTEMPTS" ]; then
      fail "exhausted $MAX_ATTEMPTS collision retries for key: $KEY"
    fi
    CANDIDATE_KEY="${KEY}-${ATTEMPT}"
  done
fi

# --- update mode ---
TARGET="${RECORDS_DIR}/${KEY}.json"
[ -f "$TARGET" ] || fail "update target does not exist: $TARGET"

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
JQ_ARGS_FULL=("${JQ_ARGS[@]+"${JQ_ARGS[@]}"}" --arg updated_ts "$NOW")
FULL_FILTER=". + ${JQ_FILTER} + {updated_ts: \$updated_ts}"

TMP="${TARGET}.tmp.$$"
if jq "${JQ_ARGS_FULL[@]}" "$FULL_FILTER" "$TARGET" >"$TMP"; then
  mv "$TMP" "$TARGET"
else
  rm -f "$TMP"
  fail "update failed for key: $KEY"
fi

printf '%s\n' "$KEY"
