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

All Bash tool usage is governed by `claude/references/bash-style.md`. The rules there are mandatory and enforced by the `permission-learn.sh` PermissionRequest hook in `claude/settings.json`. Read that reference before issuing any Bash command.

## Think Before Coding

- When an instruction is ambiguous, present the plausible interpretations and ask which one is intended. Do not silently pick one.
- Before starting work, surface any non-obvious assumptions you are making so the user can correct them.
- If a simpler approach exists than what was requested, say so before proceeding.
- When you are confused or lack sufficient context, stop and ask. Do not guess.
