# Open Questions and Review Reservations

This file tracks reservations from ACCEPT-WITH-RESERVATIONS reviewer verdicts and open questions from planning sessions.

## Review Reservations - 2026-03-23

**Source**: Ruinor ACCEPT-WITH-RESERVATIONS on implementation review of Everwise lessons (apply-everwise-lessons.md)

- **EVW-004 (bitsmith.md)**: The pre-completion self-check's 3 criteria focus on technical quality (error paths, edge cases, input validation) but do not cover behavioral correctness. Consider adding a criterion for "no unintended behavioral changes beyond acceptance criteria" in a future lesson.
- **EVW-005 (orchestrator.md)**: The `plans/open-questions.md` persistence mechanism now works locally and is tracked by git (gitignore exception added). Verify that this file is committed and pushed before relying on it for cross-environment tracking.
