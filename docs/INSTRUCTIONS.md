# Instructions: User-Global vs. Project-Level

This document explains how Claude Code loads instructions at two levels in this repository: user-global (applied across all projects) and project-level (applied only to this repository).

## User-Global Instructions (claude/CLAUDE.md)

`claude/CLAUDE.md` is installed to `~/.claude/CLAUDE.md` by the installer and loaded by Claude Code at session start for every project. It contains two types of global constraints:

**Mandatory skills** — three skills that apply globally across all work:

- **`commit-message-guide`** — required for all git commits; conventional commit format is enforced, no exceptions
- **`open-pull-request`** — required for all pull requests and merge requests; no other PR creation method is allowed
- **`validate-before-pr`** — runs lint and format checks as a mandatory gate before PR creation; must pass before open-pull-request can be invoked

**Behavioral constraints** — directives that govern how Claude Code behaves before and during execution:

- **Bash Command Style** — mandatory rules for all Bash tool usage; full details in `claude/references/bash-style.md`
- **Think Before Coding** — requires surfacing ambiguous interpretations before acting, disclosing non-obvious assumptions, proposing simpler alternatives when they exist, and stopping to ask rather than guessing when context is insufficient

## Project-Level Instructions (.claude/CLAUDE.md)

`.claude/CLAUDE.md` is loaded by Claude Code only in this repository. It provides project-scoped instructions that override or supplement user-global directives.

**This repository's project-level guard:** Before creating or modifying agents, skills, commands, hooks, references, CLAUDE.md, or settings, you must clarify which scope is intended:
- **User scope** (`claude/`) — applied globally across all repositories
- **Project scope** (`.claude/`) — applied only to this repository

**Project Constitution:** `.claude/CLAUDE.md` carries a `## Project Constitution` section pointing to `.claude/constitution.md` as the canonical source of the repo's invariant principles — including the principle definitions, severity rules, and the full enumeration of how these principles are enforced.

See `.claude/CLAUDE.md` for the full scope clarification rules, trigger cases, and constitution summary.

**Note:** Skill mandate enforcement depends on Claude Code's instruction precedence behavior. Project-level mandates are intended to supplement, not override, user-level mandates.
