#!/usr/bin/env bash

# This script's internals are exempt from `claude/references/bash-style.md` — that file
# governs agent-level Bash tool calls only. Internal use of `&&`, `;`, `|`, and `$(...)` is
# permitted.

# Known limitation (FV-2): GitHub's POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/
# {comment_id}/replies endpoint returns 404 for comments submitted as part of a formal review
# flow ("Start a Review"). It works only for standalone diff comments. When the script detects
# a 404 response, it emits error_kind=review_flow_comment so the caller can show a clear
# non-retryable error.

set -euo pipefail

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  printf 'Error: not inside a git repository\n' >&2
  exit 1
}

# Error contract (F-004):
#   - Exit 2 ONLY for arg-validation (no JSON emitted — the only case where stdout is empty).
#   - ALL other failures: emit {"ok": false, "error": "...", "error_kind": "<kind>"} to stdout
#     and exit 1. The caller branches on .ok uniformly.
#   - error_kind enum: auth, body_file_missing, owner_repo_parse, review_flow_comment, api,
#     unknown.

# Arg validation: require all three positional args.
pr_number="${1:-}"
comment_full_database_id="${2:-}"
body_file_path="${3:-}"

if [[ -z "$pr_number" ]] || [[ -z "$comment_full_database_id" ]] || [[ -z "$body_file_path" ]]; then
  printf 'Usage: pr-comments-reply.sh <pr-number> <comment-full-database-id> <body-file-path>\n' >&2
  exit 2
fi

# Verify GitHub authentication. On failure: emit JSON to stdout + exit 1.
if ! gh auth status >/dev/null 2>&1; then
  jq -n '{ok: false, error: "GitHub authentication is required. Run `gh auth login` and try again.", error_kind: "auth"}'
  exit 1
fi

# Verify body file exists and is readable. On failure: emit JSON to stdout + exit 1.
if [[ ! -r "$body_file_path" ]]; then
  jq -n --arg path "$body_file_path" '{ok: false, error: ("body file not found: " + $path), error_kind: "body_file_missing"}'
  exit 1
fi

# Derive owner and repo from the git remote URL.
origin_url="$(git remote get-url origin)"
if [[ "$origin_url" =~ ^git@github\.com:([^/]+)/(.+)$ ]]; then
  owner="${BASH_REMATCH[1]}"
  repo="${BASH_REMATCH[2]%.git}"
elif [[ "$origin_url" =~ ^https://github\.com/([^/]+)/([^/]+)$ ]]; then
  owner="${BASH_REMATCH[1]}"
  repo="${BASH_REMATCH[2]%.git}"
else
  jq -n '{ok: false, error: "Could not parse owner/repo from origin URL", error_kind: "owner_repo_parse"}'
  exit 1
fi

# Post the reply via the GitHub REST API. Capture stdout, stderr, and exit code separately.
tmp_stdout="$(mktemp)"
tmp_stderr="$(mktemp)"

gh_exit=0
gh api --method POST \
  "/repos/${owner}/${repo}/pulls/${pr_number}/comments/${comment_full_database_id}/replies" \
  -F body="@${body_file_path}" \
  >"$tmp_stdout" 2>"$tmp_stderr" || gh_exit=$?

api_stdout="$(cat "$tmp_stdout")"
api_stderr="$(cat "$tmp_stderr")"
rm -f "$tmp_stdout" "$tmp_stderr"

if [[ "$gh_exit" -ne 0 ]]; then
  # Detect the 404 review-flow case (FV-2).
  if printf '%s' "$api_stderr" | grep -q 'HTTP 404'; then
    jq -n '{
      ok: false,
      error: "Review-flow comment (404): cannot reply via REST replies endpoint. This comment was submitted as part of a formal review and the /replies endpoint does not support it. Use a standalone comment on the PR instead.",
      error_kind: "review_flow_comment"
    }'
    exit 1
  fi

  # Any other API failure.
  jq -n --arg err "$api_stderr" '{ok: false, error: $err, error_kind: "api"}'
  exit 1
fi

# Success: extract html_url from the response and emit ok=true.
html_url="$(printf '%s' "$api_stdout" | jq -r '.html_url // empty')"
if [[ -z "$html_url" ]]; then
  jq -n --arg raw "$api_stdout" '{ok: false, error: ("Unexpected response from GitHub API: " + $raw), error_kind: "unknown"}'
  exit 1
fi

jq -n --arg url "$html_url" '{ok: true, html_url: $url}'
