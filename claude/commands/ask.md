---
description: Ask a question about the codebase, architecture, or approach — lightweight Q&A with no planning or implementation
---

INTENT: advisory

$ARGUMENTS

**Routing note for DM:** This message was submitted via the `/ask` command. The `INTENT: advisory` line above is an explicit routing signal. Per the Intent Override Block in Phase 1, skip heuristic classification and enter the Advisory Workflow (Phases A-B-C) directly. Strip the `INTENT: advisory` line before processing the question.

No worktree creation or plan file applies — advisory sessions do not create worktrees or plans. Session variables (`SESSION_TS`, `SESSION_SLUG`) are still captured as lightweight memory. Workflow flags (e.g., `--explore-options`) are not applicable in advisory mode — `--explore-options` is a constructive-pipeline flag.

If the question above is empty (user provided no arguments), ask the user what they would like to know before proceeding.
