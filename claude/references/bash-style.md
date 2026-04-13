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

## Rationale

Compound commands:
- Require interactive user approval as a single opaque block
- Make it harder to diagnose which step failed
- Violate the project-wide style rule defined in `CLAUDE.md`

Process substitution additionally:
- Spawns subshells that each trigger a separate Claude Code permission request
- Cannot be split within a single command — requires rewriting with temp files

## Applies To

All agents with Bash tool access: Bitsmith, Dungeonmaster, Knotcutter, Pathfinder, Quill, Riskmancer, Ruinor, Tracebloom, Truthhammer, Windwarden.
