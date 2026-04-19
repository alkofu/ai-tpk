#!/usr/bin/env bash

set -euo pipefail

# This script's internals are exempt from `claude/references/bash-style.md` — that file governs
# agent-level Bash tool calls only. Internal use of `&&`, `;`, `|`, and `$(...)` is permitted.

# NO repo-preflight guard — this script accepts an optional <repo-root> arg and operates on
# arbitrary directories, not necessarily git repos.

# Accept optional positional arg <repo-root>; default to current directory.
repo_root="${1:-$(pwd)}"

# Verify the target directory exists and is readable.
if [[ ! -d "$repo_root" || ! -r "$repo_root" ]]; then
  printf 'Error: directory not found or not readable: %s\n' "$repo_root" >&2
  exit 1
fi

stack=""
lint_cmd=""
format_check_cmd=""
format_warning=""

# Detection rules — first match wins.

# Rule 1: Node/npm
if [[ -f "$repo_root/package.json" ]]; then
  stack="node"
  lint_cmd="npm run lint"
  format_check_cmd="npm run format:check"
  format_warning=""

# Rule 2: Makefile with lint target
elif [[ -f "$repo_root/Makefile" ]] && grep -qE '^lint[[:space:]]*:' "$repo_root/Makefile"; then
  stack="make"
  lint_cmd="make lint"
  # Determine format check command by inspecting targets in priority order.
  if grep -qE '^fmt-check[[:space:]]*:' "$repo_root/Makefile"; then
    format_check_cmd="make fmt-check"
    format_warning=""
  elif grep -qE '^format-check[[:space:]]*:' "$repo_root/Makefile"; then
    format_check_cmd="make format-check"
    format_warning=""
  elif grep -qE '^check-format[[:space:]]*:' "$repo_root/Makefile"; then
    format_check_cmd="make check-format"
    format_warning=""
  elif grep -qE '^fmt[[:space:]]*:' "$repo_root/Makefile"; then
    format_check_cmd=""
    format_warning="Makefile \`fmt\` target detected but it modifies files — skipping format check. Add a \`fmt-check\` target to enable it."
  else
    format_check_cmd=""
    format_warning="No format check target found in Makefile."
  fi

# Rule 3: Python (modern)
elif [[ -f "$repo_root/pyproject.toml" ]]; then
  stack="python"
  lint_cmd="ruff check ."
  format_check_cmd="ruff format --check ."
  format_warning=""

# Rule 4: Python (legacy)
elif [[ -f "$repo_root/setup.py" || -f "$repo_root/setup.cfg" ]]; then
  stack="python-legacy"
  lint_cmd="flake8 ."
  format_check_cmd="black --check ."
  format_warning=""

# Rule 5: Go
elif [[ -f "$repo_root/go.mod" ]]; then
  stack="go"
  lint_cmd="golangci-lint run"
  format_check_cmd="gofmt -l ."
  format_warning=""

# Rule 6: Rust
elif [[ -f "$repo_root/Cargo.toml" ]]; then
  stack="rust"
  lint_cmd="cargo clippy"
  format_check_cmd="cargo fmt --check"
  format_warning=""

# Rule 7: No match
else
  stack="unknown"
  lint_cmd=""
  format_check_cmd=""
  format_warning="No recognized lint/format toolchain was found. Skipping validation."
fi

# Emit single-line JSON. All four fields are always present.
jq -n \
  --arg stack "$stack" \
  --arg lint_cmd "$lint_cmd" \
  --arg format_check_cmd "$format_check_cmd" \
  --arg format_warning "$format_warning" \
  '{"stack": $stack, "lint_cmd": $lint_cmd, "format_check_cmd": $format_check_cmd, "format_warning": $format_warning}'
