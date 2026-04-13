<!-- Managed by ai-tpk. Do not edit directly; changes will be overwritten by install.sh -->

# User-Global Claude Code Instructions

These instructions are loaded by Claude Code at session start for every project.

## Mandatory Skills

### Commit Message Guide

ALL git commits must follow the `commit-message-guide` skill. Conventional commit format is required, no exceptions.

### Open Pull Request

ALL pull requests and merge requests must be created using the `open-pull-request` skill. No other PR creation method is allowed.

### Validate Before PR

The `validate-before-pr` skill MUST be invoked before any PR creation. It runs lint and format checks as a mandatory gate. Only after both checks pass may the `open-pull-request` skill be invoked. No exceptions.

## Bash Command Style

- Never chain commands using `&&` or `;`, and never use process substitution (`<(...)` / `>(...)`). Pipes (`|`) are permitted only for data transformation — see `claude/references/bash-style.md` for full guidance.
- Always issue each command as a separate, standalone Bash call.
