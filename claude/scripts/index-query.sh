#!/usr/bin/env bash

set -euo pipefail

# Read-only slurp-and-filter query over the cross-session task/session index.
# See claude/references/session-task-index.md for the full schema and the
# issue-join / worktree_slug lookup idioms this script implements.
#
# Usage:
#   index-query.sh [--type idea|issue|session] [--status <s>] [--repo <slug>]
#                  [--tag <t>] [--since <ts>] [--until <ts>] [--issue <n>]
#                  [--pr <n>] [--worktree-slug <s>] [--search <phrase>]
#                  [--format key] [--key <slug>]
#
# Filters are combinable (AND). Omitting --type returns all stages.
# --format key prints ONLY matching keys (filename basenames), one per line.
# --key <slug> is a direct existence check/read of records/{slug}.json,
# distinct from the --worktree-slug content scan.
#
# Exits:
#   0 — success, including the "no matching records" / empty-directory case.
#   1 — bad usage, invalid --type/--format, or missing jq.

RECORDS_DIR="${HOME}/.ai-tpk/index/records"

TYPE=""
STATUS=""
REPO=""
TAG=""
SINCE=""
UNTIL=""
ISSUE=""
PR=""
WORKTREE_SLUG=""
SEARCH=""
FORMAT=""
KEY=""

fail() {
  printf 'index-query.sh: %s\n' "$1" >&2
  exit 1
}

command -v jq >/dev/null 2>&1 || fail "jq is required but not found on PATH"

while [ $# -gt 0 ]; do
  case "$1" in
    --type)
      TYPE="${2:-}"
      shift 2
      ;;
    --status)
      STATUS="${2:-}"
      shift 2
      ;;
    --repo)
      REPO="${2:-}"
      shift 2
      ;;
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --since)
      SINCE="${2:-}"
      shift 2
      ;;
    --until)
      UNTIL="${2:-}"
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
    --worktree-slug)
      WORKTREE_SLUG="${2:-}"
      shift 2
      ;;
    --search)
      SEARCH="${2:-}"
      shift 2
      ;;
    --format)
      FORMAT="${2:-}"
      shift 2
      ;;
    --key)
      KEY="${2:-}"
      shift 2
      ;;
    *)
      fail "unrecognized argument: $1"
      ;;
  esac
done

if [ -n "$TYPE" ]; then
  case "$TYPE" in
    idea | issue | session) ;;
    *) fail "--type must be one of idea|issue|session (got: $TYPE)" ;;
  esac
fi

if [ -n "$FORMAT" ] && [ "$FORMAT" != "key" ]; then
  fail "--format must be 'key' (got: $FORMAT)"
fi

render_line() {
  # Reads one JSON object (with an injected "key" field) from stdin and
  # prints a compact human-readable line: stage key status repo_slug issue/pr summary
  jq -r '
    [
      .stage,
      .key,
      (.status // "-"),
      (.repo_slug // "-"),
      (if .issue then ("issue#" + (.issue | tostring))
       elif .pr then ("pr#" + (.pr | tostring))
       else "-" end),
      (.summary // "")
    ] | join(" ")
  '
}

# --key direct lookup mode: existence check/read of records/{slug}.json,
# distinct from the --worktree-slug content scan.
if [ -n "$KEY" ]; then
  TARGET="${RECORDS_DIR}/${KEY}.json"
  if [ ! -f "$TARGET" ]; then
    printf 'no matching records\n'
    exit 0
  fi
  if [ "$FORMAT" = "key" ]; then
    printf '%s\n' "$KEY"
    exit 0
  fi
  jq --arg key "$KEY" '. + {key: $key}' "$TARGET" | render_line
  exit 0
fi

# Gather record files, guarding the empty/absent-directory case so an
# unmatched glob is never treated as a literal path.
RECORD_FILES=()
if [ -d "$RECORDS_DIR" ]; then
  for f in "$RECORDS_DIR"/*.json; do
    [ -e "$f" ] || continue
    RECORD_FILES+=("$f")
  done
fi

if [ "${#RECORD_FILES[@]}" -eq 0 ]; then
  printf 'no matching records\n'
  exit 0
fi

# jq -s (slurp) would lose per-file filenames, so build the working set by
# injecting the computed key (derived from the filename basename, never
# persisted on disk) into each record at read time, one file at a time.
WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/index-query.XXXXXX")"
trap 'rm -rf "$WORKDIR"' EXIT

COMBINED="${WORKDIR}/combined.jsonl"
: >"$COMBINED"
for f in "${RECORD_FILES[@]}"; do
  base="$(basename "$f")"
  key="${base%.json}"
  jq -c --arg key "$key" '. + {key: $key}' "$f" >>"$COMBINED"
done

FILTER='true'
JQ_ARGS=()

if [ -n "$TYPE" ]; then
  JQ_ARGS+=(--arg f_type "$TYPE")
  FILTER="${FILTER} and (.stage == \$f_type)"
fi
if [ -n "$STATUS" ]; then
  JQ_ARGS+=(--arg f_status "$STATUS")
  FILTER="${FILTER} and (.status == \$f_status)"
fi
if [ -n "$REPO" ]; then
  JQ_ARGS+=(--arg f_repo "$REPO")
  FILTER="${FILTER} and (.repo_slug == \$f_repo)"
fi
if [ -n "$TAG" ]; then
  JQ_ARGS+=(--arg f_tag "$TAG")
  FILTER="${FILTER} and ((.tags // []) | index(\$f_tag) != null)"
fi
if [ -n "$SINCE" ]; then
  JQ_ARGS+=(--arg f_since "$SINCE")
  FILTER="${FILTER} and ((.updated_ts // \"\") >= \$f_since)"
fi
if [ -n "$UNTIL" ]; then
  JQ_ARGS+=(--arg f_until "$UNTIL")
  FILTER="${FILTER} and ((.updated_ts // \"\") <= \$f_until)"
fi
if [ -n "$ISSUE" ]; then
  JQ_ARGS+=(--argjson f_issue "$ISSUE")
  FILTER="${FILTER} and (.issue == \$f_issue)"
fi
if [ -n "$PR" ]; then
  JQ_ARGS+=(--argjson f_pr "$PR")
  FILTER="${FILTER} and (.pr == \$f_pr)"
fi
if [ -n "$WORKTREE_SLUG" ]; then
  JQ_ARGS+=(--arg f_wts "$WORKTREE_SLUG")
  FILTER="${FILTER} and (.worktree_slug == \$f_wts)"
fi
if [ -n "$SEARCH" ]; then
  # Fixed-string containment only — never treat --search as a regex.
  JQ_ARGS+=(--arg f_search "$SEARCH")
  FILTER="${FILTER} and ((. | tostring) | contains(\$f_search))"
fi

MATCHES="${WORKDIR}/matches.jsonl"
jq -c "${JQ_ARGS[@]+"${JQ_ARGS[@]}"}" "select(${FILTER})" "$COMBINED" >"$MATCHES"

if [ ! -s "$MATCHES" ]; then
  printf 'no matching records\n'
  exit 0
fi

if [ "$FORMAT" = "key" ]; then
  jq -r '.key' "$MATCHES"
  exit 0
fi

render_line <"$MATCHES"
