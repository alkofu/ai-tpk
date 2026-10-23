---
name: planning
description: >
  Methodology for turning a clear task into an actionable, verifiable work plan before implementation: start from a `clarify` Task Brief (or an already-clear request), research the codebase, ask the user only when there is a real fork between implementation approaches, write 3-6 atomic steps with behavioral acceptance criteria, run a pre-submission checklist, and ask for plan approval only when the work is complex. Use when a task is multi-step, cross-cutting, or risky enough that a plan should exist before coding — in a plain session (including plan mode), inside the `wayblade` delivery flow, or as the methodology preloaded into the Pathfinder agent.
---

# Planning

Use this skill when a task needs a plan before code: the change spans several files or systems, there are multiple viable approaches, or a wrong start would be expensive. For a trivial, unambiguous change, skip the plan and implement directly.

**Planning starts from a clear task.** Clarifying what the user wants is the `clarify` skill's job and happens first, in one batch. If you have neither a Task Brief nor a request that is already clear (one reading of the objective, bounded scope), run `clarify` before continuing here.

This skill is caller-agnostic. In a plain session or `/wayblade`, you talk to the user directly and keep the plan in the conversation (or plan mode) unless the user wants a file. The Pathfinder agent applies the same method inside a Dungeon Master delegation and adds DM-specific mechanics (where plans are saved, how option questions and approval are relayed).

**While planning, plan — do not implement.** Implementation starts only after the plan is agreed; then follow the `implementation-discipline` skill.

## 1. Research the codebase

Go deeper than the `clarify` scan: how similar problems are solved, which conventions and helpers to reuse, what else would be affected, and where the change could break something. Use Grep/Glob/Read directly, or delegate broad sweeps to an Explore agent.

**Never ask the user about codebase facts** — research them.

## 2. Treat the task as settled

Take the objective, scope, answers, and assumptions from the Task Brief (or the clear request) as given. Do not re-ask anything they cover, and do not re-run an interview or a scope-confirmation round: the user has already answered everything about intent.

If research reveals a gap about **intent** that the brief missed (for example, the code shows the change would also alter a user-visible behaviour nobody discussed), ask about it once, immediately, together with any option question from section 3 — never as a separate later round. Note in the plan that the brief missed it.

## 3. Ask only on a real fork

Ask the user during planning **only** when research shows more than one viable implementation approach with real trade-offs that the brief's answers do not settle. Ask once, as one question, with for each option: a name, a short summary, pros, cons, and reversibility (easy / moderate / hard, with a brief reason). End with your recommendation and why you reject the others.

When one approach is clearly better, or the trade-off is minor, decide yourself and record the decision and the rejected alternatives in the plan so they can appear in the PR. Do not ask for confirmation of scope; write the objective, key assumptions, affected areas, and out-of-scope items into the plan instead.

## 4. Write the plan

- **3-6 actionable steps** as a soft guide. Not 30 micro-steps; not "step 1: implement".
- **Atomic steps** — each step addresses exactly one testable concern. If a step's acceptance criterion needs "and" to be complete ("X is renamed *and* Y is updated"), split it. Atomicity wins over the 3-6 guide.
- **Do not split a single concern** across sub-steps (2a/2b/2c for one route's setup) — that is noise.
- **Verifiable acceptance** — every step ends with an acceptance criterion that shows the intent was achieved, not merely that a file exists.
- **Test-first annotation** — for steps with behavioral acceptance criteria ("given X, the system does Y"), mark `**test-first:** true` so implementation starts with a failing test (see `claude/references/implementation-standards.md`). Do not mark steps whose criteria are purely structural ("file exists", "config is valid YAML").
- **Classify complexity** and record it in the plan (see section 4a). Ask for approval of the plan only when it is complex.

### 4a. Complexity and approval

A plan is **complex** when any of these holds:

- it spans more than one area of the system (e.g. agents, installer, and docs), or roughly more than five files of non-mechanical change;
- it is breaking or hard to reverse: a public interface or config format change, a data or config migration, removing a feature, or a change to security or permission behaviour;
- a real-fork question was needed (section 3), or research overturned an assumption the brief relied on.

Otherwise it is **simple**.

- **Simple:** do not ask for approval. Proceed to implementation; the decisions and assumptions recorded in the plan go into the PR description.
- **Complex:** present the plan (objective, steps with acceptance criteria, recorded decisions) and ask for a single approve / change answer before implementation starts.
- The user can always override: "show me the plan" makes any task complex for approval purposes; "just do it" skips approval.

### Plan structure

```markdown
# Feature: {Feature Name}

## Context and Objectives

**Complexity:** {simple | complex} — {which criterion from section 4a applies, or "none"}

Background: {Current state and why this is needed}

Objectives:
- {Objective 1}
- {Objective 2}

## Decisions

- {Decision made during planning, the alternatives rejected, and why — or "None beyond the brief"}

## Guardrails

**Must Have:**
- {Required feature or constraint}

**Must NOT Have:**
- {Explicitly excluded feature or approach}

## Task Flow

### Step 1: {Component Name}
- **test-first:** true
<!-- Remove test-first line for steps with purely structural acceptance criteria -->
- [ ] {Specific actionable task}
- [ ] {Another specific task}
- **Acceptance:** {Clear success criteria}

### Step 2: {Next Component}
- [ ] {Specific actionable task}
- **Acceptance:** {Clear success criteria}

## Success Criteria

- {Measurable outcome}
- {Test that must pass}
```

Good step:

```markdown
### Step 2: Registration Endpoint
- [ ] Implement POST /api/register with email/password validation
- [ ] Hash passwords using bcrypt with cost factor 12
- [ ] Return session token on successful registration
- **Acceptance:** New users can register, passwords are hashed in DB
```

Bad step (too vague):

```markdown
### Step 2: Registration
- [ ] Implement registration
- **Acceptance:** Registration works
```

## 5. Pre-submission checklist

Before presenting the final plan, check each item and fix the plan if any fails:

1. **Per-target specificity** — instructions for each affected file or component are distinct where they differ meaningfully.
2. **File reference accuracy** — section names and line numbers were verified by reading the actual files.
3. **Distinct-case handling** — where targets have different structures (one has a section, another doesn't), they are handled in separate sub-steps.
4. **Rollback and recovery** — for steps that modify existing behavior, the prior state is documented so it can be restored (not applicable to additive-only changes).
5. **Behavioral acceptance criteria** — validation verifies the change achieves its intent, not just that files exist or greps match.
6. **Sequencing and dependencies** — each prerequisite is satisfied before it is needed.
7. **Completeness** — every part of the objective is covered with no unexplained gaps.
8. **Ambiguity test** — a careful implementer could not reasonably make a wrong judgment call from any instruction.
9. **Step atomicity** — each step addresses exactly one testable concern (see section 4).
10. **Complexity** — the `**Complexity:**` line names the section 4a criterion that applies (or "none"), and every decision made without asking is listed under Decisions.

## 6. Track open questions

Record anything unresolved — a dependency revealed during research, an ambiguity the brief left open, an assumption needing validation, a decision the user deferred — with its status (Open / Resolved / Blocked), why it matters, and the candidate options. In a plain session, list them with the plan; callers that persist plans (e.g. Pathfinder) keep them in a file next to the plan.

## Consensus mode (high-stakes decisions)

When the user asks for consensus or deliberate treatment (e.g. `--consensus`), or the decision is high-risk and hard to reverse, add:

- **Principles** — 3-5 guidelines for the work
- **Decision drivers** — the top 3 factors influencing the approach
- **Viable options** — 2-4 alternatives with pros, cons, and reversibility
- **Comparison matrix** — options against the decision drivers
- **ADR fields** — Status, Context, Decision, Consequences

For high-risk work, also add:

- **Pre-mortem** — what could go wrong, and the mitigation for each
- **Expanded testing plan** — unit, integration, e2e, and observability coverage
