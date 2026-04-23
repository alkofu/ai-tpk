---
description: Report a bug or investigate unexpected behavior — routes directly to Tracebloom (Investigative Gate)
---

INTENT: investigative

$ARGUMENTS

**Routing note for DM:** This message was submitted via the `/bug` command. The `INTENT: investigative` line above is an explicit routing signal. Per the Intent Override Block in Phase 1, skip heuristic classification and fire the Investigative Gate (Tracebloom) directly. Strip the `INTENT: investigative` line before passing the task description to downstream agents.

Phase 0 (session-variable capture) applies as documented. The Phase 1 Worktree Creation Subroutine is **deferred** in the investigative pipeline: because `INTENT: investigative` is set, the Intent Override branch fires the Investigative Gate immediately (Tracebloom runs first, with the main repository root as its working directory). The Worktree Creation Subroutine is invoked later — after the user confirms the Premise Check (Pathfinder branch) or immediately before Bitsmith delegation (trivial-fix branch) — and is skipped entirely when the report is 'Inconclusive' (and the user does not choose to proceed) or 'No bug found.' All other Phase 1 gates apply normally. Workflow flags (e.g., `--explore-options`) are unaffected by this override and continue to apply as documented.

If the task description above is empty (user provided no arguments), ask the user to describe the bug before proceeding.
