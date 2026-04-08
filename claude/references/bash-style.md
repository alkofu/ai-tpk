# Bash Style — Shared Reference

This file defines the required Bash command style for all agents. It is the authoritative source for this rule. Agents that use the Bash tool must follow these rules without exception.

## Rule: No Compound Commands

Never chain commands using `&&` or `;` as sequential execution operators. Always issue each command as a separate, standalone Bash call.

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

## Rationale

Compound commands:
- Require interactive user approval as a single opaque block
- Make it harder to diagnose which step failed
- Violate the project-wide style rule defined in `CLAUDE.md`

## Applies To

All agents with Bash tool access: Bitsmith, Dungeonmaster, Knotcutter, Pathfinder, Quill, Riskmancer, Ruinor, Tracebloom, Truthhammer, Windwarden.
