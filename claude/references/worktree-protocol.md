# Worktree Protocol — Shared Reference

This file defines the shared rules for how agents interpret and apply the `WORKING_DIRECTORY:` context block. All agents that receive this block must follow these rules. Role-specific additions are defined per-agent.

## Agent Activation Rule

When a delegation prompt contains a `WORKING_DIRECTORY:` context line, agents must read this file immediately and apply its rules for the remainder of the task. Agent-specific worktree rules are defined inline in each agent's definition.

## The WORKING_DIRECTORY Context Block

When the Dungeon Master activates a session worktree, it prepends the following block to delegation prompts:

```
WORKING_DIRECTORY: /absolute/path/to/.worktrees/dm-slug
WORKTREE_BRANCH: feat/feature-name
REPO_SLUG: {repo-name}
All file operations and Bash commands must use this directory as the working root.
```

Bitsmith delegations also receive a fifth line: `EXPECTED_TREE_STATE: clean` or `EXPECTED_TREE_STATE: dirty-continuing` (see the `EXPECTED_TREE_STATE` section below for valid values, the absence-default rule, and cross-references).

`EXPECTED_TREE_STATE:` is a sibling field that may appear in the block on Bitsmith delegations only. Valid values are `clean` (the worktree is expected to have no uncommitted changes per `git status --porcelain`) and `dirty-continuing` (the worktree contains changes from a prior in-session Bitsmith delegation; the audit is skipped). When the field is absent but `WORKING_DIRECTORY` is present, Bitsmith defaults to `clean`. Bitsmith trims leading/trailing whitespace from the value before comparison. Comparison is case-sensitive — only the literal lowercase strings `clean` and `dirty-continuing` are accepted; any other variant (including `Clean`, `CLEAN`, quoted forms, or embedded whitespace) is treated as malformed and triggers a halt. DM is responsible for emitting bare lowercase tokens. This field is used only by Bitsmith. Other agents that receive the Worktree Context Block ignore it. See `claude/agents/bitsmith.md` § Working-Tree Audit for the full check semantics (including the structured halt-report format, which begins with the recognizable header `## Working-Tree Audit Halt`), and `claude/agents/dungeonmaster.md` § EXPECTED_TREE_STATE Choice Rule for when DM emits each value.

This block signals that all work for this task must be scoped to the specified directory. It is not a suggestion — it is a hard scope boundary.

## File Operation Rules

When `WORKING_DIRECTORY:` is present in the delegation prompt:

- **Scope all file operations to absolute paths under `{WORKING_DIRECTORY}`.** This applies to Read, Write, Edit, Grep, and Glob tool calls.
- **Never use relative paths.** Relative paths resolve against an unpredictable working directory and must not be used.
- **When `WORKING_DIRECTORY` is absent, behavior is unchanged** — operate in the main working tree as before.

## Bash Command Rules

- Always use absolute paths rooted in `{WORKING_DIRECTORY}`. Do not construct paths relative to an assumed current directory.
- Never use `cd ... &&` or any compound shell command to simulate a working directory change. This violates the Bash style rule defined in `claude/references/bash-style.md` and does not persist the CWD across separate Bash calls.
- For tools that resolve configuration relative to CWD, use the tool's own directory flag where available (e.g., `pnpm --dir {WORKING_DIRECTORY} install`, `make -C {WORKING_DIRECTORY}`).
- If a tool has no CWD flag and cannot be invoked with an absolute path, surface the limitation rather than resorting to compound command chaining.

## Git Command Behavior

Git commands (commit, branch, status, diff, log) automatically operate on the worktree's branch when Bash is run within `{WORKING_DIRECTORY}`. No special handling is required — the worktree's branch is the active branch for the duration of the task.

## Role-Specific Additions

Each agent that receives the `WORKING_DIRECTORY:` block may define additional rules governing how the protocol applies to its specific responsibilities (e.g., where plan files are written, where documentation targets are set, how worktree creation is handled). Those additions are defined inline in each agent's definition and complement — but do not override — the shared rules above.

## Agents Not Affected by Worktree Isolation

Talekeeper is unaffected by worktree isolation. It writes to gitignored session logs (not to the working tree) and is user-invoked only.
