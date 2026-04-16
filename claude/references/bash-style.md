# Bash Style — Shared Reference

This file defines the required Bash command style for all agents. It is the authoritative source for this rule. Agents that use the Bash tool must follow these rules without exception.

## Rule: No Compound Commands

Never chain commands using `&&` or `;` as sequential execution operators. Always issue each command as a separate, standalone Bash call.

**Enforcement:** This rule is enforced automatically by the `PermissionRequest` hook (`permission-learn.sh`) in `claude/settings.json`. Any compound Bash command will be denied at the permission stage with a clear error message directing you to split the command into separate calls.

Pipes (`|`) are permitted **only for data transformation** (feeding the output of one command into a filter). Do not use pipes as a substitute for sequential control flow.

**Wrong — sequential chaining:**
```bash
mkdir -p foo && cd foo && git init
```

**Right:** Three separate Bash calls:
1. `mkdir -p foo`
2. `cd foo`
3. `git init`

**Wrong — pipe as control flow:**
```bash
git stash && git pull | grep "Already up to date"
```

**Right:** Separate calls; use tool-native flags where possible:
1. `git stash`
2. `git pull`
3. `git log --oneline -5`  ← prefer `-5` flag over `git log | head -5`

**Acceptable — pipe for data transformation (no tool-native alternative):**
```bash
grep "ERROR" app.log | wc -l
```

## Rule: No Process Substitution

Never use process substitution (`<(cmd)` or `>(cmd)`). Each substitution spawns a subshell that Claude Code treats as a separate command, triggering an additional permission request per substitution. Use temporary files instead.

**Enforcement:** This rule is enforced automatically by the `PermissionRequest` hook (`permission-learn.sh`). Any command containing `<(` or `>(` outside of quoted strings will be denied.

**Wrong — process substitution:**
```bash
diff <(sort file1.txt) <(sort file2.txt)
```

**Right:** Three separate Bash calls using temp files:
1. `sort file1.txt > /tmp/sorted1.txt`
2. `sort file2.txt > /tmp/sorted2.txt`
3. `diff /tmp/sorted1.txt /tmp/sorted2.txt`

**Wrong — output process substitution:**
```bash
tee >(grep ERROR > errors.log) < app.log
```

**Right:** Two separate Bash calls:
1. `cp app.log /tmp/app-copy.log`
2. `grep ERROR /tmp/app-copy.log > errors.log`

## Rule: No `--no-verify` on Git Commands

Do not use `git commit --no-verify`, `git commit -n`, or `git push --no-verify`. These flags bypass pre-commit hooks and disable safety checks (lint, secrets scanning, message format validation).

**Enforcement:** `permission-learn.sh` (PermissionRequest hook) denies these commands before execution.

If a pre-commit or pre-push hook fails, investigate and fix the underlying issue rather than bypassing it.

## Rule: No Command Substitution in Git Commits

Never use command substitution (`$(...)`) or heredoc-based temp-file patterns in `git commit` commands. Both patterns trigger permission dialogs that break unattended agent operation.

Use multiple `-m` flags on a single `git commit` command instead. Git allows `-m` to be repeated; each value becomes a separate paragraph (separated by a blank line in the resulting message).

**Enforcement:** `permission-learn.sh` Guard 5 (`is_simple_expansion_only`) blocks auto-approval for any command containing `$(`. The command falls through to the interactive permission dialog instead of being auto-approved. (This is not a hard deny -- the dialog still allows manual approval, but it breaks unattended operation.)

**Wrong -- command substitution in commit:**
```bash
git commit -m "$(cat <<'EOF'
feat(api): add batch endpoint

Implements batch processing for bulk operations.
EOF
)"
```

**Wrong -- heredoc temp-file pattern (also triggers permission dialogs):**
```bash
cat > /tmp/claude-commit-msg.txt <<'EOF'
feat(api): add batch endpoint

Implements batch processing for bulk operations.
EOF
```
```bash
git commit -F /tmp/claude-commit-msg.txt
```

The temp-file approach fails for three reasons: `cat` is not in the auto-approve allowlist, `>` redirection fails Guard 5, and the multi-line heredoc body triggers the compound-command hard deny (newline count > 0).

**Right -- multiple `-m` flags (subject only):**
```bash
git commit -m "feat(api): add batch endpoint"
```

**Right -- multiple `-m` flags (subject + body):**
```bash
git commit -m "feat(api): add batch endpoint" -m "Implements batch processing for bulk operations."
```

**Right -- multiple `-m` flags (subject + body + footer):**
```bash
git commit -m "feat(api): add batch endpoint" -m "Implements batch processing for bulk operations." -m "BREAKING CHANGE: removes legacy single-item endpoint"
```

## Rationale

Compound commands:
- Require interactive user approval as a single opaque block
- Make it harder to diagnose which step failed
- Violate the project-wide style rule defined in `CLAUDE.md`

Process substitution additionally:
- Spawns subshells that each trigger a separate Claude Code permission request
- Cannot be split within a single command — requires rewriting with temp files

Skipping hooks (`--no-verify`):
- Masks real issues such as lint failures, secrets in commits, or malformed messages
- Leads to commits that violate project standards and are harder to audit or revert

Command substitution in git commits:
- The `$(cat <<'EOF'...)` pattern contains `$(` which blocks auto-approval in `permission-learn.sh`, triggering a manual permission dialog on every commit
- The temp-file heredoc alternative (`cat > /tmp/... <<'EOF'` + `git commit -F`) fails multiple guards: `cat` is not in the allowlist, `>` fails Guard 5, and multi-line heredocs trigger the compound-command hard deny
- Multiple `-m` flags on a single `git commit` command achieve the same result while passing all auto-approval guards

## Applies To

All agents with Bash tool access: Bitsmith, Dungeonmaster, Knotcutter, Pathfinder, Quill, Riskmancer, Ruinor, Tracebloom, Truthhammer, Windwarden.
