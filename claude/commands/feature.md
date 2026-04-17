---
description: Request a new feature or enhancement — routes directly to the constructive planning pipeline
---

INTENT: constructive

$ARGUMENTS

**Routing note for DM:** This message was submitted via the `/feature` command. The `INTENT: constructive` line above is an explicit routing signal. Per the Intent Override Block in Phase 1, skip the Investigative Gate entirely and proceed to the Intake Gate (which still evaluates whether Askmaw is needed or Pathfinder can be invoked directly). Strip the `INTENT: constructive` line before passing the task description to downstream agents.

Phase 0 (session-variable capture) and the Phase 1 Worktree Creation Subroutine both apply: Phase 0 captures session variables, and because `INTENT: constructive` is set, the Intent Override branch invokes the Worktree Creation Subroutine before proceeding to the Intake Gate. All other Phase 1 gates (Intake, Explore-Options, etc.) apply normally. Workflow flags (e.g., `--explore-options`) are unaffected by this override and continue to apply as documented.

If the task description above is empty (user provided no arguments), ask the user to describe the feature before proceeding.
