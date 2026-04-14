#!/bin/bash
# permission-learn.sh — PermissionRequest hook
# Auto-approves single Bash commands whose allowedTools pattern matches and all safety guards pass.
# Denies compound commands, process substitution, and --no-verify.
# Logs every decision; falls through to the normal permission dialog for unmatched commands.
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

# Strip ALL quoted strings for compound-operator detection only. Both single- and
# double-quoted content may contain literal &&, ;, etc. that are not operators.
# WARNING: Do NOT use $STRIPPED for security checks — see $SECURITY_STRIPPED below.
STRIPPED=$(printf '%s' "$COMMAND" | sed 's/"[^"]*"//g')
STRIPPED=$(printf '%s' "$STRIPPED" | sed "s/'[^']*'//g")

# Security-sensitive stripping: remove only single-quoted strings (whose content is
# truly literal in bash). Double-quoted content is preserved because $(), backticks,
# and $VAR all expand inside double quotes — security checks must see them.
SECURITY_STRIPPED=$(printf '%s' "$COMMAND" | sed "s/'[^']*'//g")

# --- Helper functions ---

# matches_allowed_tools NEUTRALIZED_CMD
# Returns 0 (true) if the command matches an allowedTools Bash(...) glob pattern.
# SYNC: Keep this list in sync with allowedTools in claude/settings.json
matches_allowed_tools() {
  local cmd="$1"
  case "$cmd" in
    git\ *)              return 0 ;;
    gh\ pr\ *)           return 0 ;;
    gh\ issue\ *)        return 0 ;;
    gh\ run\ *)          return 0 ;;
    gh\ repo\ view\ *)   return 0 ;;
    gh\ repo\ clone\ *)  return 0 ;;
    gh\ release\ view\ *) return 0 ;;
    gh\ auth\ switch\ *) return 0 ;;
    mkdir\ *)            return 0 ;;
    rm\ *)               return 0 ;;
    cp\ *)               return 0 ;;
    mv\ *)               return 0 ;;
    touch\ *)            return 0 ;;
    ls\ *)               return 0 ;;
    cd\ *)               return 0 ;;
    npm\ *)              return 0 ;;
    npx\ *)              return 0 ;;
    pnpm\ *)             return 0 ;;
    yarn\ *)             return 0 ;;
    python\ *)           return 0 ;;
    python3\ *)          return 0 ;;
    *\ --help)           return 0 ;;
    *\ --version)        return 0 ;;
    *)                   return 1 ;;
  esac
}

# is_simple_expansion_only CMD_STRING
# Returns 0 (true) if the command contains no complex shell constructs beyond
# simple variable expansions ($VAR, ${VAR}) and tilde (~).
# Returns 1 (false) if backticks, $(...), pipes, redirections, or other complex
# constructs are found.
# IMPORTANT: Receive $SECURITY_STRIPPED (single-quote-stripped only), NOT $STRIPPED,
# so that dangerous constructs inside double quotes are visible.
is_simple_expansion_only() {
  local cmd="$1"

  # Reject backtick command substitution
  if printf '%s' "$cmd" | grep -q '`'; then
    return 1
  fi

  # Reject $(...) command substitution
  if printf '%s' "$cmd" | grep -qF '$('; then
    return 1
  fi

  # Reject pipes (but not ||, which is a compound operator caught earlier)
  if printf '%s' "$cmd" | grep -qE '\|[^|]'; then
    return 1
  fi
  if printf '%s' "$cmd" | grep -qE '[^|]\|$'; then
    return 1
  fi

  # Reject redirections: >, >>, <, 2>, &>, etc.
  if printf '%s' "$cmd" | grep -qE '[0-9]*[<>]'; then
    return 1
  fi

  # After removing simple expansions and tildes, remaining text should contain
  # no dollar signs (which would indicate complex expansions like ${var:-default},
  # ${var//pattern/replace}, $((arithmetic)), etc.)
  local neutralized
  neutralized=$(printf '%s' "$cmd" | sed -E 's/\$\{[A-Za-z_][A-Za-z0-9_]*\}//g')
  neutralized=$(printf '%s' "$neutralized" | sed -E 's/\$[A-Za-z_][A-Za-z0-9_]*//g')
  neutralized=$(printf '%s' "$neutralized" | sed 's/~//g')

  if printf '%s' "$neutralized" | grep -q '\$'; then
    return 1
  fi

  return 0
}

# has_dangerous_keywords CMD_STRING
# Returns 0 (true) if the command contains dangerous keywords (eval, exec, source,
# sudo) as standalone words. Uses whitespace-delimited matching to avoid false
# positives on flags like --exec-path, --source, --no-exec.
# Must receive $SECURITY_STRIPPED (single-quote-stripped only).
has_dangerous_keywords() {
  local cmd="$1"
  if printf '%s' "$cmd" | grep -qE '(^| )(eval|exec|source|sudo)( |$)'; then
    return 0
  fi
  return 1
}

# has_git_config_injection CMD_STRING
# Returns 0 (true) if the command is a git command using -c (config override).
# git -c key=value can configure external command execution for ssh, pager, diff,
# editor, and aliases starting with !, enabling arbitrary command execution.
# Matches both standalone -c and concatenated -ckey=val forms.
# Must receive $SECURITY_STRIPPED (single-quote-stripped only).
has_git_config_injection() {
  local cmd="$1"
  local base
  base=$(printf '%s' "$cmd" | awk '{print $1}')
  if [ "$base" = "git" ]; then
    if printf '%s' "$cmd" | grep -qE '(^| )-c'; then
      return 0
    fi
  fi
  return 1
}

# has_python_code_exec CMD_STRING
# Returns 0 (true) if the command is a python/python3 invocation with -c (inline
# code execution). python -c can execute arbitrary system commands, read/write files,
# and make network requests.
# Must receive $SECURITY_STRIPPED (single-quote-stripped only).
has_python_code_exec() {
  local cmd="$1"
  local base
  base=$(printf '%s' "$cmd" | awk '{print $1}')
  if [ "$base" = "python" ] || [ "$base" = "python3" ]; then
    if printf '%s' "$cmd" | grep -qE '(^| )-c( |$)'; then
      return 0
    fi
  fi
  return 1
}

# has_npx_arbitrary_package CMD_STRING
# Returns 0 (true) if the command is an npx invocation. npx auto-downloads packages,
# making it unsafe to auto-approve without knowing which package is being run.
# All npx commands are blocked from auto-approve.
# Must receive $SECURITY_STRIPPED (single-quote-stripped only).
has_npx_arbitrary_package() {
  local cmd="$1"
  local base
  base=$(printf '%s' "$cmd" | awk '{print $1}')
  if [ "$base" = "npx" ]; then
    return 0
  fi
  return 1
}

# neutralize_expansions CMD_STRING
# Replaces $VAR, ${VAR}, and ~ with placeholder literals so the result can be
# matched against allowedTools glob patterns.
neutralize_expansions() {
  local cmd="$1"
  # Replace ${VAR} first (more specific), then $VAR
  cmd=$(printf '%s' "$cmd" | sed 's/\${[A-Za-z_][A-Za-z0-9_]*}/XVARX/g')
  cmd=$(printf '%s' "$cmd" | sed 's/\$[A-Za-z_][A-Za-z0-9_]*/XVARX/g')
  cmd=$(printf '%s' "$cmd" | sed 's|~/|/home/placeholder/|g')
  cmd=$(printf '%s' "$cmd" | sed 's|^~$|/home/placeholder|g')
  printf '%s' "$cmd"
}

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

# --- Auto-approve: allowedTools pattern match + safety guards ---
# Neutralize simple expansions ($VAR, ${VAR}, ~) with placeholder literals,
# then check if the result matches an allowedTools Bash(...) pattern.
NEUTRALIZED=$(neutralize_expansions "$COMMAND")

if matches_allowed_tools "$NEUTRALIZED"; then
  # Safety guards — all operate on $SECURITY_STRIPPED (single-quote-stripped only)
  # so that dangerous constructs inside double quotes remain visible.
  SAFE=1

  # Guard 1: Dangerous keywords (eval, exec, source, sudo)
  if has_dangerous_keywords "$SECURITY_STRIPPED"; then
    SAFE=0
  fi

  # Guard 2: git -c config injection
  if has_git_config_injection "$SECURITY_STRIPPED"; then
    SAFE=0
  fi

  # Guard 3: python/python3 -c arbitrary code execution
  if has_python_code_exec "$SECURITY_STRIPPED"; then
    SAFE=0
  fi

  # Guard 4: npx arbitrary package download/execution
  if has_npx_arbitrary_package "$SECURITY_STRIPPED"; then
    SAFE=0
  fi

  # Guard 5: Complex shell constructs (backticks, $(...), pipes, redirections,
  # complex parameter expansions)
  if ! is_simple_expansion_only "$SECURITY_STRIPPED"; then
    SAFE=0
  fi

  if [ "$SAFE" -eq 1 ]; then
    # All checks passed — auto-approve and log.
    TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    LOG_FILE="$HOME/.claude/permission-requests.log"
    printf '%s | agent_type=%s | agent_id=%s | [auto-approved] command=%s\n' \
      "$TIMESTAMP" "$AGENT_TYPE" "$AGENT_ID" "$COMMAND" >> "$LOG_FILE"
    jq -n '{
      hookSpecificOutput: {
        hookEventName: "PermissionRequest",
        decision: {
          behavior: "allow"
        }
      }
    }'
    exit 0
  fi
fi

# Single command — log the request for manual review, then exit 0 with no JSON
# output so the normal permission dialog handles it.
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
LOG_FILE="$HOME/.claude/permission-requests.log"
printf '%s | agent_type=%s | agent_id=%s | command=%s\n' \
  "$TIMESTAMP" "$AGENT_TYPE" "$AGENT_ID" "$COMMAND" >> "$LOG_FILE"

exit 0
