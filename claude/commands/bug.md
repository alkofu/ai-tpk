---
description: Report a bug or investigate unexpected behavior — routes directly to Tracebloom (Investigative Gate)
---

INTENT: investigative

$ARGUMENTS

**Routing note for DM:** This message was submitted via the `/bug` command. The `INTENT: investigative` line above is an explicit routing signal. Per the Intent Override Block in Phase 1, skip heuristic classification and fire the Investigative Gate (Tracebloom) directly. Strip the `INTENT: investigative` line before passing the task description to downstream agents.

All standard Phase 0 steps (worktree creation, session variables) still apply. Workflow flags (e.g., `--explore-options`) are unaffected by this override and continue to apply as documented.

If the task description above is empty (user provided no arguments), ask the user to describe the bug before proceeding.
