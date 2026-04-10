# Workflow Entry Points

The Dungeon Master now supports two distinct entry points for development tasks, each with its own specialized agent and workflow. Understanding which path to take depends on whether your request is **investigative** ("why is this broken?") or **constructive** ("add/fix/refactor this").

## Entry Point Classification

### Investigative Tasks: Tracebloom → Diagnostic Report

**Invoke when your request is a problem diagnosis:**
- "Why is the login endpoint returning 500 errors?"
- "Something broke after the last deploy"
- "The background job queue is silently dropping tasks"
- "Why are database queries timing out?"

**Characteristics:**
- The root cause is unknown
- No plan has been made yet
- The question is open-ended ("why?" not "how?")
- You need structured investigation before planning

**Flow:**
1. Dungeon Master routes to **Tracebloom** for investigation
2. Tracebloom produces a **Diagnostic Report** with 5 structured fields:
   - **Symptom** — problem restated precisely
   - **Investigation summary** — what was examined and found
   - **Root cause** — the identified cause, or "Inconclusive"
   - **Evidence** — file paths, line numbers, commits, configs
   - **Recommended next action** — route to Pathfinder, route to Bitsmith, inconclusive, or no bug found
3. DM evaluates the report's recommendation:
   - **"Route to Pathfinder"** → Proceed to planning with the report as context
   - **"Fix is trivial"** → Skip planning, route directly to Bitsmith
   - **"Inconclusive"** → Present findings to user, ask how to proceed
   - **"No bug found"** → Session ends unless user disagrees
4. If routing to Pathfinder: Tracebloom's findings become the problem definition (no re-investigation)

**Key property:** Read-only investigation. Tracebloom never writes, edits, or runs write-bearing commands. The Diagnostic Report is structured to feed directly into Pathfinder's planning.

---

### Constructive Tasks: Pathfinder → Plan

**Invoke when your request is a constructive task:**
- "Add OAuth login to the auth system"
- "Refactor the cache layer for better performance"
- "Fix the null pointer in auth.js line 42"
- "Implement pagination on the users endpoint"

**Characteristics:**
- The direction is clear (add, fix, refactor, implement)
- You know what needs to be done (even if not the exact how)
- The request may be ambiguous or underspecified, but it's not diagnostic
- No investigation phase is needed

**Flow:**
1. Dungeon Master evaluates the request
2. If ambiguous → Routes to **Askmaw** for intake interview, collects clarifications into an **Intake Brief**
3. If already clear → Proceeds directly to **Pathfinder**
4. Pathfinder produces a **Plan** with:
   - Objective
   - Assumptions
   - Constraints
   - Step-by-step execution plan
   - Validation criteria
   - Risks and rollback considerations
5. Plan review → Ruinor baseline + conditional specialist reviews
6. Plan revision loop (if reviewers flag issues)
7. Implementation → Bitsmith executes the approved plan
8. Implementation review → Ruinor baseline + conditional specialist reviews
9. Completion → Quill updates documentation

**Key property:** Structured planning before execution. Plans are saved to disk, reviewed, and form the blueprint for implementation.

---

## Diagnostic Report as a Planning Input

When Tracebloom's investigation produces a report recommending "Route to Pathfinder for planning a fix," the Diagnostic Report itself becomes Pathfinder's requirements input. Pathfinder:

- **Uses the root cause and evidence directly** from the report as the problem definition
- **Does NOT re-investigate** facts already established in the report
- **May ask follow-up questions** about priorities, scope, or how to handle multiple contributing factors
- **Notes in the plan** if the fix is trivial (as flagged by Tracebloom)

This eliminates redundant investigation and ensures that Pathfinder builds on Tracebloom's findings rather than starting from scratch.

---

## Quick Decision Tree

```
User request received
    │
    ├─ Is the request investigative?
    │  ("Why is X broken?", "X is failing", "Something is wrong")
    │  │
    │  ├─ YES → Tracebloom → Diagnostic Report
    │  │            │
    │  │            ├─ "Route to Pathfinder" → Pathfinder (uses report as context)
    │  │            ├─ "Fix is trivial" → Bitsmith (uses report as context)
    │  │            ├─ "Inconclusive" → Ask user how to proceed
    │  │            └─ "No bug found" → Session ends
    │  │
    │  └─ NO → Continue to Planning Path
    │
    ├─ Is the request ambiguous/underspecified?
    │  │
    │  ├─ YES → Askmaw interview → Intake Brief
    │  │           │
    │  │           └─ Pathfinder (uses brief as context)
    │  │
    │  └─ NO → Continue
    │
    ├─ Does request require explicit scope/options review before planning?
    │  │
    │  ├─ YES → DM invokes with --explore-options flag → Scope Confirmation → Options → User selects
    │  │
    │  └─ NO → Continue
    │
    └─ Pathfinder (direct planning, includes automatic Scope Confirmation)
         │
         └─ Ruinor review + specialist reviews
              │
              ├─ REJECT / REVISE → Revision loop
              └─ ACCEPT → Bitsmith implementation
```

---

## Example: From Diagnosis to Implementation

### Scenario: "Why is the background job queue dropping tasks?"

**Phase 1: Investigation (Tracebloom)**
- User reports: "Background jobs enqueued via enqueue() are not being processed"
- DM routes to Tracebloom
- Tracebloom investigates:
  - Checks job queue configuration
  - Examines recent git history for config changes
  - Finds merge conflict marker in `config/production.yaml`
  - Worker pool size set to 0 due to the conflict
- Diagnostic Report:
  - Symptom: Jobs are silently dropped
  - Investigation: Config and git history reviewed
  - Root cause: Merge conflict marker in production config (worker pool = 0)
  - Evidence: `config/production.yaml` line 47
  - Recommended next action: **"Fix is trivial — route to Bitsmith directly"**

**Phase 2: Implementation (Bitsmith) — Plan Skipped**
- DM skips Pathfinder (report says fix is trivial)
- Routes directly to Bitsmith with the Diagnostic Report as context
- Bitsmith:
  - Reads the report
  - Fixes the merge conflict marker in `config/production.yaml`
  - Verifies the configuration is valid
  - Deploys and tests that jobs are now processed

**Phase 3: Implementation Review**
- Ruinor review
- No additional specialists needed
- Completion

---

## Example: From Diagnosis to Planning to Implementation

### Scenario: "Why are database queries timing out?"

**Phase 1: Investigation (Tracebloom)**
- User reports: "Database queries are taking >5 seconds"
- DM routes to Tracebloom
- Tracebloom investigates:
  - Checks slow query logs
  - Examines recent schema changes via git history
  - Tests hypothesis about missing indexes
  - Traces affected query patterns
- Diagnostic Report:
  - Symptom: Queries >5 seconds on users table
  - Investigation: Logs, schema history, and patterns examined
  - Root cause: Missing index on frequently-filtered columns (email, status)
  - Evidence: `schema.sql` shows no index, slow query log shows repeated full table scans
  - Recommended next action: **"Route to Pathfinder for planning a fix"**

**Phase 2: Planning (Pathfinder)**
- DM routes to Pathfinder with Tracebloom's report
- Pathfinder:
  - Uses the root cause (missing indexes) directly as the problem
  - Does NOT re-investigate the slow queries
  - Checks if there are secondary concerns (e.g., should we add monitoring?)
  - Produces plan:
    - Step 1: Add index on (email, status) columns
    - Step 2: Verify query performance improves to <100ms
    - Step 3: Add index monitoring to prevent future regressions
  - Plan includes testing and validation

**Phase 3: Plan Review**
- Ruinor review
- Windwarden invoked (performance-related)
- Both reviewers ACCEPT
- Plan approved

**Phase 4: Implementation (Bitsmith)**
- Bitsmith executes the plan
- Creates the indexes
- Runs queries to verify performance

**Phase 5: Implementation Review & Completion**
- Ruinor review
- Code merged
- Quill updates documentation

---

## When Tracebloom is Skipped

Tracebloom is NOT invoked when:
1. A plan already exists and you're debugging a failing test/compilation error (Bitsmith handles this)
2. The root cause is already known ("The bug is in function Y")
3. The request is constructive, not diagnostic ("Add feature X")
4. You're asking for improvements, not diagnosis ("Make this faster")

In these cases, go directly to Pathfinder (if constructive) or Bitsmith (if within an active plan).

---

## Integration with Worktrees

When using the Dungeon Master's worktree feature:
- Both Tracebloom and Pathfinder receive the `WORKING_DIRECTORY` context block
- All file paths in the Diagnostic Report are absolute paths within the worktree
- The Diagnostic Report is passed verbatim to Pathfinder in the worktree's context
- Plans reference the same worktree for consistency

This ensures that investigation, planning, and implementation all operate on the same isolated branch and worktree.
