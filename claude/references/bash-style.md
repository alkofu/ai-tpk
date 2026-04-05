# Bash Style — Shared Reference

This file defines the required Bash command style for all agents. It is the authoritative source for this rule. Agents that use the Bash tool must follow these rules without exception.

## Rule: No Compound Commands

Never chain commands using `&&`, `;`, or `|`. Always issue each command as a separate, standalone Bash call.

**Wrong:**
```bash
mkdir -p foo && cd foo && git init
```

**Right:** Three separate Bash calls:
1. `mkdir -p foo`
2. `cd foo`
3. `git init`

## Rationale

Compound commands:
- Require interactive user approval as a single opaque block
- Make it harder to diagnose which step failed
- Violate the project-wide style rule defined in `CLAUDE.md`

## Applies To

All agents with Bash tool access: Ruinor, Riskmancer, Windwarden, Knotcutter, Truthhammer, Quill, Pathfinder, Bitsmith, Dungeonmaster.
