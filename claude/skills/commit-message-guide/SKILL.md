---
name: commit-message-guide
description: Guide for creating well-structured conventional commits. Use when creating git commits, drafting commit messages, or reviewing commit message quality.
---

# Commit Message Guide

This skill ensures commit messages follow conventional commit format with command tense and concise, meaningful content.

## Commit Message Structure

### Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Type

Use one of these conventional commit types:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `test`: Adding or updating tests
- `docs`: Documentation changes
- `build`: Build system or dependency changes
- `ci`: CI/CD configuration changes
- `chore`: Other changes that don't modify src or test files

### Scope (optional)

The scope provides context about what area of the codebase is affected. Use appropriate scope for the module/component being changed, e.g.:
- `api`, `auth`, `db`, `ui`, `config`, `cli`, `core`

### Subject

- Use **command tense** (imperative mood): "Add feature" not "Added feature" or "Adds feature"
- Keep it concise (50 characters or less ideally, 72 max)
- No period at the end
- Lowercase after the type prefix

Examples:
- `feat(api): add support for batch operations`
- `fix(auth): handle expired token refresh`
- `refactor(db): simplify query builder logic`

Bad examples:
- `feat(api): Added support for batch operations` (wrong tense)
- `Fixed a bug in auth` (missing type/scope, wrong tense)

## Body Guidelines

**Only include a body when the title and file changes alone cannot reasonably convey the reason for the commit.**

### What to Include

- **Why** the change was made (if not obvious)
- **Architectural decisions** and their rationale
- **Trade-offs** considered
- **Context** that won't be visible from the diff

### What to Exclude

- Information visible on GitHub (files changed, lines added/removed, diff stats)
- Test status information ("All tests pass")
- Time-related information (estimates, time spent)
- Obvious information (implementation details visible in the diff)
- AI authorship or attribution (no "Generated with Claude Code", Co-Authored-By tags, emojis, or tool attribution)

### Example Good Bodies

```
feat(api): add support for webhook callbacks

Implements webhook delivery for event notifications.
Uses a retry queue with exponential backoff to handle
transient failures without losing events.
```

```
refactor(db): restructure query parser

Reorganizes query parsing to use a table-driven approach
instead of a large switch statement. This makes it easier
to add new query types and reduces code duplication.
```

### Example Bad Bodies

```
fix(auth): correct token expiry handling

Changes 3 files with 45 additions and 12 deletions.
All tests pass.
This fix took longer than expected, about 2 days.
```

## Special Commit Types

### WIP Commits

```
WIP: debugging race condition in scheduler
```

These don't need to follow strict formatting and may have failing tests.

### FIXUP Commits

```
fixup! feat(api): add support for webhook callbacks
```

Created with `git commit --fixup=<commit-hash>` for automatic squashing during rebase.

## Pre-Commit Checklist

Before creating a commit, verify:

- [ ] **GitHub account**: Verified per the account probe in `claude/references/github-auth-probe.md` (extract `{owner}/{repo}`, probe with `gh api`, switch accounts if needed)
- [ ] Code builds successfully
- [ ] All tests pass
- [ ] Code is formatted (run formatter)
- [ ] Code is linted (if applicable)
- [ ] Commit type is appropriate
- [ ] Subject uses command tense
- [ ] Subject is concise and clear
- [ ] Body (if present) adds value beyond the diff
- [ ] Body doesn't include GitHub-visible information
- [ ] Body doesn't include test status or time estimates
- [ ] No AI attribution, co-author tags, or tool attribution

**Exception**: WIP or FIXUP commits may skip these requirements.

## Examples

### Minimal Commit (No Body Needed)

```
feat(ui): add variable binding display command
```

The title clearly describes what was added. The diff will show the implementation.

### Commit with Useful Body

```
perf(core): optimize instruction dispatch loop

Replace computed goto with direct threaded code. This
reduces dispatch overhead by eliminating one memory
indirection per instruction. Trade-off is slightly
larger binary size due to code duplication.
```

### Commit with Unnecessary Body

```
fix(db): handle empty name table

Modified src/db.zig to add a check for empty tables.
Updated tests to cover this edge case. All 47 tests pass.
This was a quick fix, only took about an hour.
```

None of this information adds value.

## When Creating Commits

1. **Draft the commit message** following this guide
2. **Show the draft** to the user before committing
3. **Ask for feedback** if the commit is complex or touches multiple concerns
4. **Ensure the body adds value** - when in doubt, omit the body
5. **Include only relevant context** in the body
6. **NEVER add AI attribution** - no tool attribution of any kind
7. **Use multiple `-m` flags for commits** -- never use `$(...)` or heredoc patterns in git commit commands:
   - Subject only: `git commit -m "type(scope): subject"`
   - Subject + body: `git commit -m "type(scope): subject" -m "Body paragraph."`
   - Subject + body + footer: `git commit -m "type(scope): subject" -m "Body paragraph." -m "BREAKING CHANGE: description"`
