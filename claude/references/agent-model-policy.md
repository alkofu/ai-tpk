# Agent Model Policy — Reference

This file documents how model selection works across the agent system: the resolution chain, why Bitsmith uses `model: inherit`, why other agents remain pinned, and the discipline governing per-invocation overrides.

## 1. Resolution Chain

When an agent is invoked, the model is resolved in priority order:

1. **Per-invocation `model` parameter** (highest priority) — passed directly on the Agent tool call at the time of invocation. Accepts aliases only: `haiku`, `sonnet`, `opus`. Full model IDs (e.g., `claude-haiku-4-5`) are not accepted here. Example: passing `model: haiku` on the Agent call forces that invocation to use Haiku regardless of the agent's frontmatter.

2. **Agent frontmatter `model:` value** — set in the agent's YAML front matter. This is the default for most agents. Example: `model: claude-opus-4-7` in `ruinor.md` pins every Ruinor invocation to Opus unless priority #1 overrides it. The special value `model: inherit` at this layer skips this priority and falls through to priority #3.

3. **Session-level model** (lowest priority) — the model active in the parent session. When an agent declares `model: inherit`, it runs under whatever model the invoking session is using, unless priority #1 provides an override.

The alias-only constraint at priority #1 is enforced by the Agent tool itself. Always use `haiku`, `sonnet`, or `opus` — never a full model ID — when specifying a per-invocation override.

## 2. Why Bitsmith Uses `model: inherit`

Bitsmith is the forge executor. Her task spectrum spans more than any other agent's: she fixes a one-line typo on the trivial-fix branch and she implements complex multi-file refactors driven by Pathfinder plans. Pinning her to a single tier would either waste Haiku's cost advantage on trivial work or deny Opus's depth to genuinely complex implementations.

`model: inherit` makes her default tier whatever the DM session is running — appropriate for the bulk of Scoped work — while leaving two clean levers open:

- **Per-invocation override at the DM call site** — the DM can pass `model: haiku` when Tracebloom has already confirmed Trivial tier (see Section 4).
- **Bitsmith's own Phase 1 classifier** — she records a recommended tier and surfaces any mismatch (see `claude/agents/bitsmith.md`, Phase 1 section) so the DM can decide whether to re-delegate.

No other agent has this breadth of task scope, so `model: inherit` is not a default for the system — it is a deliberate choice for Bitsmith specifically.

## 3. Why Other Agents Remain Pinned

Agents whose role has a stable tier expectation keep a hardcoded `model:` value. Their work does not benefit from per-invocation tier flexibility because their task type is uniform: planning always warrants deep reasoning (Opus), narration is lightweight (Haiku), and advisory/intake/review tasks fit a consistent Sonnet baseline.

Propagating `model: inherit` to additional agents requires a deliberate decision. Do not add it as a default.

Current pinning across all 14 agents (post-change):

**Opus (4):** Pathfinder, Ruinor, Riskmancer, Knotcutter.

**Sonnet (8):** Dungeon Master, Tracebloom, Askmaw, Quill, Reisannin, Truthhammer, Windwarden, Everwise.

**Haiku (1):** Talekeeper.

**Inherit (1):** Bitsmith.

Total: 4 + 8 + 1 + 1 = 14 agents.

Pre-change: 13 pinned (Bitsmith at Sonnet) + 0 inherit. Post-change: 13 pinned + 1 inherit (Bitsmith). Net change: one agent moves from Sonnet-pinned to inherit.

## 4. Per-Invocation Override Discipline

The only documented call site for a per-invocation `model:` parameter is the trivial-fix delegation to Bitsmith in `claude/agents/dungeonmaster.md`. At that call site the DM passes `model: haiku` because Tracebloom's `Recommended next action` field provides independent confirmation that the work is Trivial tier — the DM does not need to rely solely on Bitsmith's self-classification.

Any future call site that wants to use a per-invocation model override must:

1. Update this reference file to enumerate the new call site, the tier used, and the justification.
2. State the justification inline at the call site (as DM's trivial-fix block does).
3. Honor the alias-only constraint: `haiku`, `sonnet`, or `opus` only — no full model IDs.

This discipline keeps per-invocation overrides auditable. An override without a corresponding entry here is a policy violation.
