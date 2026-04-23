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
2. Tracebloom produces a **Diagnostic Report**. For the authoritative report schema and the five required fields, see [`claude/agents/tracebloom.md`](/claude/agents/tracebloom.md#diagnostic-report).
3. DM evaluates the report's recommendation and routes accordingly: For the authoritative routing logic for each of the four "Recommended next action" values, see [`claude/agents/dungeonmaster.md`](/claude/agents/dungeonmaster.md#phase-1-planning) "Investigative Gate".

**Key property:** Read-only investigation. Tracebloom never writes, edits, or runs write-bearing commands. The Diagnostic Report feeds into Pathfinder's planning after a user-facing Premise Check confirms the diagnosis.

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
2. If ambiguous → Routes to **Askmaw** for intake interview, collecting an **Intake Brief**
3. If already clear → Proceeds directly to **Pathfinder**
4. Pathfinder produces a **Plan** (objective, assumptions, constraints, execution steps, validation criteria, risks)
5. Plan review → Ruinor baseline + conditional specialist reviews → revision loop if needed
6. Implementation → Bitsmith executes the approved plan
7. Implementation review → Ruinor baseline + conditional specialist reviews
8. Completion → Quill updates documentation

**Key property:** Structured planning before execution. Plans are saved to disk, reviewed, and form the blueprint for implementation.

---

## Diagnostic Report as a Planning Input

When Tracebloom's investigation produces a report recommending "Route to Pathfinder for planning a fix," the DM runs a **Premise Check** before delegating to Pathfinder. The Premise Check surfaces three scope-bearing items to the user and waits for explicit confirmation:

- **Root cause** — the one-sentence statement from Tracebloom's report
- **Affected files/components** — file paths and component names from the Evidence field
- **Recommended next action** — the verbatim routing recommendation

The user may reply with "proceed" (DM passes the Diagnostic Report to Pathfinder unchanged), provide corrections or scope adjustments (DM appends them to the handoff), or reject the diagnosis outright (DM offers to re-invoke Tracebloom or abandon the investigative path).

Once the user confirms, the Diagnostic Report becomes Pathfinder's requirements input. Pathfinder:

- **Uses the root cause and evidence directly** from the report as the problem definition
- **Does NOT re-investigate** facts already established in the report
- **May ask follow-up questions** about priorities, scope, or how to handle multiple contributing factors
- **Notes in the plan** if the fix is trivial (as flagged by Tracebloom)

This eliminates redundant investigation and ensures that Pathfinder builds on Tracebloom's findings rather than starting from scratch. The premise check ensures the user has a chance to correct a misdiagnosis or adjust scope before planning begins.

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
    │  │            ├─ "Route to Pathfinder" → Premise Check (user confirms diagnosis)
    │  │            │                              │
    │  │            │                              ├─ Proceed → Pathfinder (report as context)
    │  │            │                              ├─ Corrections → Pathfinder (report + adjustments)
    │  │            │                              └─ Reject → Re-invoke Tracebloom or abandon
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

Tracebloom investigates config and git history; finds a merge conflict marker in `config/production.yaml` leaving the worker pool size at 0. Diagnostic Report recommends **"Fix is trivial — route to Bitsmith directly"**. DM skips Pathfinder and routes to Bitsmith, which resolves the conflict marker. Ruinor reviews the change; no specialists needed. Session complete.

---

## Example: From Diagnosis to Planning to Implementation

### Scenario: "Why are database queries timing out?"

Tracebloom examines slow query logs and schema history; identifies missing indexes on frequently-filtered columns (`email`, `status`). Diagnostic Report recommends **"Route to Pathfinder for planning a fix"**. DM runs the Premise Check, surfacing the root cause, affected files (`src/db/schema.ts`, `src/users/repository.ts`), and recommended next action. User replies "proceed". Pathfinder uses the root cause directly (no re-investigation), produces a plan to add the missing indexes with monitoring. Ruinor and Windwarden both ACCEPT. Bitsmith executes the plan; Quill updates documentation at completion.

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

In the investigative pipeline, worktree creation is deferred until after investigation completes:

- **Tracebloom** receives the **main repository root** as its `WORKING_DIRECTORY` — no worktree exists yet when it investigates.
- **All file paths in the Diagnostic Report** are absolute paths rooted at the main repository, not the worktree.
- The **Worktree Creation Subroutine** fires only after the Diagnostic Report routes to a fix: after the user confirms the Premise Check (Pathfinder branch), or immediately before Bitsmith delegation (trivial-fix branch). It is skipped entirely on "Inconclusive" (and the user does not choose to proceed) and "No bug found" outcomes.
- **Pathfinder and Bitsmith** receive the worktree context block (`WORKING_DIRECTORY` pointing at the newly created worktree) along with the Diagnostic Report and a path-translation note instructing them to substitute the worktree path for the main-repo prefix when reading any evidence-listed files.
- Plans reference the worktree for consistency once it exists.
