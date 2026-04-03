# Open Questions — fix-bitsmith-escalation-routing

This file tracks reservations from ACCEPT-WITH-RESERVATIONS reviewer verdicts for this plan.

## Review Reservations - 2026-04-03

### R-1 (MINOR) — Frontmatter omits immediate escalation path
- **File:** `claude/agents/bitsmith.md`, line 3 (frontmatter description)
- **Issue:** Frontmatter says "Escalates to Dungeon Master after 3 failed attempts" but the body also defines an immediate escalation path (without waiting for 3 attempts). The frontmatter is slightly misleading.
- **Recommendation:** Consider updating frontmatter to "Escalates to Dungeon Master on failure" to be more inclusive of both escalation paths.

### R-2 (MINOR) — No retry limit on DM "retry with guidance" action
- **File:** `claude/agents/dungeonmaster.md`, Phase 3 escalation handling, action 4c
- **Issue:** The "Retry with guidance" action says it counts as a new execution attempt but does not specify how this interacts with Bitsmith's 3-attempt cap. A DM-retry-with-guidance loop could theoretically repeat indefinitely.
- **Recommendation:** Add a note such as: "If Bitsmith escalates again after a retry-with-guidance attempt, prefer Replan or Abort over further retries."
