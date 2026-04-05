# Worktree Protocol — Shared Reference

This file defines the shared rules for how agents interpret and apply the `WORKING_DIRECTORY:` context block. All agents that receive this block must follow these rules. Role-specific additions are defined per-agent.

## The WORKING_DIRECTORY Context Block

When the Dungeon Master activates a session worktree, it prepends the following block to delegation prompts:

```
WORKING_DIRECTORY: /absolute/path/to/.worktrees/dm-slug
WORKTREE_BRANCH: feat/feature-name
All file operations and Bash commands must use this directory as the working root.
```

This block signals that all work for this task must be scoped to the specified directory. It is not a suggestion — it is a hard scope boundary.

## File Operation Rules

When `WORKING_DIRECTORY:` is present in the delegation prompt:

- **Scope all file operations to absolute paths under `{WORKING_DIRECTORY}`.** This applies to Read, Write, Edit, Grep, and Glob tool calls.
- **Never use relative paths.** Relative paths resolve against an unpredictable working directory and must not be used.
- **When `WORKING_DIRECTORY` is absent, behavior is unchanged** — operate in the main working tree as before.

## Bash Command Rules

- Always use absolute paths rooted in `{WORKING_DIRECTORY}`. Do not construct paths relative to an assumed current directory.
- Never use `cd ... &&` or any compound shell command to simulate a working directory change. This violates the Bash style rule defined in `claude/references/bash-style.md` and does not persist the CWD across separate Bash calls.
- For tools that resolve configuration relative to CWD, use the tool's own directory flag where available (e.g., `npm --prefix {WORKING_DIRECTORY} install`, `make -C {WORKING_DIRECTORY}`).
- If a tool has no CWD flag and cannot be invoked with an absolute path, surface the limitation rather than resorting to compound command chaining.

## Git Command Behavior

Git commands (commit, branch, status, diff, log) automatically operate on the worktree's branch when Bash is run within `{WORKING_DIRECTORY}`. No special handling is required — the worktree's branch is the active branch for the duration of the task.

## Role-Specific Additions

Each agent that receives the `WORKING_DIRECTORY:` block may define additional rules governing how the protocol applies to its specific responsibilities (e.g., where plan files are written, where documentation targets are set, how worktree creation is handled). Those additions are defined inline in each agent's definition and complement — but do not override — the shared rules above.
