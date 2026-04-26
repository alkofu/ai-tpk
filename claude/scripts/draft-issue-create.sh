#!/usr/bin/env bash

# This script's internals are exempt from `claude/references/bash-style.md` — that file
# governs agent-level Bash tool calls only. Internal use of `&&`, `;`, `|`, and `$(...)` is
# permitted.

# draft-issue-create.sh — Create a GitHub issue via gh CLI, ensuring review:* labels exist.
#
# Usage:
#   draft-issue-create.sh --title TITLE --body-file PATH [--label LABEL]...
#
# TITLE        Issue title. Pass via --title "$variable" — bash quoting handles special
#              characters; no pre-escaping needed inside the script.
# PATH         Path to a file containing the issue body (markdown).
# --label      Label to apply. May be repeated. Pass 'enhancement' and any selected
#              'review:*' labels. Missing review:* labels are created automatically;
#              non-review:* labels (e.g., 'enhancement') are included as-is.
#
# On success:  prints the created issue URL to stdout; deletes the body file.
# On failure:  exits non-zero with diagnostics on stderr; leaves body file for inspection.

set -euo pipefail

# ---------- argument parsing ----------

title=""
body_file=""
requested_labels=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --title)     title="$2";                   shift 2 ;;
    --body-file) body_file="$2";               shift 2 ;;
    --label)     requested_labels+=("$2");     shift 2 ;;
    *) printf 'draft-issue-create.sh: unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done

[[ -n "$title" ]]     || { printf 'draft-issue-create.sh: --title is required\n' >&2;                   exit 2; }
[[ -n "$body_file" ]] || { printf 'draft-issue-create.sh: --body-file is required\n' >&2;               exit 2; }
[[ -f "$body_file" ]] || { printf 'draft-issue-create.sh: body file not found: %s\n' "$body_file" >&2;  exit 2; }

# ---------- review:* label metadata ----------

declare -A review_descriptions=(
  ["review:security"]="Routes implementation review through the security specialist (Riskmancer)"
  ["review:performance"]="Routes implementation review through the performance specialist (Windwarden)"
  ["review:complexity"]="Routes implementation review through the complexity/design specialist (Knotcutter)"
  ["review:facts"]="Routes implementation review through the factual-validation specialist (Truthhammer)"
)

# ---------- fetch existing labels — single call (avoids repeated gh label list per label) ----------

existing_labels=""
if ! existing_labels="$(gh label list --json name -q '.[].name' 2>/dev/null)"; then
  printf 'draft-issue-create.sh: Warning: gh label list failed; will attempt to create all selected review:* labels\n' >&2
fi

# ---------- resolve labels: create missing review:* labels; collect final set ----------

final_labels=()

for label in "${requested_labels[@]}"; do
  if [[ "${review_descriptions[$label]+_}" ]]; then
    # review:* label — create if missing; guard each individually under set -euo pipefail
    if printf '%s\n' "$existing_labels" | grep -Fxq "$label"; then
      final_labels+=("$label")
    else
      create_err=""
      if create_err="$(gh label create "$label" \
          --description "${review_descriptions[$label]}" \
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

# ---------- build label args ----------

label_args=()
for l in "${final_labels[@]}"; do
  label_args+=("--label" "$l")
done

# ---------- create the issue ----------

tmp_err="$(mktemp)"
trap 'rm -f "$tmp_err"' EXIT

issue_url=""
create_rc=0
issue_url="$(gh issue create \
  --title "$title" \
  --body-file "$body_file" \
  "${label_args[@]}" 2>"$tmp_err")" || create_rc=$?

if [[ $create_rc -eq 0 ]]; then
  printf '%s\n' "$issue_url"
  rm -f "$body_file"
  exit 0
fi

create_err="$(cat "$tmp_err")"

# If failure mentions 'enhancement', retry without it
if printf '%s' "$create_err" | grep -qi "enhancement"; then
  label_args_no_enh=()
  for arg in "${label_args[@]}"; do
    if [[ "$arg" == "enhancement" ]]; then
      # Remove the preceding --label flag we just added
      unset 'label_args_no_enh[-1]'
    else
      label_args_no_enh+=("$arg")
    fi
  done

  retry_rc=0
  issue_url="$(gh issue create \
    --title "$title" \
    --body-file "$body_file" \
    "${label_args_no_enh[@]}" 2>"$tmp_err")" || retry_rc=$?

  if [[ $retry_rc -eq 0 ]]; then
    printf 'Warning: enhancement label not found; issue filed without it.\n' >&2
    printf '%s\n' "$issue_url"
    rm -f "$body_file"
    exit 0
  fi

  create_err="$(cat "$tmp_err")"
fi

printf '%s\n' "$create_err" >&2
exit 1
