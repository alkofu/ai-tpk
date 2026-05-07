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

# SYNC: Keep this allowlist in sync with the Read(~/.claude/...) entries
# in allowedTools in claude/settings.json. Update both when adding or
# removing allowed Read paths.
# is_allowed_claude_read_path NORMALIZED_PATH
# Returns 0 (true) if the path is within an explicitly allowed ~/.claude/ subdirectory.
# Uses a narrow allowlist (not ~/.claude/**) to protect runtime state files from auto-read.
is_allowed_claude_read_path() {
  local p="$1"
  case "$p" in
    "$HOME/.claude/agents/"*) return 0 ;;
    "$HOME/.claude/skills/"*) return 0 ;;
    "$HOME/.claude/references/"*) return 0 ;;
    "$HOME/.claude/commands/"*) return 0 ;;
    "$HOME/.claude/hooks/"*) return 0 ;;
    "$HOME/.claude/wrappers/"*) return 0 ;;
    "$HOME/.claude/settings.json") return 0 ;;
    "$HOME/.claude/CLAUDE.md") return 0 ;;
    *) return 1 ;;
  esac
}

# --- Write/Edit/Read auto-approve: file path-based checks ---
# Write and Edit: auto-approve paths under ~/.ai-tpk/
# Read: auto-approve paths under allowed ~/.claude/ config subdirectories (see is_allowed_claude_read_path)
# Symlink escapes: Write/Edit cannot create symlinks; Read follows symlinks, so a
# symlink guard (readlink -f) is applied to Read's ~/.claude/ auto-approve path only.
# Write and Edit tool calls carry a plain file_path string, not a shell command.
# The Bash safety guards (dangerous keywords, git -c injection, etc.) do NOT apply here
# because file_path is never executed as a shell command.
# Symlink note: Write/Edit cannot create or follow symlinks — symlink escapes are
# not a threat for those tools. Read CAN follow symlinks, so the ~/.claude/ Read
# auto-approve block includes a dedicated symlink guard (see below).
if [ "$TOOL_NAME" = "Write" ] || [ "$TOOL_NAME" = "Edit" ] || [ "$TOOL_NAME" = "Read" ]; then
  FILE_PATH=$(echo "$STDIN_DATA" | jq -r '.tool_input.file_path // ""' 2>/dev/null)
  if [ -n "$FILE_PATH" ]; then
    # Expand ~ and $HOME to the actual home directory value (no realpath — it fails
    # on files that don't exist yet, and realpath -m is GNU-only, not available on macOS)
    NORMALIZED=$(printf '%s' "$FILE_PATH" | sed "s|^\$HOME|$HOME|")
    NORMALIZED=$(printf '%s' "$NORMALIZED" | sed "s|^~|$HOME|")

    # Path traversal guard: check for .. as a path component (NOT a raw substring match
    # to avoid false positives on filenames like "file..backup.md").
    # Matches: /.., /../, ../, and lone ..  but NOT "file..backup"
    if printf '%s' "$NORMALIZED" | grep -qE '(^|/)\.\.(\/|$)'; then
      # Traversal detected — fall through to normal permission dialog
      exit 0
    fi

    # Auto-approve if path targets ~/.ai-tpk/
    if printf '%s' "$NORMALIZED" | grep -q "^$HOME/.ai-tpk/"; then
      TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
      LOG_FILE="$HOME/.claude/permission-requests.log"
      AGENT_ID=$(echo "$STDIN_DATA" | jq -r '.agent_id // "none"' 2>/dev/null)
      AGENT_TYPE=$(echo "$STDIN_DATA" | jq -r '.agent_type // "none"' 2>/dev/null)
      LOG_LABEL="write_path"
      if [ "$TOOL_NAME" = "Read" ]; then LOG_LABEL="read_path"; fi
      printf '%s | agent_type=%s | agent_id=%s | [auto-approved] %s=%s\n' \
        "$TIMESTAMP" "$AGENT_TYPE" "$AGENT_ID" "$LOG_LABEL" "$NORMALIZED" >>"$LOG_FILE"
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

    # Auto-approve Read if path targets an allowed ~/.claude/ config subdirectory.
    # Symlink guard: resolve the symlink chain fully (readlink -f) and re-validate
    # the canonical target against the allowlist. This prevents symlinks planted under
    # ~/.claude/ from pointing outside the allowed prefixes.
    # Note: Write/Edit do not need this guard — they create new files and cannot follow
    # symlinks to exfiltrate data. Read follows symlinks, so the guard is Read-specific.
    if [ "$TOOL_NAME" = "Read" ] && is_allowed_claude_read_path "$NORMALIZED"; then
      # Symlink guard (Read only)
      if [ -L "$NORMALIZED" ]; then
        RESOLVED=$(readlink -f "$NORMALIZED" 2>/dev/null)
        if [ -z "$RESOLVED" ]; then
          exit 0 # readlink failed — fall through to manual approval
        fi
        if ! is_allowed_claude_read_path "$RESOLVED"; then
          exit 0 # Symlink target is outside allowed prefixes — fall through
        fi
      fi
      TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
      LOG_FILE="$HOME/.claude/permission-requests.log"
      AGENT_ID=$(echo "$STDIN_DATA" | jq -r '.agent_id // "none"' 2>/dev/null)
      AGENT_TYPE=$(echo "$STDIN_DATA" | jq -r '.agent_type // "none"' 2>/dev/null)
      printf '%s | agent_type=%s | agent_id=%s | [auto-approved] read_path=%s\n' \
        "$TIMESTAMP" "$AGENT_TYPE" "$AGENT_ID" "$NORMALIZED" >>"$LOG_FILE"
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
  # FILE_PATH empty or path not matched — fall through to normal permission dialog
  exit 0
fi

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
# Includes path-prefix-guarded entries for bash ~/.claude/scripts/*.sh — see corresponding allowedTools entries.
matches_allowed_tools() {
  local cmd="$1"
  case "$cmd" in
    git\ *) return 0 ;;
    gh\ pr\ *) return 0 ;;
    gh\ issue\ *) return 0 ;;
    gh\ run\ *) return 0 ;;
    gh\ repo\ view\ *) return 0 ;;
    gh\ repo\ clone\ *) return 0 ;;
    gh\ release\ view\ *) return 0 ;;
    gh\ auth\ switch\ *) return 0 ;;
    mkdir\ *) return 0 ;;
    rm\ *) return 0 ;;
    cp\ *) return 0 ;;
    mv\ *) return 0 ;;
    touch\ *) return 0 ;;
    ls\ *) return 0 ;;
    cd\ *) return 0 ;;
    npm\ *) return 0 ;;
    npx\ *) return 0 ;;
    pnpm\ *) return 0 ;;
    yarn\ *) return 0 ;;
    python\ *) return 0 ;;
    python3\ *) return 0 ;;
    bash\ /home/placeholder/.claude/scripts/*.sh)
      # Guard: reject path traversal (.. component)
      [[ "$cmd" == */../* || "$cmd" == */.. ]] && return 1
      # Guard: reject subdirectory paths (script must be directly under scripts/)
      local _rel
      _rel="${cmd#bash /home/placeholder/.claude/scripts/}"
      _rel="${_rel%% *}"
      [[ "$_rel" == */* ]] && return 1
      # Guard: resolve symlinks and verify canonical path stays under $HOME/.claude/scripts/
      local _script_path _real _rel_real
      _script_path="${cmd#bash }"
      _script_path="${_script_path%% *}"
      _script_path="${_script_path//\/home\/placeholder\//$HOME/}"
      _real="$(readlink -f "$_script_path" 2>/dev/null)" || return 1
      [[ "$_real" == "$HOME/.claude/scripts/"* ]] || return 1
      _rel_real="${_real#"$HOME"/.claude/scripts/}"
      [[ "$_rel_real" == */* ]] && return 1
      return 0
      ;;
    bash\ /home/placeholder/.claude/scripts/*.sh\ *)
      # Guard: reject path traversal (.. component)
      [[ "$cmd" == */../* || "$cmd" == */.. ]] && return 1
      # Guard: reject subdirectory paths (script must be directly under scripts/)
      local _rel
      _rel="${cmd#bash /home/placeholder/.claude/scripts/}"
      _rel="${_rel%% *}"
      [[ "$_rel" == */* ]] && return 1
      # Guard: resolve symlinks and verify canonical path stays under $HOME/.claude/scripts/
      local _script_path _real _rel_real
      _script_path="${cmd#bash }"
      _script_path="${_script_path%% *}"
      _script_path="${_script_path//\/home\/placeholder\//$HOME/}"
      _real="$(readlink -f "$_script_path" 2>/dev/null)" || return 1
      [[ "$_real" == "$HOME/.claude/scripts/"* ]] || return 1
      _rel_real="${_real#"$HOME"/.claude/scripts/}"
      [[ "$_rel_real" == */* ]] && return 1
      return 0
      ;;
    *\ --help) return 0 ;;
    *\ --version) return 0 ;;
    *) return 1 ;;
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
  # shellcheck disable=SC2016  # '$(' is a literal search pattern, not an expansion
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

# is_simple_expansion_only_except_one_redirect CMD_STRING
# A copy of is_simple_expansion_only that permits exactly one '>' redirect (the
# primary stdout redirect whose target has already been validated by is_jq_sidecar_write
# Phase D). All other dangerous constructs are still rejected: pipes, &&, ||, ;,
# $(...), backticks, <(...), >(...), >>, and any second >.
# Input: SECURITY_STRIPPED after stripping the closed-list trailing stderr fragment
# (i.e., the trailing ' 2>&1' or ' 2>/dev/null' has already been removed).
is_simple_expansion_only_except_one_redirect() {
  local cmd="$1"

  # Reject backtick command substitution
  if printf '%s' "$cmd" | grep -q '`'; then
    return 1
  fi

  # Reject $(...) command substitution
  # shellcheck disable=SC2016  # '$(' is a literal search pattern, not an expansion
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

  # Reject append redirections '>>' (must check before single-'>' count below)
  if printf '%s' "$cmd" | grep -qE '>>'; then
    return 1
  fi

  # Reject input redirections '<' that are not part of '<(' (already caught above)
  if printf '%s' "$cmd" | grep -qE '[0-9]*<[^(]'; then
    return 1
  fi
  # Also reject a trailing '<' at end of string
  if printf '%s' "$cmd" | grep -qE '[0-9]*<$'; then
    return 1
  fi

  # Count '>' characters (excluding '>>' which is already rejected above).
  # Exactly one '>' is permitted for the primary stdout redirect.
  # '2>' forms (other than the closed-list trailing fragments already stripped) are
  # caught here because '2>' still contains a '>' that adds to the count.
  local gt_count
  gt_count=$(printf '%s' "$cmd" | grep -oE '>' | wc -l | tr -d ' ')
  if [ "$gt_count" -ne 1 ]; then
    return 1
  fi

  # After removing simple expansions and tildes, remaining text should contain
  # no dollar signs (which would indicate complex expansions like ${var:-default},
  # ${var//pattern/replace}, $((arithmetic)), etc.)
  local neutralized
  neutralized=$(printf '%s' "$cmd" | sed -E 's/\$\{[A-Za-z_][A-Za-z0-9_]*\}//g')
  neutralized=$(printf '%s' "$neutralized" | sed -E 's/\$[A-Za-z_][A-Za-z0-9_]*//g')
  # Remove '$$' (shell PID literal) — agents use this as a filename suffix token
  # in the sidecar write pattern and it is safe (not an injection vector).
  neutralized=$(printf '%s' "$neutralized" | sed 's/\$\$//g')
  neutralized=$(printf '%s' "$neutralized" | sed 's/~//g')

  if printf '%s' "$neutralized" | grep -q '\$'; then
    return 1
  fi

  return 0
}

# SYNC: This auto-approve exception covers only the FIRST of three Bash calls
# produced by the canonical atomic sidecar-write recipe. The recipe is documented
# at:
#   - claude/commands/open-pr.md (sidecar update block)
#   - claude/references/worktree-creation-subroutine.md (sidecar write block)
# Both reference sites currently show the recipe as a single compound command
# of the form `jq … > "$TMP" && mv "$TMP" "$SIDECAR" || rm -f "$TMP"`. The
# compound-operator deny block earlier in this file (the `COMPOUND` / `is_compound`
# deny block — search for "Check for compound operators") denies that whole-line shape
# outright, so agents in practice split the recipe into THREE separate Bash calls:
#   1. jq … > "$TMP"             (matched by this exception)
#   2. mv "$TMP" "$SIDECAR"      (auto-approved via matches_allowed_tools: mv)
#   3. rm -f "$TMP"              (auto-approved via matches_allowed_tools: rm)
# If either reference site is reworked to remove the compound form, update this
# SYNC comment. The doc-debt of the compound-form recipe is recorded but not
# fixed in this plan.
#
# Follow-up (Riskmancer SG-7, low priority): add reciprocal SYNC comments at
# both reference sites pointing back to this hook helper. Tracked as documentation
# debt; not fixed in this plan.
is_jq_sidecar_write() {
  local cmd="$1"

  # --- Phase A: Pre-acceptance guards on the raw command (Riskmancer SG-1) ---

  # A.1: Reject if the raw command contains '$(' anywhere (command substitution).
  # This fires regardless of quoting, closing the bypass where '$()' is hidden inside
  # double quotes. There is no legitimate reason for a sidecar write to contain
  # command substitution — the alternative is remote code execution at shell-expansion time.
  # shellcheck disable=SC2016  # '$(' is a literal search pattern, not an expansion
  if printf '%s' "$cmd" | grep -qF '$('; then
    return 1
  fi

  # A.2: Reject if the raw command contains a backtick anywhere. Same rationale as A.1.
  if printf '%s' "$cmd" | grep -q '`'; then
    return 1
  fi

  # A.3: Reject if the redirect target is single-quoted. Strip the optional trailing
  # stderr redirect first, then find the substring after the last '>'. If the first
  # non-whitespace character of that substring is a single quote, reject. Production
  # sidecar writes always use double quotes; a single-quoted '$HOME' would not be
  # expanded by the shell — confused-deputy attack vector (Riskmancer SG-3).
  local cmd_no_trailing_stderr
  cmd_no_trailing_stderr=$(printf '%s' "$cmd" | sed 's/[[:space:]]\{1,\}2>&1$//; s/[[:space:]]\{1,\}2>\/dev\/null$//')
  local after_last_gt
  after_last_gt="${cmd_no_trailing_stderr##*>}"
  # Strip leading whitespace from the substring after '>'
  local first_nonws
  first_nonws=$(printf '%s' "$after_last_gt" | sed 's/^[[:space:]]*//')
  case "$first_nonws" in
    \'*) return 1 ;;
  esac

  # A.4: Reject '&>' (combined stdout+stderr redirect) and any numeric-fd redirect
  # like '1>' or '2>' EXCEPT the two closed-list trailing forms (' 2>&1' and
  # ' 2>/dev/null') already stripped into cmd_no_trailing_stderr above.
  # We test cmd_no_trailing_stderr (already stripped) so that legitimate trailing
  # '2>&1' and '2>/dev/null' forms do not trigger a false rejection.
  if printf '%s' "$cmd_no_trailing_stderr" | grep -qE '&>|[0-9]>'; then
    return 1
  fi

  # --- Phase B: Path extraction on the raw command ---
  # B.1 already done above (cmd_no_trailing_stderr). Closed list: only ' 2>&1' and
  # ' 2>/dev/null' are stripped — any other '2>' form is NOT stripped here.

  # B.2: Capture substring after the last '>' in the trailing-stripped command.
  local raw_target
  raw_target="${cmd_no_trailing_stderr##*>}"

  # B.3: Strip leading/trailing whitespace first (the substring after '>' typically
  # starts with a space before the opening '"').
  raw_target="${raw_target#"${raw_target%%[![:space:]]*}"}"
  raw_target="${raw_target%"${raw_target##*[![:space:]]}"}"

  # B.4: Strip surrounding double quotes (now that leading whitespace is gone,
  # the first character may be '"').
  raw_target="${raw_target#\"}"
  raw_target="${raw_target%\"}"

  # B.5: Expand $HOME and ~ to the actual home directory value.
  local expanded_target
  expanded_target=$(printf '%s' "$raw_target" | sed "s|^\$HOME|$HOME|")
  expanded_target=$(printf '%s' "$expanded_target" | sed "s|^~|$HOME|")

  # Phase D.0: Reject any '..' path component in the redirect target.
  # Mirrors the Write/Edit/Read traversal guard in this file — without it,
  # a target like ".../by-worktree/../../etc/foo.json.tmp" canonicalises
  # outside the sidecar directory and allows arbitrary-location writes.
  # The regex matches '..' as a path component (preceded by start-of-string
  # or '/', followed by end-of-string or '/'), while still permitting
  # filenames like 'file..backup.json.tmp'.
  if printf '%s' "$expanded_target" | grep -qE '(^|/)\.\.(/|$)'; then
    return 1
  fi

  # --- Phase C: Redirect-count guard on SECURITY_STRIPPED ---
  # Operate on the single-quote-stripped version of the command (SECURITY_STRIPPED is
  # computed outside this function; compute it locally here for the count check).
  local sec_stripped
  sec_stripped=$(printf '%s' "$cmd" | sed "s/'[^']*'//g")
  # Strip the trailing closed-list stderr fragment from the security-stripped string.
  local sec_no_trailing
  sec_no_trailing=$(printf '%s' "$sec_stripped" | sed 's/[[:space:]]\{1,\}2>&1$//; s/[[:space:]]\{1,\}2>\/dev\/null$//')
  # Count '>' characters in the result.
  local gt_count
  gt_count=$(printf '%s' "$sec_no_trailing" | grep -oE '>' | wc -l | tr -d ' ')
  # Reject if count is not exactly 1 (catches '>>', '> x > y', etc.)
  if [ "$gt_count" -ne 1 ]; then
    return 1
  fi

  # --- Phase D: Narrow shape and path checks ---

  # D.1: First whitespace-delimited token must be exactly 'jq'.
  local first_token
  first_token=$(printf '%s' "$cmd" | sed 's/[[:space:]].*//')
  if [ "$first_token" != "jq" ]; then
    return 1
  fi

  # D.2: Redirect target must begin with $HOME/.ai-tpk/session-context/by-worktree/
  case "$expanded_target" in
    "$HOME/.ai-tpk/session-context/by-worktree/"*) ;;
    *) return 1 ;;
  esac

  # D.3: Redirect target must end with a verified suffix shape:
  #   - bare '.json.tmp'
  #   - '.json.tmp.$$' (literal '$$' — hook sees pre-expansion string)
  #   - '.json.tmp.<token>' where <token> is [A-Za-z0-9_-]+
  # The regex \.json\.tmp(\.\$\$|\.[A-Za-z0-9_-]+)?$ covers all 7 observed shapes.
  # Note: grep -E on the expanded_target (which has already been trimmed of quotes).
  if ! printf '%s' "$expanded_target" | grep -qE '\.json\.tmp(\.\$\$|\.[A-Za-z0-9_-]+)?$'; then
    return 1
  fi

  # D.4: No compound operators or process substitution (covers pipes, &&, ||, ;,
  # newlines, <(, >( not already caught). Backticks and '$(' were rejected in Phase A.
  # We check against the security-stripped no-trailing-stderr form.
  if printf '%s' "$sec_no_trailing" | grep -q '&&'; then return 1; fi
  if printf '%s' "$sec_no_trailing" | grep -q ';'; then return 1; fi
  if printf '%s' "$sec_no_trailing" | grep -qF '<('; then return 1; fi
  if printf '%s' "$sec_no_trailing" | grep -qF '>('; then return 1; fi
  if printf '%s' "$sec_no_trailing" | grep -qE '\|[^|]'; then return 1; fi
  if printf '%s' "$sec_no_trailing" | grep -qE '[^|]\|$'; then return 1; fi

  # --- Phase E: Defence-in-depth via is_simple_expansion_only_except_one_redirect ---
  # Pass the security-stripped form with the trailing stderr fragment already removed.
  if ! is_simple_expansion_only_except_one_redirect "$sec_no_trailing"; then
    return 1
  fi

  return 0
}

# is_repo_slug_basename: matches the exact, intentionally narrow command shape
# `basename $(git rev-parse --show-toplevel)` after collapsing internal whitespace
# runs to single spaces. Internal-whitespace normalisation is defensive — no
# variants with double-spaces appear in the production log today, but the
# equality check is cheap to harden against future drift in agent definitions.
# Any other form of `basename $(…)` deliberately does NOT match — agents must
# reproduce this command character-for-character (modulo internal whitespace).
#
# SECURITY: Comparison MUST be byte-exact. Do not introduce locale-aware
# comparison, Unicode normalisation, or `iconv`-based pre-processing —
# homoglyph variants (e.g., Cyrillic `а` (U+0430) substituted for Latin `a`
# (U+0061)) must NOT be treated as matching. The `LC_ALL=C` pin on the `tr`
# call below makes the whitespace character class deterministic across locales;
# do not remove it.
is_repo_slug_basename() {
  local cmd="$1"
  # Strip leading whitespace
  cmd="${cmd#"${cmd%%[![:space:]]*}"}"
  # Strip trailing whitespace
  cmd="${cmd%"${cmd##*[![:space:]]}"}"
  # Collapse internal whitespace runs (spaces/tabs/etc.) to single spaces.
  # LC_ALL=C pins the character-class semantics so [:space:] is byte-defined
  # (POSIX whitespace only — space, tab, NL, VT, FF, CR) regardless of the
  # caller's locale. Do not remove the LC_ALL=C prefix.
  local normalised
  normalised=$(printf '%s' "$cmd" | LC_ALL=C tr -s '[:space:]' ' ')
  # Byte-exact equality. The RHS is single-quoted so the shell does not
  # expand $(...). [ "$a" = "$b" ] in POSIX shell is byte-exact comparison;
  # do not introduce iconv, normalisation, or locale-sensitive comparators
  # here — homoglyph variants must NOT match.
  # shellcheck disable=SC2016  # '$(' in RHS is intentionally literal — single quotes prevent expansion
  [ "$normalised" = 'basename $(git rev-parse --show-toplevel)' ]
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

# --- Auto-approve: Pattern 1 — jq sidecar write to session-context/by-worktree/ ---
# Narrowly matches the atomic `jq … > "$TMP"` sidecar-write step used by Bitsmith.
# This exception is checked AFTER the compound-operator and --no-verify deny blocks
# so those denies still win for compound shapes. See is_jq_sidecar_write for the
# full five-phase guard sequence (A: pre-acceptance, B: path extraction,
# C: redirect-count guard, D: shape/path match, E: structural defence-in-depth).
if is_jq_sidecar_write "$COMMAND"; then
  TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  LOG_FILE="$HOME/.claude/permission-requests.log"
  printf '%s | agent_type=%s | agent_id=%s | [auto-approved] command=%s\n' \
    "$TIMESTAMP" "$AGENT_TYPE" "$AGENT_ID" "$COMMAND" >>"$LOG_FILE"
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

# --- Auto-approve: Pattern 2 — basename $(git rev-parse --show-toplevel) ---
# Narrowly matches the exact command used by Dungeonmaster to derive the repo slug.
# This exception is checked AFTER the compound-operator and --no-verify deny blocks.
# See is_repo_slug_basename for the byte-exact equality check with LC_ALL=C
# whitespace normalisation and the SECURITY comment forbidding Unicode normalisation.
if is_repo_slug_basename "$COMMAND"; then
  TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  LOG_FILE="$HOME/.claude/permission-requests.log"
  printf '%s | agent_type=%s | agent_id=%s | [auto-approved] command=%s\n' \
    "$TIMESTAMP" "$AGENT_TYPE" "$AGENT_ID" "$COMMAND" >>"$LOG_FILE"
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
      "$TIMESTAMP" "$AGENT_TYPE" "$AGENT_ID" "$COMMAND" >>"$LOG_FILE"
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
  "$TIMESTAMP" "$AGENT_TYPE" "$AGENT_ID" "$COMMAND" >>"$LOG_FILE"

exit 0
