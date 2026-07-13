---
description: DM-direct, read-only session status glance — reports the current session's worktree, branch, issue, PR, plan, and phase, plus a summary of commits since the default branch. Requires warm conversation memory (populated by an in-progress session or a prior /resume-session in the same window); otherwise refuses and points to /resume-session.
---

INTENT: brief

**Routing note for DM:** This message was submitted via the `/brief` command. Strip the `INTENT: brief` line before processing. `/brief` takes no arguments.

This is a guard-clause-then-report command: DM first checks whether it has an active session in its own conversation memory. If there is no active session in memory, DM refuses and points the user to `/resume-session` — no sidecar read, no scan, no partial derivation. If there is an active session in memory, DM composes and prints a two-section status report (a status glance and an implementation summary) directly from its own conversation memory and a small set of read-only git probes, then ends the turn without starting or continuing any planning, review, or implementation workflow.

See the `INTENT: brief` branch of the Intent Override block in DM's operating procedure for the full guard-clause-then-report behavior, exact field sourcing, and exact wording of the refusal and report sections.
