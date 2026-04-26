#!/usr/bin/env bash

# This script's internals are exempt from `claude/references/bash-style.md` — that file
# governs agent-level Bash tool calls only. Internal use of `&&`, `;`, `|`, and `$(...)` is
# permitted.

# draft-issue-create.sh — Create a GitHub issue via gh CLI, ensuring review:* labels exist.
#
# Usage:
#   draft-issue-create.sh --title-file PATH --body-file PATH [--label LABEL]...
#
# --title-file PATH   Path to a file containing the issue title (single line, no trailing newline
#                     required). Using a file bypasses shell parsing of special characters —
#                     do NOT interpolate the title into the shell command line directly.
# --body-file PATH    Path to a file containing the issue body (markdown).
# --label LABEL       Label to apply. May be repeated. Pass 'enhancement' and any selected
#                     'review:*' labels. Missing review:* labels are created automatically;
#                     non-review:* labels (e.g., 'enhancement') are included as-is.
#
# On success:  prints the created issue URL to stdout; deletes both the title and body files.
#              Non-fatal warnings (e.g., label-creation failures, missing 'enhancement'
#              label) may be written to stderr while still exiting 0.
# On failure:  exits non-zero with diagnostics on stderr; leaves both files for inspection.
#
# Requires bash >= 3.2 (ships with macOS). No bash 4+ idioms are used.

set -euo pipefail

# ---------- review:* label helpers (bash 3.2-compatible — no associative arrays) ----------

_is_review_label() {
  case "$1" in
    review:security|review:performance|review:complexity|review:facts) return 0 ;;
    *) return 1 ;;
  esac
}

_review_label_description() {
  case "$1" in
    review:security)    printf '%s' "Routes implementation review through the security specialist (Riskmancer)" ;;
    review:performance) printf '%s' "Routes implementation review through the performance specialist (Windwarden)" ;;
    review:complexity)  printf '%s' "Routes implementation review through the complexity/design specialist (Knotcutter)" ;;
    review:facts)       printf '%s' "Routes implementation review through the factual-validation specialist (Truthhammer)" ;;
  esac
}

# ---------- argument parsing ----------

title_file=""
body_file=""
requested_labels=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --title-file) title_file="$2";             shift 2 ;;
    --body-file)  body_file="$2";              shift 2 ;;
    --label)      requested_labels+=("$2");    shift 2 ;;
    *) printf 'draft-issue-create.sh: unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done

[[ -n "$title_file" ]]  || { printf 'draft-issue-create.sh: --title-file is required\n' >&2;                   exit 2; }
[[ -f "$title_file" ]]  || { printf 'draft-issue-create.sh: title file not found: %s\n' "$title_file" >&2;     exit 2; }
[[ -n "$body_file" ]]   || { printf 'draft-issue-create.sh: --body-file is required\n' >&2;                    exit 2; }
[[ -f "$body_file" ]]   || { printf 'draft-issue-create.sh: body file not found: %s\n' "$body_file" >&2;       exit 2; }

title="$(cat "$title_file")"
[[ -n "$title" ]] || { printf 'draft-issue-create.sh: title file is empty: %s\n' "$title_file" >&2; exit 2; }

# ---------- fetch existing labels — single call (avoids repeated gh label list per label) ----------

existing_labels=""
if ! existing_labels="$(gh label list --json name -q '.[].name' 2>/dev/null)"; then
  printf 'draft-issue-create.sh: Warning: gh label list failed; will attempt to create all selected review:* labels\n' >&2
fi

# ---------- resolve labels: create missing review:* labels; collect final set ----------

final_labels=()

# Guard: bash 3.2 raises 'unbound variable' on empty array expansion under set -u.
if [[ ${#requested_labels[@]} -gt 0 ]]; then
  for label in "${requested_labels[@]}"; do
    if _is_review_label "$label"; then
      # review:* label — create if missing; guard each individually under set -euo pipefail
      if printf '%s\n' "$existing_labels" | grep -Fxq "$label"; then
        final_labels+=("$label")
      else
        create_err=""
        if create_err="$(gh label create "$label" \
            --description "$(_review_label_description "$label")" \
            --color ededed 2>&1)"; then
          final_labels+=("$label")
        else
          first_err="$(printf '%s' "$create_err" | head -1)"
          printf 'Warning: could not create label %s (%s). Issue will be filed without this label.\n' \
            "$label" "$first_err" >&2
        fi
      fi
    else
      # Non-review label (e.g., 'enhancement') — include as-is; no creation attempt.
      final_labels+=("$label")
    fi
  done
fi

# ---------- build label args ----------

label_args=()
if [[ ${#final_labels[@]} -gt 0 ]]; then
  for l in "${final_labels[@]}"; do
    label_args+=("--label" "$l")
  done
fi

# ---------- create the issue ----------

tmp_err="$(mktemp)"
trap 'rm -f "$tmp_err"' EXIT

issue_url=""
create_rc=0
issue_url="$(gh issue create \
  --title "$title" \
  --body-file "$body_file" \
  ${label_args[@]+"${label_args[@]}"} 2>"$tmp_err")" || create_rc=$?

if [[ $create_rc -eq 0 ]]; then
  printf '%s\n' "$issue_url"
  rm -f "$body_file" "$title_file"
  exit 0
fi

create_err="$(cat "$tmp_err")"

# If failure mentions 'enhancement', retry without it.
# Rebuild label_args without 'enhancement' from final_labels (avoids array-element coupling).
if printf '%s' "$create_err" | grep -qi "enhancement"; then
  label_args_no_enh=()
  if [[ ${#final_labels[@]} -gt 0 ]]; then
    for l in "${final_labels[@]}"; do
      [[ "$l" == "enhancement" ]] && continue
      label_args_no_enh+=("--label" "$l")
    done
  fi

  retry_rc=0
  issue_url="$(gh issue create \
    --title "$title" \
    --body-file "$body_file" \
    ${label_args_no_enh[@]+"${label_args_no_enh[@]}"} 2>"$tmp_err")" || retry_rc=$?

  if [[ $retry_rc -eq 0 ]]; then
    printf 'Warning: enhancement label not found; issue filed without it.\n' >&2
    printf '%s\n' "$issue_url"
    rm -f "$body_file" "$title_file"
    exit 0
  fi

  create_err="$(cat "$tmp_err")"
fi

printf '%s\n' "$create_err" >&2
exit 1
