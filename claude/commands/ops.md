---
description: Ask a question and save the advisory report to disk — routes to advisory workflow with --save-report
---

INTENT: advisory --save-report

$ARGUMENTS

**Routing note for DM:** This message was submitted via the `/ops` command. The `INTENT: advisory` line above is an explicit routing signal. Per the Intent Override Block in Phase 1, skip heuristic classification and enter the Advisory Workflow (Phases A-B-C) directly. Strip the `INTENT: advisory` line AND the `--save-report` flag before processing the question. The `--save-report` flag must be captured as an active workflow flag for this session before stripping.

No worktree creation or plan file applies — advisory sessions do not create worktrees or plans. Session variables (`SESSION_TS`, `SESSION_SLUG`) are still captured as lightweight memory. The `--save-report` flag is the only workflow flag applicable in advisory mode — it triggers report persistence after Phase C synthesis.

If the question above is empty (user provided no arguments), ask the user what they would like to know before proceeding.
