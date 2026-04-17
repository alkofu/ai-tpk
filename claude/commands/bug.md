---
description: Report a bug or investigate unexpected behavior — routes directly to Tracebloom (Investigative Gate)
---

INTENT: investigative

$ARGUMENTS

**Routing note for DM:** This message was submitted via the `/bug` command. The `INTENT: investigative` line above is an explicit routing signal. Per the Intent Override Block in Phase 1, skip heuristic classification and fire the Investigative Gate (Tracebloom) directly. Strip the `INTENT: investigative` line before passing the task description to downstream agents.

Phase 0 (session-variable capture) and the Phase 1 Worktree Creation Subroutine both apply: Phase 0 captures session variables, and because `INTENT: investigative` is set, the Intent Override branch invokes the Worktree Creation Subroutine before firing the Investigative Gate. All other Phase 1 gates apply normally. Workflow flags (e.g., `--explore-options`) are unaffected by this override and continue to apply as documented.

If the task description above is empty (user provided no arguments), ask the user to describe the bug before proceeding.
