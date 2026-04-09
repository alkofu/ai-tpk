# Skill: Document for intent, not narration

When generating documentation, assume the code is the primary source of truth and is readable by engineers. Do not rewrite code into prose unless the behavior is non-obvious, risky, or critical to understand.

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

## Default behavior

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

## By doc type

### README / service docs

Focus on:
- What the component does and when to use it
- Key entry points
- Major dependencies
- Config, runtime, and operational caveats

Avoid deep implementation walkthroughs.

### Design docs / technical specs

Focus on:
- Decisions, tradeoffs, and alternatives considered
- Data flow, boundaries, and invariants
- Risks

Avoid re-explaining code structure that already exists.

### ADRs

Focus on:
- Decision, context, and consequences
- Rejected alternatives

Avoid implementation narration except where it materially affects the decision.

### Inline code comments / docstrings

Use for:
- Non-obvious behavior
- Contract details (units, edge cases, side effects)
- Surprising constraints

Avoid comments that merely paraphrase the next line of code.

## Style rules

- Be concise.
- Prefer references to exact code locations over repeated prose.
- Summarize responsibilities, not mechanics.
- Explain why more than how.
- Treat the reader as capable of reading code.
- Do not inflate docs with exhaustive descriptions unless explicitly requested.

## Compression rule

For every section, ask: "Am I helping the reader understand, decide, debug, extend, or operate?"

If not, cut it.

## Output preference

When in doubt, structure entries as:

- **What it is**
- **Why it exists**
- **Important constraints**
- **Where the logic lives**
- **What is non-obvious**

Do not include implementation walkthroughs unless necessary for correctness or operations.
