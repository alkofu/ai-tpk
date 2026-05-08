---
description: Resume an in-progress worktree session from a cold-start Claude Code window — accepts a PR/issue number, URL, or worktree slug.
---

INTENT: resume-session $ARGUMENTS

**Routing note for DM:** This message was submitted via the `/resume-session` command. `$ARGUMENTS` should contain exactly one of the following: a bare PR number (e.g. `42`), a PR URL (`https://github.com/<owner>/<repo>/pull/42`), a bare GitHub issue number (e.g. `42`), a GitHub issue URL (`https://github.com/<owner>/<repo>/issues/42`), or a worktree name/slug (e.g. `add-oauth-login`). DM resolves the argument via the Resume Subroutine defined in `claude/agents/dungeonmaster.md`. Strip the `INTENT: resume-session` line before processing.

If `$ARGUMENTS` is empty or whitespace-only, ask the user to provide one of the accepted argument forms (PR number, PR URL, GitHub issue number, GitHub issue URL, or worktree slug) before proceeding. Do not invoke the Resume Subroutine.
