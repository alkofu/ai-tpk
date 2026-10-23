---
name: docs-writing
description: >
  Style and workflow for writing or updating project documentation — READMEs, architecture and design docs, ADRs, API references, and docstrings. Documents intent, constraints, and decisions instead of narrating readable code, and points to code locations rather than shadowing them in prose. Use whenever creating or editing user-facing docs, updating docs after a code change, or deciding how much to explain — in a plain session, inside `wayblade`, or as the methodology preloaded into the Quill agent.
---

# Docs Writing

Use this skill when writing or updating documentation. It is caller-agnostic: it applies in a plain session, during the docs step of `/wayblade`, and inside the Quill agent (which adds Dungeon Master invocation modes on top).

Assume the code is the primary source of truth and is readable by engineers. Do not rewrite code into prose unless the behavior is non-obvious, risky, or critical to understand.

## Workflow

1. **Gap analysis** — Apply the `doc-review` skill: its discovery procedure, four analysis areas (coverage, accuracy, discoverability, onboarding readability), three finding tiers, and false-positive suppression rules. When updating docs after a change, compare existing docs against the diff and flag what the change made stale or missing.
2. **Outline** — Plan the structure with a clear heading hierarchy. Identify where examples, tables, or diagrams earn their place.
3. **Write** — Follow the style rules below and match the conventions of the surrounding docs. Prefer working examples (extracted from tests or real usage) over prose descriptions of how to call something. Write an OpenAPI spec for REST interfaces only when the project already uses one or the task asks for it.
4. **Validate** — Verify technical accuracy against the code, run the project's spellcheck and Markdown lint if it has them, check links, and confirm the heading hierarchy navigates logically.
5. **Report** — Summarize created or modified files with a one-line description each.

Keep doc updates in the same PR as the change they describe.

## Core principle

Documentation should explain what the reader cannot quickly infer from code.

Prefer documenting:

- Purpose and intent
- Architectural role
- Key decisions and tradeoffs
- Assumptions and invariants
- Interfaces and contracts
- Important flows at a high level
- Extension points
- Operational concerns, failure modes, and caveats
- Where in the codebase the logic lives

Avoid documenting:

- Step-by-step implementation that is already clear in code
- Obvious control flow
- Lists of methods, fields, or classes without added insight
- Prose that mirrors function bodies
- Details that are easier to verify by opening the source

## Anti-pattern: prose shadowing code

Do not create prose that merely shadows the implementation. If a doc section would read like a paraphrase of the code beneath it, delete the section and point to the code instead.

When code is self-explanatory:

- Name the relevant module, class, function, or file
- Briefly state its responsibility in one sentence
- Point the reader there instead of restating implementation details

Use docs as a map to the codebase, not a transcript of it.

## Decision rule

Before adding documentation detail, check:

1. Can a competent engineer learn this faster by reading the referenced code?
2. Does this explanation add intent, constraints, or context that the code does not show?
3. Is this detail likely to become stale if the implementation changes?
4. Would a pointer to the code be more useful than prose?

If the answer to (1) is yes and (2) is no — do not expand in prose.
If the answer to (2) is yes — include the explanation; it adds value the code alone does not provide.
If the answer to (3) is yes — prefer a brief summary plus a code reference.
If the answer to (4) is yes — point to the code.

## What good documentation looks like

**Good:**

- "Request validation happens in `FooValidator`; this layer defines the contract and the failure semantics."
- "Retry behavior is centralized in `bar/retry.ts`; the important constraint is that only idempotent operations use it."
- "The sync pipeline is split into ingest, normalize, and publish stages. Stage boundaries matter because only normalized records are persisted."

**Bad:**

- "The function checks if `x` is null, then iterates through the array, then maps the values…"
- "This class has three properties: …"
- "This method calls helper A, then helper B, then returns the result."

## On code examples

Code examples that demonstrate usage are documentation, not narration. Prefer a working example over a prose description of how to call an API, instantiate a class, or configure a module. Examples show; prose tells.

## By doc type

### README / service docs

Focus on what the component does and when to use it, key entry points, major dependencies, and config, runtime, and operational caveats. Avoid deep implementation walkthroughs.

### Design docs / technical specs

Focus on decisions, tradeoffs, and alternatives considered; data flow, boundaries, and invariants; and risks. Avoid re-explaining code structure that already exists.

### ADRs

Focus on decision, context, and consequences, and rejected alternatives. Avoid implementation narration except where it materially affects the decision.

### Inline code comments / docstrings

Use for non-obvious behavior, contract details (units, edge cases, side effects), and surprising constraints. Avoid comments that merely paraphrase the next line of code.

## Style rules

- Be concise.
- Match content complexity to the intended audience (end user vs. implementer).
- Prefer references to exact code locations over repeated prose.
- Summarize responsibilities, not mechanics.
- Explain why more than how.
- Prefer short sections, lists, and tables over long paragraphs.
- Treat the reader as capable of reading code.
- Do not inflate docs with exhaustive descriptions unless explicitly requested.

## Compression rule

For every section, ask: "Am I helping the reader understand, decide, debug, extend, or operate?" If not, cut it.

## Output preference

When in doubt, structure entries as:

- **What it is**
- **Why it exists**
- **Important constraints**
- **Where the logic lives**
- **What is non-obvious**

Do not include implementation walkthroughs unless necessary for correctness or operations.
