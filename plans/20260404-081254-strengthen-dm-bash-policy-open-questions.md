# Open Questions — strengthen-dm-bash-policy

This file tracks reservations from ACCEPT-WITH-RESERVATIONS reviewer verdicts for this plan.

## Review Reservations - 2026-04-04

### F-1 (MAJOR) — Slash command files still contain direct write instructions

**Reviewer:** Ruinor  
**Verdict:** ACCEPT-WITH-RESERVATIONS

The DM system prompt now says "delegate slash command write operations to Bitsmith," but the slash command files themselves (`clean-the-desk.md`, `sync-pr.md`) still contain direct imperative "Run:" instructions for write operations (e.g., `git worktree remove --force`, `git branch -D`, `git push --force-with-lease`, `git rebase`). This creates a two-sided contradiction: one side (DM system prompt) says delegate; the other side (slash command files) says execute directly.

**Options to resolve:**
- (a) Update slash command files to explicitly note that write steps should be delegated to Bitsmith
- (b) Add a stronger explicit precedence rule to the DM system prompt stating the delegation policy takes precedence over slash command imperative instructions

Option (a) is the cleaner fix as it eliminates the contradiction at the source.
