---
name: planning
description: >
  Methodology for turning a request into an actionable, verifiable work plan before implementation: research codebase facts yourself, interview the user one question at a time about preferences only, confirm scope and options, then write 3-6 atomic steps with behavioral acceptance criteria and run a pre-submission checklist. Use when a task is ambiguous, multi-step, or risky enough that a plan should be agreed before coding — in a plain session (including plan mode), inside the `wayblade` delivery flow, or as the methodology preloaded into the Pathfinder agent.
---

# Planning

Use this skill when a request needs a plan before code: the scope is unclear, the change spans several files or systems, there are multiple viable approaches, or a wrong start would be expensive. For a trivial, unambiguous change, skip the plan and implement directly.

This skill is caller-agnostic. In a plain session or `/wayblade`, you talk to the user directly and keep the plan in the conversation (or plan mode) unless the user wants a file. The Pathfinder agent applies the same method inside a Dungeon Master delegation and adds DM-specific mechanics (where plans are saved, how scope confirmation is relayed).

**While planning, plan — do not implement.** Implementation starts only after the plan is agreed; then follow the `implementation-discipline` skill.

## 1. Research codebase facts yourself

Establish every codebase fact before asking the user anything: where the relevant code lives, how similar problems are solved, what conventions and helpers exist, what would be affected. Use Grep/Glob/Read directly, or delegate broad sweeps to an Explore agent.

**Never ask the user about codebase facts.** "Where is the auth code?", "What database do we use?", "How is error handling done today?" are research tasks, not questions.

## 2. Interview the user about preferences only

Ask only what research cannot answer:

- **Preferences** — "Do you prefer approach A or B?"
- **Priorities** — "Is performance or simplicity more important here?"
- **Constraints** — "Are there technical or organizational limits I should know about?"
- **Success criteria** — "How will you know this is done?"

**Ask one question at a time** and wait for the answer before the next. Skip questions the request or prior context already answers. If nothing is genuinely open, skip the interview.

Good questions:

- "Should we support multiple auth providers or just email/password for now?"
- "What's more important: fast delivery or extensive test coverage?"

Bad questions (research instead):

- "Where is the authentication code?"
- "What database are we using?"

## 3. Confirm scope (and options, when they exist)

Before writing the full plan, present a short scope summary and get confirmation:

- **Objective** — one sentence stating what the plan will achieve
- **Key assumptions** — 2-3 inferred-but-not-stated items the user should check
- **Affected subsystems** — files or areas that will change
- **Out of scope** — what is explicitly excluded

**Implementation options** — only when research reveals more than one viable approach. For each option give a name, summary, pros, cons, and reversibility (easy / moderate / hard, with a brief reason). End with a recommendation and explicit reasons for rejecting the others. If only one approach is viable, omit options.

Skip scope confirmation when the scope is already fully settled (e.g. the user has dictated it, or a diagnostic investigation already pinned the problem and fix).

## 4. Write the plan

- **3-6 actionable steps** as a soft guide. Not 30 micro-steps; not "step 1: implement".
- **Atomic steps** — each step addresses exactly one testable concern. If a step's acceptance criterion needs "and" to be complete ("X is renamed *and* Y is updated"), split it. Atomicity wins over the 3-6 guide.
- **Do not split a single concern** across sub-steps (2a/2b/2c for one route's setup) — that is noise.
- **Verifiable acceptance** — every step ends with an acceptance criterion that shows the intent was achieved, not merely that a file exists.
- **Test-first annotation** — for steps with behavioral acceptance criteria ("given X, the system does Y"), mark `**test-first:** true` so implementation starts with a failing test (see `claude/references/implementation-standards.md`). Do not mark steps whose criteria are purely structural ("file exists", "config is valid YAML").
- **Get explicit confirmation** of the steps (the *how*) before implementation starts. Scope confirmation covered the *what*; both are intentional.

### Plan structure

```markdown
# Feature: {Feature Name}

## Context and Objectives

Background: {Current state and why this is needed}

Objectives:
- {Objective 1}
- {Objective 2}

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

## 6. Track open questions

Record anything unresolved — a dependency revealed during the interview, an ambiguity found in research, an assumption needing validation, a decision the user deferred — with its status (Open / Resolved / Blocked), why it matters, and the candidate options. In a plain session, list them with the plan; callers that persist plans (e.g. Pathfinder) keep them in a file next to the plan.

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
