---
name: implementation-discipline
description: >
  Discipline for turning a task or plan into working code: minimal diffs, matching existing codebase patterns, incremental verification, and a three-attempt escalation limit. Use when implementing a feature, fix, or plan step that modifies code — in a plain session, inside the `wayblade` delivery flow, or as the methodology preloaded into the Bitsmith agent. Apply even for small changes when correctness and diff size matter.
---

# Implementation Discipline

Use this skill when turning a task, issue, or plan into working code. It is caller-agnostic: the same discipline applies whether you are the main session, running inside `/wayblade`, or the Bitsmith agent executing a Dungeon Master plan. Where this skill says "the requester", read it as whoever assigned the work — the user in a direct session, or the delegating agent.

The canonical statements of Minimal Diff, No Over-Engineering (YAGNI), and Test-First live in `claude/references/implementation-standards.md`. This skill applies them; it does not restate them.

## Scope

**In scope:**

- Writing, editing, and verifying code within the exact scope of the assigned task
- Reading existing files to understand patterns, conventions, and structure
- Running builds, tests, and LSP/type checks to verify the work
- Removing all temporary, debug, or scaffolding code before declaring completion
- Fixing failures encountered during active implementation (failing tests, compilation errors, code broken mid-change)

**Out of scope — surface instead of absorbing:**

- **Architecture decisions** not specified by the task or plan — surface them; do not decide silently
- **Open-ended debugging** ("why doesn't X work?" with no known cause) — investigate as a separate step before implementing
- **Scope expansion** — if the task grows, say so; do not absorb it
- **Editing the plan to match what was built** — if reality diverges from the plan, that is escalation material

## Quality Standard

A change is done only when it meets every point:

1. **Minimal diff** — as small as it can be while being fully correct.
2. **Diagnostics-clean** — every modified file passes LSP/type diagnostics with zero errors.
3. **Fresh verification** — build and test output checked fresh after every change, never assumed from earlier runs.
4. **Pattern-matched** — naming, structure, and style consistent with the surrounding code.
5. **No dead weight** — debug statements, temporary scaffolding, TODO stubs, and console noise removed.
6. **No unnecessary abstractions** — if the codebase handles something directly, handle it directly.
7. **Test failures fixed in production code** — fix the source, not the test, unless the test itself is demonstrably wrong.

## Protocol

Work in this sequence. Scale the depth of each step to the task — a one-line fix needs seconds of exploration, a cross-cutting change needs much more — but do not skip steps.

### 1. Classify the task

- **Trivial** — a single, obvious change in a known location.
- **Scoped** — multiple changes across a bounded set of files.
- **Complex** — touches many systems, needs deep pattern discovery, or has unclear boundaries.

Classification determines how much exploration is needed before writing code.

### 2. Identify target files

Identify every file that must be created, modified, or verified. Do not begin implementation until the full surface area is known.

### 3. Explore codebase patterns

Before writing a line, understand how the existing code is shaped:

- What naming conventions are in use?
- How are similar problems solved elsewhere?
- What utilities, helpers, or abstractions already exist that should be reused?
- What does the surrounding code expect from this area?

For complex tasks, delegate read-only exploration to sub-agents (at most 3 concurrently). Never modify files during exploration.

### 4. Match code style

Match indentation, spacing, import ordering, error-handling patterns, documentation density, and test structure and naming. Technically correct code in the wrong style still causes friction for every later maintainer.

### 5. Break into atomic work items

For scoped and complex tasks, track discrete steps (e.g. with the todo list). Each item is:

- **Atomic** — one clear action
- **Verifiable** — has a clear pass/fail condition
- **Ordered** — earlier steps do not block later ones

**Test-first:** when a step is marked test-first (e.g. a plan step annotated `**test-first:** true`), add a "write failing test" item before its implementation items and follow the Test-First Protocol in `implementation-standards.md`. If a failing test is not feasible even with a minimal stub, raise it with the requester rather than skipping silently.

### 6. Implement incrementally

One atomic step at a time:

1. Make the change
2. Verify immediately (diagnostics, build, relevant tests)
3. Confirm it passes before moving on
4. Never accumulate unverified changes

Prefer targeted edits over rewriting whole files.

### 7. Final verification

Before declaring completion:

- Run the full build fresh
- Run the full (or relevant) test suite fresh
- Confirm zero diagnostics errors across all modified files
- Confirm debug code and scaffolding are removed
- Confirm the diff is as small as it can be while remaining correct
- Confirm every acceptance criterion of the task or plan is satisfied
- Self-check against common review criteria: (1) error paths have explicit handling, (2) boundary conditions are addressed, (3) public interfaces validate their input

If verification could not be run (no test suite, missing tooling), say so explicitly in the completion report rather than implying it passed.

## Escalation

**Three failed attempts is the limit.** On the third failure, stop and report to the requester. Do not attempt a fourth approach.

A failed attempt is:

- A change that causes new test failures or diagnostics errors that cannot be resolved
- A change correct in isolation that breaks the surrounding system in ways that cannot be untangled
- Discovery that the task's or plan's assumptions do not match the actual codebase

**Escalate immediately, without waiting for three attempts, when:**

- The task requires architectural changes outside its stated scope
- The task conflicts with another system in a way that needs a planning decision
- Exploration shows the planned approach is invalid

An escalation report covers: what was being attempted, each attempt and its outcome, what failed and why, what the codebase revealed that the task did not account for, and a recommended next step (replan, adjust scope, or other). Callers may require a stricter format — the Bitsmith agent adds fields for the Dungeon Master.

## Failure Patterns to Avoid

- **Over-engineering** — abstractions, generalization, or infrastructure nobody asked for.
- **Scope creep** — fixing a nearby problem while working on the assigned one. Log and surface adjacent problems instead.
- **Premature completion** — declaring done before fresh verification.
- **Pattern blindness** — code that works but ignores the conventions around it.
- **Rewriting instead of editing** — replacing working code when a targeted change would do.
- **Modifying the blueprint** — editing the plan to match the implementation instead of escalating the divergence.
- **Silent design decisions** — making a design choice the task did not specify without surfacing it.
