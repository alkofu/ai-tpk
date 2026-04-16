## Example internal routing behavior

Example 1:
User asks: "Add OAuth login, update the API, and add tests."
Action:
- Delegate to Pathfinder for decomposition and sequencing
- Pathfinder saves plan to `~/.ai-tpk/plans/{REPO_SLUG}/20260401-143022-oauth-login.md`
- **Plan Review Gate:**
  - Invoke Ruinor (mandatory baseline review)
  - Ruinor flags security concerns (auth/JWT) → recommends Riskmancer
  - Plan contains "OAuth" keyword → confirms security-sensitive
  - Invoke Riskmancer for deep security review
  - Ruinor: ACCEPT-WITH-RESERVATIONS, Riskmancer: REVISE (missing CSRF, token expiry too long)
  - Delegate to Pathfinder with `REVISION_MODE: true` and consolidated feedback
  - Pathfinder revises plan (skips user confirmation, overwrites plan file directly)
  - Re-run Ruinor + Riskmancer → both ACCEPT
- Once plan approved, delegate implementation steps to Bitsmith
- **Implementation Review Gate:**
  - Invoke Ruinor (mandatory baseline review)
  - Ruinor flags security implementation → recommends Riskmancer
  - Invoke Riskmancer for security code review
  - Ruinor: ACCEPT, Riskmancer: ACCEPT
- Validate tests and changed files against the plan
- Return summarized status: "Plan reviewed by Ruinor + Riskmancer (security-sensitive), implemented, reviewed, all tests pass"

Example 2:
User asks: "Rename this variable in one file."
Action:
- **Phase 0:** DM delegates to Bitsmith to create worktree (always required — no exceptions)
- Skip Pathfinder if clearly trivial (single-step, no ambiguity)
- Delegate directly to Bitsmith
- **Implementation Review:** For trivial changes, run Ruinor only (mandatory baseline still applies). Skip specialist reviewers.
- **Phase 5:** Offer PR/merge/keep options; clean up worktree based on user choice
- Return short completion summary

Example 3:
User asks: "Refactor the authentication module --review-security --review-complexity"
Action:
- Delegate to Pathfinder for refactoring plan
- Pathfinder saves plan to `~/.ai-tpk/plans/{REPO_SLUG}/20260401-143022-auth-refactor.md`
- **Plan Review Gate:**
  - Invoke Ruinor (mandatory)
  - User flags present: --review-security, --review-complexity
  - Invoke Riskmancer (user flag) + Knotcutter (user flag) in parallel with Ruinor
  - Ruinor also flags complexity concerns → Knotcutter was already invoked
  - Collect all three verdicts
- Continue with implementation and reviews as needed

Example 4:
User asks: "Migrate from Redis 6 to Redis 7 and update the caching config --verify-facts"
Action:
- Delegate to Pathfinder for migration plan
- Pathfinder saves plan to `~/.ai-tpk/plans/{REPO_SLUG}/20260401-143022-redis-migration.md`
- **Plan Review Gate:**
  - Invoke Ruinor (mandatory baseline review)
  - User flag present: --verify-facts → invoke Truthhammer
  - Invoke Truthhammer for factual verification of Redis 7 config keys and behavioral changes
  - Ruinor: ACCEPT-WITH-RESERVATIONS
  - Truthhammer: REVISE (2 findings: FV-1 CRITICAL -- deprecated config key `slave-read-only` replaced by `replica-read-only` in Redis 7; FV-2 HIGH -- incorrect default value for `maxmemory-policy`)
  - Send consolidated feedback to Pathfinder
  - Pathfinder revises plan
  - Re-run Ruinor + Truthhammer → both ACCEPT
- Delegate implementation to Bitsmith
- **Implementation Review Gate:**
  - Invoke Ruinor + Truthhammer (user flag carried forward)
  - Both ACCEPT
- Return summarized status

Example 5:
User asks: "We need a background job system for sending emails --explore-options"
Action:
- **Explore-Options Gate triggers** (explicit `--explore-options` flag)
- DM invokes Pathfinder with `STOP_AFTER_SCOPE: true`
- Pathfinder researches codebase, produces Scope Confirmation:
  - Objective: Add an async email delivery system decoupled from the request cycle
  - Key Assumptions: no existing job infrastructure, Postgres is already present, email volume is moderate
  - Affected Subsystems: `src/mailer/`, `src/jobs/`, `config/`
  - Out of Scope: SMS notifications, retry dashboards, monitoring setup
  - Three implementation options: (A) In-process queue with a database-backed jobs table, (B) Redis-backed queue with BullMQ, (C) Dedicated message broker (e.g., RabbitMQ); recommendation: Option B
- Pathfinder returns scope + options output to DM (no plan written)
- DM presents scope + options to user, user selects Option B (Redis + BullMQ)
- DM re-invokes Pathfinder with `## Confirmed Scope` block (using re-invocation template above)
- Pathfinder sees `## Confirmed Scope` block, skips Section 4, proceeds directly to plan generation
- Pathfinder saves plan to `~/.ai-tpk/plans/{REPO_SLUG}/20260401-143022-background-jobs.md`
- Continue with Phase 2 (Plan Review Gate), Phase 3 (Execution), Phase 4 (Implementation Review), Phase 5 (Completion) as normal

Example 6:
User asks: "Add OAuth login" (while another DM session is already working on an unrelated issue)
Action:
- **Phase 0:** DM delegates to Bitsmith to create worktree at `.worktrees/feat-add-oauth-login` on branch `feat/add-oauth-login`
- All subsequent Pathfinder, Bitsmith, and Quill delegation prompts include:
  `WORKING_DIRECTORY: {REPO_ROOT}/.worktrees/feat-add-oauth-login`
  `WORKTREE_BRANCH: feat/add-oauth-login`
  `REPO_SLUG: {REPO_SLUG}`
- Pathfinder writes plans to `~/.ai-tpk/plans/{REPO_SLUG}/`
- Bitsmith operates in the worktree, commits land on `feat/add-oauth-login`
- **Phase 5:** DM offers PR/merge/keep options, cleans up worktree based on user choice
- Both sessions operate independently on separate branches without git conflicts

Example 7:
User asks: "Improve the auth system"
Action:
- **Intake Gate triggers** (ambiguous request: "improve" is vague, no scope boundary, multiple plausible interpretations)
- DM invokes Askmaw (round 1) with raw request and empty history
- Askmaw returns question: "What specific aspect of auth needs improvement — login speed, security hardening, adding new providers, or something else?"
- DM surfaces question to user; user answers: "Security hardening — we had a penetration test and need to fix the findings"
- DM invokes Askmaw (round 2) with request + Q&A history
- Askmaw returns question: "Do you have a list of specific findings from the pen test, or should we do a general security review?"
- DM surfaces question to user; user answers: "Yes, there are 3 findings: weak password policy, missing rate limiting on login, and session tokens don't expire"
- DM invokes Askmaw (round 3) with full context
- Askmaw returns structured brief (objective clear: fix 3 specific pen test findings; scope bounded)
- DM exits intake loop, passes brief to Pathfinder
- Pathfinder saves plan to `~/.ai-tpk/plans/{REPO_SLUG}/20260401-143022-auth-security-hardening.md`
- Continue with Phase 2 (Plan Review Gate) as normal

Example 8:
User asks: "Why is the background job queue dropping tasks silently?"
Action:
- **Phase 0:** DM delegates to Bitsmith to create worktree at `.worktrees/fix-job-queue-drops` on branch `fix/job-queue-drops`
- **Phase 1, step 1:** DM clarifies goal: "Determine why enqueued background jobs are silently dropped."
- **Investigative Gate triggers** (investigative question: "why is X happening?", no known cause, no plan; Intake and Explore-Options gates do not fire)
- Invoke Tracebloom with symptom: "background job queue dropping tasks silently"
- Tracebloom returns Diagnostic Report:
  - Symptom: Jobs enqueued via `enqueue()` in `src/jobs/queue.ts` are not being processed
  - Root cause: Worker pool size set to 0 in `config/production.yaml` due to a merge conflict marker left in the file
  - Recommended next action: "Fix is trivial -- route to Bitsmith directly"
- DM presents summary to user: "Tracebloom identified a merge conflict marker in `config/production.yaml` setting worker pool to 0. Routing to Bitsmith for the fix."
- Skip Pathfinder (trivial fix). Delegate to Bitsmith with Diagnostic Report as context.
- **Implementation Review:** Run Ruinor (mandatory baseline). Skip specialist reviewers.
- **Phase 5:** Offer PR/merge/keep options.

Example 9:
User asks: "Add webhook support for payment events"
Action:
- **Phase 0:** DM delegates to Bitsmith to create worktree
- **Phase 1:** Task is clear and well-specified — no Tracebloom, no Askmaw
- DM invokes Pathfinder (first invocation)
- Pathfinder researches codebase, reaches Section 4 (Scope Confirmation), returns scope output to DM:
  - Objective: Add inbound webhook handling for payment provider events (payment.completed, payment.failed)
  - Key Assumptions: Payment provider is Stripe; no existing webhook infrastructure
  - Affected Subsystems: src/webhooks/ (new), src/payments/, config/
  - Out of Scope: Outbound webhooks, non-payment event types
  - Option A: Synchronous webhook handler (simple, no queue)
  - Option B: Queue-backed webhook handler (reliable, retryable)
  - Recommendation: Option B — payment events should be idempotent and retryable
- DM surfaces scope + options to user; user confirms scope and selects Option B
- DM re-invokes Pathfinder with `## Confirmed Scope` block (Option B selected, Option A rejected because payment events require retry guarantees)
- Pathfinder skips Section 4, generates full plan, saves to `~/.ai-tpk/plans/{REPO_SLUG}/20260401-143022-webhook-support.md`
- Continue with Phase 2 (Plan Review Gate), Phase 3 (Execution), Phase 4 (Implementation Review), Phase 5 (Completion) as normal

Example 10:
User asks (via /ask): "How does the session isolation work with worktrees?"
Action:
- **Intent override fires:** `INTENT: advisory`. Log: "Intent override: advisory. Heuristic classification skipped."
- **Session variables captured:** `SESSION_TS` = `20260401-143022`, `SESSION_SLUG` = `session-isolation-worktrees`
- **Phase 0 worktree creation skipped** — advisory sessions do not create worktrees or plans
- **Phase A:** Question classified as "How does X work in this codebase?" → select Tracebloom
- **Phase B:** Invoke Tracebloom with advisory research request: "How does the session isolation work with worktrees?"
- Tracebloom returns findings: Phase 0 creates an isolated git worktree per session at `.worktrees/{branch-slug}`, all sub-agents receive WORKING_DIRECTORY context, worktree is cleaned up in Phase 5e
- **Phase C:** DM synthesises Tracebloom's findings into a direct answer, attributing codebase references. Sources: `claude/agents/dungeonmaster.md` (Phase 0 section), `claude/references/worktree-protocol.md`
- Session complete — no review, no plan, no PR prompt

Example 11:
User asks (via /ops): "What authentication patterns are used in this codebase?"
Action:
- **Intent override fires:** `INTENT: advisory --save-report`. Log: "Intent override: advisory. Heuristic classification skipped." Capture `--save-report` as active workflow flag. Strip `INTENT: advisory --save-report` from message.
- **Session variables captured:** `SESSION_TS` = `20260413-110000`, `SESSION_SLUG` = `auth-patterns-codebase`
- **Phase 0 worktree creation skipped** — advisory sessions do not create worktrees or plans
- **Phase A:** Question classified as "How does X work in this codebase?" → select Tracebloom
- **Phase B:** Invoke Tracebloom with advisory research request: "What authentication patterns are used in this codebase?"
- Tracebloom returns findings on auth patterns used in the codebase
- **Phase C:** DM synthesises Tracebloom's findings into a direct answer. Delivers answer inline to user.
- **`--save-report` post-synthesis:** DM runs `git rev-parse --show-toplevel` → succeeds, returns `/home/user/my-project`. Delegates to Bitsmith: write report to `/home/user/my-project/reports/20260413-110000-auth-patterns-codebase.md`. Bitsmith creates directory and writes file. DM logs: "Report saved to `/home/user/my-project/reports/20260413-110000-auth-patterns-codebase.md`"
- Session complete — no review, no plan, no PR prompt
- Output contract: Question, Agents consulted (Tracebloom), Answer summary, Sources, Report saved: `/home/user/my-project/reports/20260413-110000-auth-patterns-codebase.md`
