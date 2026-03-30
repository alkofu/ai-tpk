#!/usr/bin/env bash
# adapters/lib/parse.sh — Shared YAML parsing utilities for ai-tpk adapter scripts.
#
# Requires: yq (https://github.com/mikefarah/yq) — the Go-based yq by Mike Farah.
# Install:
#   macOS:  brew install yq
#   Linux:  snap install yq
#           OR: wget https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 \
#                   -O /usr/bin/yq && chmod +x /usr/bin/yq
#
# Usage (source this file from adapter scripts):
#   source "$(dirname "$0")/lib/parse.sh"
#
# Usage (self-test mode):
#   ./adapters/lib/parse.sh --test

# ---------------------------------------------------------------------------
# yq availability check — runs at source time
# ---------------------------------------------------------------------------
if ! command -v yq >/dev/null 2>&1; then
  echo "ERROR: yq is required but was not found on PATH." >&2
  echo "" >&2
  echo "Install the Go-based yq by Mike Farah (https://github.com/mikefarah/yq):" >&2
  echo "  macOS:  brew install yq" >&2
  echo "  Linux:  snap install yq" >&2
  echo "          OR: wget https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 \\" >&2
  echo "                  -O /usr/bin/yq && chmod +x /usr/bin/yq" >&2
  echo "" >&2
  echo "NOTE: This must be the Go-based yq, NOT the Python yq wrapper." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Internal helper: extract YAML frontmatter block from a .md file.
# Prints the raw YAML content between the first and second '---' delimiters.
# ---------------------------------------------------------------------------
_extract_yaml() {
  local file="$1"
  awk 'BEGIN{c=0} /^---$/{c++;if(c==2)exit;next} c==1{print}' "$file"
}

# ---------------------------------------------------------------------------
# get_field <file> <key>
#
# Reads a top-level YAML frontmatter field from a source agent .md file.
# Prints the value to stdout; prints nothing if the field is absent.
#
# Example:
#   get_field src/agents/bitsmith.md description
# ---------------------------------------------------------------------------
get_field() {
  local file="$1" key="$2"
  local value
  value=$(_extract_yaml "$file" | yq ".$key")
  if [ "$value" = "null" ]; then
    return 0
  fi
  echo "$value"
}

# ---------------------------------------------------------------------------
# get_namespaced_field <file> <namespace> <key>
#
# Reads a nested YAML field under a harness namespace block.
# Prints the value to stdout; prints nothing if the field is absent.
#
# Example:
#   get_namespaced_field src/agents/bitsmith.md claude tools
# ---------------------------------------------------------------------------
get_namespaced_field() {
  local file="$1" namespace="$2" key="$3"
  local value
  value=$(_extract_yaml "$file" | yq ".$namespace.$key")
  if [ "$value" = "null" ]; then
    return 0
  fi
  echo "$value"
}

# ---------------------------------------------------------------------------
# get_array <file> <dotpath>
#
# Reads a YAML array field and prints each element on its own line.
# If the field is absent or not an array, prints nothing.
#
# Example:
#   get_array src/agents/riskmancer.md opencode.permission
#   get_array src/agents/riskmancer.md claude.trigger_keywords
# ---------------------------------------------------------------------------
get_array() {
  local file="$1" dotpath="$2"
  local value
  value=$(_extract_yaml "$file" | yq ".$dotpath[]" 2>/dev/null)
  if [ -n "$value" ]; then
    echo "$value"
  fi
}

# ---------------------------------------------------------------------------
# get_body <file>
#
# Extracts the Markdown body — everything after the closing '---' of the
# YAML frontmatter. Strips the leading blank line if present.
#
# Example:
#   get_body src/agents/bitsmith.md
# ---------------------------------------------------------------------------
get_body() {
  local file="$1"
  awk 'BEGIN{count=0} /^---$/{count++; if(count==2){found=1; next}} found{print}' "$file"
}

# ---------------------------------------------------------------------------
# map_model_opencode <model_id>
#
# Prepends 'anthropic/' to a model identifier if not already prefixed.
# If the model is empty or the literal string "null", returns empty string.
#
# Example:
#   map_model_opencode "claude-sonnet-4-6"  ->  "anthropic/claude-sonnet-4-6"
#   map_model_opencode "anthropic/claude-opus-4-6"  ->  "anthropic/claude-opus-4-6"
# ---------------------------------------------------------------------------
map_model_opencode() {
  local model="$1"
  if [ -z "$model" ] || [ "$model" = "null" ]; then
    return 0
  fi
  case "$model" in
    anthropic/*) echo "$model" ;;
    *)           echo "anthropic/$model" ;;
  esac
}

# ---------------------------------------------------------------------------
# agent_name_from_file <file>
#
# Extracts the agent name from a filename (basename without .md extension).
#
# Example:
#   agent_name_from_file src/agents/bitsmith.md  ->  bitsmith
# ---------------------------------------------------------------------------
agent_name_from_file() {
  local file="$1"
  local base
  base=$(basename "$file")
  echo "${base%.md}"
}

# ---------------------------------------------------------------------------
# Self-test mode — run when invoked directly with --test
# ---------------------------------------------------------------------------
if [ "${1:-}" = "--test" ]; then
  # Resolve the repo root relative to this script's location so the tests
  # work regardless of the caller's working directory.
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
  BITSMITH="$REPO_ROOT/src/agents/bitsmith.md"
  RISKMANCER="$REPO_ROOT/src/agents/riskmancer.md"

  pass_count=0
  fail_count=0

  _assert() {
    local label="$1" result="$2" expected="$3"
    if [ "$result" = "$expected" ]; then
      echo "PASS: $label"
      pass_count=$((pass_count + 1))
    else
      echo "FAIL: $label"
      echo "  expected: $(echo "$expected" | head -3)"
      echo "  got:      $(echo "$result"   | head -3)"
      fail_count=$((fail_count + 1))
    fi
  }

  _assert_nonempty() {
    local label="$1" result="$2"
    if [ -n "$result" ]; then
      echo "PASS: $label"
      pass_count=$((pass_count + 1))
    else
      echo "FAIL: $label (got empty value)"
      fail_count=$((fail_count + 1))
    fi
  }

  # _assert_no_bare_line checks that no line in result is exactly the given string.
  _assert_no_bare_line() {
    local label="$1" result="$2" forbidden="$3"
    if echo "$result" | grep -qxF -- "$forbidden"; then
      echo "FAIL: $label (found bare line '$forbidden')"
      fail_count=$((fail_count + 1))
    else
      echo "PASS: $label"
      pass_count=$((pass_count + 1))
    fi
  }

  _assert_line_count_ge() {
    local label="$1" result="$2" min="$3"
    local count
    count=$(echo "$result" | grep -c .)
    if [ "$count" -ge "$min" ]; then
      echo "PASS: $label ($count lines)"
      pass_count=$((pass_count + 1))
    else
      echo "FAIL: $label (expected >= $min lines, got $count)"
      fail_count=$((fail_count + 1))
    fi
  }

  echo "--- Self-test: get_field (bitsmith) ---"
  _assert_nonempty \
    "get_field bitsmith description returns non-empty" \
    "$(get_field "$BITSMITH" description)"

  _assert \
    "get_field bitsmith model returns claude-sonnet-4-6" \
    "$(get_field "$BITSMITH" model)" \
    "claude-sonnet-4-6"

  echo ""
  echo "--- Self-test: get_namespaced_field (bitsmith) ---"
  _assert \
    "get_namespaced_field bitsmith claude tools" \
    "$(get_namespaced_field "$BITSMITH" claude tools)" \
    "Read, Write, Edit, Bash, Grep, Glob, Agent"

  echo ""
  echo "--- Self-test: get_array (bitsmith) ---"
  BITSMITH_PERMS="$(get_array "$BITSMITH" opencode.permission)"
  _assert \
    "get_array bitsmith opencode.permission returns 6 tools" \
    "$(echo "$BITSMITH_PERMS" | wc -l | tr -d ' ')" \
    "6"

  echo ""
  echo "--- Self-test: get_body (bitsmith) ---"
  BITSMITH_BODY="$(get_body "$BITSMITH")"
  _assert_nonempty \
    "get_body bitsmith returns non-empty body" \
    "$BITSMITH_BODY"
  _assert_no_bare_line \
    "get_body bitsmith body does not contain bare '---' delimiter line" \
    "$BITSMITH_BODY" \
    "---"

  echo ""
  echo "--- Self-test: get_field (riskmancer) ---"
  _assert \
    "get_field riskmancer model returns claude-opus-4-6" \
    "$(get_field "$RISKMANCER" model)" \
    "claude-opus-4-6"

  echo ""
  echo "--- Self-test: get_namespaced_field (riskmancer) ---"
  RISKMANCER_DISALLOWED="$(get_namespaced_field "$RISKMANCER" claude disallowedTools)"
  _assert_nonempty \
    "get_namespaced_field riskmancer claude disallowedTools returns non-empty" \
    "$RISKMANCER_DISALLOWED"

  echo ""
  echo "--- Self-test: get_array (riskmancer) ---"
  RISKMANCER_KEYWORDS="$(get_array "$RISKMANCER" claude.trigger_keywords)"
  _assert_line_count_ge \
    "get_array riskmancer claude.trigger_keywords returns multiple elements" \
    "$RISKMANCER_KEYWORDS" \
    2

  echo ""
  echo "--- Self-test: map_model_opencode ---"
  _assert \
    "map_model_opencode adds anthropic/ prefix" \
    "$(map_model_opencode "claude-sonnet-4-6")" \
    "anthropic/claude-sonnet-4-6"

  _assert \
    "map_model_opencode does not double-prefix" \
    "$(map_model_opencode "anthropic/claude-opus-4-6")" \
    "anthropic/claude-opus-4-6"

  _assert \
    "map_model_opencode empty input returns empty" \
    "$(map_model_opencode "")" \
    ""

  echo ""
  echo "--- Self-test: agent_name_from_file ---"
  _assert \
    "agent_name_from_file strips path and extension" \
    "$(agent_name_from_file "$BITSMITH")" \
    "bitsmith"

  echo ""
  echo "Results: $pass_count passed, $fail_count failed."
  if [ "$fail_count" -gt 0 ]; then
    exit 1
  fi
  exit 0
fi
