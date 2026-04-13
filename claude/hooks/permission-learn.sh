#!/bin/bash
# permission-learn.sh — PermissionRequest hook
# Denies compound Bash commands and process substitution; logs single-command requests for manual review.
# Fails open if jq is unavailable.

# Read hook payload from stdin
STDIN_DATA=""
read -r -t 2 STDIN_DATA 2>/dev/null || true
[ -z "$STDIN_DATA" ] && STDIN_DATA='{}'

# Fail open if jq is unavailable
if ! command -v jq &>/dev/null; then
  exit 0
fi

# Extract tool name and command — only act on Bash calls with a non-empty command
TOOL_NAME=$(echo "$STDIN_DATA" | jq -r '.tool_name // ""' 2>/dev/null)
COMMAND=$(echo "$STDIN_DATA" | jq -r '.tool_input.command // ""' 2>/dev/null)

if [ "$TOOL_NAME" != "Bash" ] || [ -z "$COMMAND" ]; then
  exit 0
fi

# Extract agent metadata — default to "none" if absent
AGENT_ID=$(echo "$STDIN_DATA" | jq -r '.agent_id // "none"' 2>/dev/null)
AGENT_TYPE=$(echo "$STDIN_DATA" | jq -r '.agent_type // "none"' 2>/dev/null)

# Strip quoted strings to avoid false positives on literal && or ; inside strings.
# Double-quote stripping first (removes any single quotes nested inside double-quoted strings),
# then single-quote stripping second.
STRIPPED=$(printf '%s' "$COMMAND" | sed 's/"[^"]*"//g')
STRIPPED=$(printf '%s' "$STRIPPED" | sed "s/'[^']*'//g")

# Check for compound operators in the stripped command
COMPOUND=0
if printf '%s' "$STRIPPED" | grep -q '&&'; then
  COMPOUND=1
fi
if printf '%s' "$STRIPPED" | grep -q ';'; then
  COMPOUND=1
fi
NEWLINE_COUNT=$(printf '%s' "$STRIPPED" | wc -l | tr -d ' ')
if [ "$NEWLINE_COUNT" -gt 0 ]; then
  COMPOUND=1
fi
if printf '%s' "$STRIPPED" | grep -qF '<('; then
  COMPOUND=1
fi
if printf '%s' "$STRIPPED" | grep -qF '>('; then
  COMPOUND=1
fi

if [ "$COMPOUND" -eq 1 ]; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PermissionRequest",
      decision: {
        behavior: "deny",
        message: "Compound commands (&&, ;, newlines) and process substitution (<(...), >(...)) are not allowed. Split into separate Bash calls — one command per call. Replace process substitution with temp files."
      }
    }
  }'
  exit 0
fi

# Check for --no-verify flag in git commit/push commands
NOVERIFY=0
if printf '%s' "$STRIPPED" | grep -qE 'git\s+(commit|push)\b.*--no-verify'; then
  NOVERIFY=1
fi
if printf '%s' "$STRIPPED" | grep -qE 'git\s+commit\b.*\s-n(\s|$)'; then
  NOVERIFY=1
fi

if [ "$NOVERIFY" -eq 1 ]; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PermissionRequest",
      decision: {
        behavior: "deny",
        message: "--no-verify is not allowed. Git hooks exist for a reason — do not skip them. If a hook fails, investigate and fix the underlying issue."
      }
    }
  }'
  exit 0
fi

# Single command — log the request for manual review, then exit 0 with no JSON
# output so the normal permission dialog handles it.
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
LOG_FILE="$HOME/.claude/permission-requests.log"
printf '%s | agent_type=%s | agent_id=%s | command=%s\n' \
  "$TIMESTAMP" "$AGENT_TYPE" "$AGENT_ID" "$COMMAND" >> "$LOG_FILE"

exit 0
