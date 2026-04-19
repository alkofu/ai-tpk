#!/usr/bin/env bash

set -euo pipefail

# Compose a git branch name `{prefix}/{slug}` from a free-form description and
# a conventional-commit prefix; cap at 60 chars total.
#
# Usage: slugify.sh <description> <prefix>
#
# Exits:
#   0  — success; branch name written to stdout
#   2  — missing or empty argument (programmer error — DM passed empty arg)
#   3  — prefix consumes entire 60-char branch cap (no room for slug character)
#   4  — description normalised to empty slug (no [a-z0-9] characters)
#
# Note: SESSION_SLUG derivation in dungeonmaster.md uses similar rules but a
# 40-char cap; that is intentionally separate from this script.

DESC="${1:-}"
PREFIX="${2:-}"

if [[ -z "$DESC" ]]; then
  printf '%s\n' "slugify.sh: missing or empty description argument (expected as \$1)" >&2
  exit 2
fi

if [[ -z "$PREFIX" ]]; then
  printf '%s\n' "slugify.sh: missing or empty prefix argument (expected as \$2)" >&2
  exit 2
fi

if [[ ! "$PREFIX" =~ ^[a-z][a-z0-9]*$ ]]; then
  printf '%s\n' "slugify.sh: prefix must match ^[a-z][a-z0-9]*$ (got: ${PREFIX})" >&2
  exit 2
fi

# Transform the description into a slug:
# 1. Lowercase
# 2. Replace any character not in [a-z0-9-] with -
# 3. Collapse runs of - into a single -
# 4. Strip leading and trailing -
SLUG=$(printf '%s' "$DESC" | tr '[:upper:]' '[:lower:]')
SLUG=$(printf '%s' "$SLUG" | sed -E 's/[^a-z0-9-]+/-/g')
SLUG=$(printf '%s' "$SLUG" | sed -E 's/-+/-/g')
SLUG=$(printf '%s' "$SLUG" | sed -E 's/^-+//; s/-+$//')

if [[ -z "$SLUG" ]]; then
  printf '%s\n' "slugify.sh: description normalised to empty slug (input contained no [a-z0-9] characters)" >&2
  exit 4
fi

# Compose branch name
BRANCH="${PREFIX}/${SLUG}"

# Apply 60-character cap: truncate the slug portion (not the prefix)
if [[ ${#BRANCH} -gt 60 ]]; then
  MAX_SLUG_LEN=$((60 - ${#PREFIX} - 1))
  if [[ $MAX_SLUG_LEN -le 0 ]]; then
    printf '%s\n' "slugify.sh: prefix too long for 60-char branch cap (prefix=${PREFIX})" >&2
    exit 3
  fi
  SLUG="${SLUG:0:$MAX_SLUG_LEN}"
  # Strip trailing - introduced by truncation
  SLUG=$(printf '%s' "$SLUG" | sed -E 's/-+$//')
  BRANCH="${PREFIX}/${SLUG}"
fi

printf '%s\n' "$BRANCH"
