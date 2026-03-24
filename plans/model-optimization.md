# Model Assignment Optimization Analysis

## Context and Objectives

**Background:** All review and analysis agents currently run on `claude-opus-4-6`, the most expensive model tier. Bitsmith and Dungeon Master run on `claude-sonnet-4-6`. Three agents (knotcutter, quill, talekeeper) have no explicit model set. The actual Claude Code default when no `model:` field is present is unknown -- it may be sonnet, haiku, or inherited from the parent session's model. The plan previously assumed "likely opus," but this is unverified. This analysis evaluates whether each agent's task complexity justifies its model tier and identifies opportunities to reduce cost without degrading outcome quality.

**Objective:** Produce a concrete model reassignment recommendation with phased rollout, cost estimates, and rollback procedures that optimizes for time and cost while preserving quality where it matters most.

## Analysis Framework

Each agent is evaluated on three dimensions:

1. **Reasoning depth required** -- Does the task demand nuanced judgment, multi-step inference, or creative problem-solving? Or does it apply known patterns and checklists?
2. **Stakes of failure** -- What is the cost of a false negative (missed problem) or a low-quality output? Does a bad output cascade into downstream rework?
3. **Task structure** -- Is the work open-ended and judgment-heavy, or templated and procedural?

## Agent Classification

To avoid conflating fundamentally different agent types, this plan distinguishes three tiers of task structure:

### Tier A: Open-ended reasoning agents
Agents whose core methodology requires creative judgment, multi-step inference, and decisions with no fixed answer set. Cannot be reduced to checklist application.

- **Pathfinder** -- Interview synthesis, multi-constraint balancing, plan architecture
- **Ruinor** -- Adversarial multi-perspective analysis, self-audit, realist checks
- **Knotcutter** -- Open-ended questions ("What happens if we remove this?"), judgment about what to eliminate, active code modification via Write/Edit tools

### Tier B: Structured-protocol specialists
Agents that apply known patterns against fixed enumerated categories. The answer space is constrained by the checklist or rubric, even though some judgment is needed within each category.

- **Riskmancer** -- OWASP A01-A10 checklist, secrets scanning patterns, dependency audit commands
- **Windwarden** -- Explicit anti-pattern checklist (N+1, missing indexes, unbounded loops), severity rubric with fixed categories
- **Everwise** -- 9-step protocol, 7 fixed problem types, confidence scoring rubric 0.0-1.0, fixed JSON schema output

### Tier C: Templated/mechanical agents
Agents that follow rigid procedures with no judgment calls. Output format is fully specified.

- **Quill** -- Gap analysis, structured Markdown generation, fixed workflow
- **Talekeeper** -- 12-step mechanical procedure, JSONL parsing, Mermaid diagram generation from structural metadata

## Recommendation Table

| Agent | Current Model | Recommended Model | Tier | Justification | Risk Level |
|-------|---------------|-------------------|------|---------------|------------|
| **pathfinder** | opus | **opus** (keep) | A | Planning drives all downstream work. A bad plan cascades into failed reviews, rework loops, and wasted Bitsmith invocations. The interview workflow, requirement synthesis, and multi-constraint balancing require deep reasoning. False economy to downgrade. | N/A |
| **ruinor** | opus | **opus** (keep) | A | Mandatory quality gate on every plan and every implementation. The 6-phase investigation protocol requires nuanced judgment: predicting problem areas, multi-perspective analysis, self-audit, realist checks, and specialist triage. False approvals cost 10-100x more than false rejections. Highest-stakes agent in the system. | N/A |
| **knotcutter** | *(unset)* | **opus** (set explicitly) | A | See detailed analysis below. Knotcutter is not a checklist agent. Its methodology requires creative architectural judgment that distinguishes it from Riskmancer/Windwarden. | N/A |
| **riskmancer** | opus | **opus** (keep, revised) | A | Low invocation frequency means minimal cost savings (~$1-2/month); when invoked, task is security-sensitive by definition and requires contextual judgment (~60% of work is data flow tracing, blast radius analysis, chained vulnerability detection — not pure pattern matching). Same logic as Knotcutter applied consistently: low-frequency + high-stakes context = keep on opus. | N/A |
| **windwarden** | opus | **sonnet** | B | Performance review applies known anti-patterns (N+1 queries, missing indexes, unbounded loops, missing pagination) with an explicit severity rubric. Most checklist-driven of all reviewers. Mitigated by Ruinor (opus) performing baseline performance checks first. | Medium |
| **everwise** | opus | **sonnet** | B | 9-step protocol with explicit classification types, confidence scoring rubric, and fixed JSON schema. Highly structured analytical work. Advisory-only and manually invoked -- errors are low-stakes and easily caught by the user. | Low |
| **bitsmith** | sonnet | **sonnet** (keep) | -- | Already correctly assigned. Implementation benefits from speed and sonnet's strong code generation. Ruinor reviews all output. | N/A |
| **dungeonmaster** | sonnet | **sonnet** (keep) | -- | Already correctly assigned. Orchestration is routing and delegation with fixed phase sequence. | N/A |
| **quill** | *(unset)* | **haiku** (set explicitly) | C | Documentation is templated: gap analysis, structured Markdown, fixed workflow. Output format is well-defined. Documentation errors are low-stakes and easily caught. | Low |
| **talekeeper** | *(unset)* | **haiku** (set explicitly) | C | Most mechanical task in the system. 12-step procedure: read JSONL, extract structural metadata, build table, generate Mermaid diagram, append to Markdown. No judgment calls. Rigidly specified output format. | Low |

## Knotcutter: Detailed Analysis

Ruinor's quality gate review correctly identified that Knotcutter was mischaracterized as a "checklist-driven specialist" in the original plan. This section provides the corrected analysis.

### Why Knotcutter is not checklist-driven

Knotcutter's four-step methodology is fundamentally open-ended:

1. **Catalog Everything** -- requires judgment about what constitutes a "component" or "abstraction"
2. **Question Necessity** -- asks "What happens if we remove this?" -- no fixed answer set, requires reasoning about system behavior under hypothetical changes
3. **Identify Minimum Viable Core** -- requires creative judgment about what constitutes "essential" vs. "nice-to-have"
4. **Apply Central Question** -- "What's the simplest thing that could possibly work?" -- inherently creative, no lookup table

Compare with Riskmancer, which evaluates against OWASP A01 through A10 -- a fixed, enumerated list where each category has known vulnerability patterns and known remediations. Knotcutter has no equivalent fixed reference. Every codebase presents unique decisions about what to keep and what to cut.

Additionally, Knotcutter has **Write and Edit tools** and actively modifies code -- it proposes and implements simplifications, replaces complex systems with simpler alternatives. This is not review work; it is architectural transformation requiring the kind of creative judgment that distinguishes opus from sonnet.

### Recommendation

Set Knotcutter's model explicitly to `claude-opus-4-6`. The reasoning:

- **Open-ended judgment**: Knotcutter's core task -- deciding what to eliminate from a system -- cannot be reduced to pattern matching. Sonnet may follow the 4-step methodology but produce shallow "Question Necessity" analysis that misses subtle dependencies.
- **Active modification**: Unlike read-only reviewers (Riskmancer, Windwarden), Knotcutter writes code. A bad simplification that removes something essential is harder to detect and more costly than a missed security finding (which Ruinor catches at baseline).
- **Low invocation frequency**: Knotcutter is conditional and rarely invoked, so keeping it on opus has minimal cost impact. The cost difference between opus and sonnet for a rarely-invoked agent is negligible compared to the risk of a bad simplification.
- **No safety net for its unique role**: Ruinor checks baseline complexity, but Knotcutter's job is aggressive simplification -- no other agent validates whether a proposed elimination is safe. A bad opus recommendation is caught by human review; a bad sonnet recommendation might be more subtly wrong and harder to catch.

## Cost Estimates

Approximate per-invocation cost estimates based on model pricing (opus ~$15/M input + $75/M output, sonnet ~$3/M input + $15/M output, haiku ~$0.80/M input + $4/M output). Assumes average agent invocation uses ~5K input tokens and ~2K output tokens.

| Agent | Current Model | Proposed Model | Est. Cost/Invocation (Current) | Est. Cost/Invocation (Proposed) | Invocations/Session | Savings/Session |
|-------|---------------|----------------|-------------------------------|--------------------------------|--------------------|-----------------|
| **pathfinder** | opus | opus | ~$0.23 | ~$0.23 | 1 | $0.00 |
| **ruinor** | opus | opus | ~$0.23 | ~$0.23 | 2-4 | $0.00 |
| **knotcutter** | unset | opus | unknown | ~$0.23 | 0-1 | $0.00 |
| **riskmancer** | opus | opus | ~$0.23 | ~$0.23 | 0-1 | $0.00 |
| **windwarden** | opus | sonnet | ~$0.23 | ~$0.05 | 0-1 | ~$0.18 |
| **everwise** | opus | sonnet | ~$0.23 | ~$0.05 | 0-1 (manual) | ~$0.18 |
| **bitsmith** | sonnet | sonnet | ~$0.05 | ~$0.05 | 2-6 | $0.00 |
| **dungeonmaster** | sonnet | sonnet | ~$0.05 | ~$0.05 | 1 | $0.00 |
| **quill** | unset | haiku | unknown | ~$0.01 | 0-1 | unknown* |
| **talekeeper** | unset | haiku | unknown | ~$0.01 | 0-1 | unknown* |

*Since the actual default model for unset agents is unknown, the savings for Quill/Talekeeper/Knotcutter cannot be precisely calculated. If the default is sonnet, setting Quill and Talekeeper to haiku saves ~$0.04/invocation each. If the default is opus, the savings are ~$0.22/invocation each. Setting Knotcutter explicitly to opus has zero cost impact if the default is already opus, or increases cost if the default is sonnet/haiku.

**Estimated total savings per typical session:** ~$0.18-$0.36 from Windwarden + Everwise downgrades (when invoked). Riskmancer remains on opus (see revised recommendation). Additional savings from Quill/Talekeeper haiku assignment depend on the unknown default.

**Where the savings are concentrated:** The highest-volume agent (Bitsmith at 2-6 invocations/session) and the highest-stakes agents (Ruinor at 2-4 invocations/session) are unchanged. Cost savings come from low-frequency conditional specialists. This is the right profile -- savings from agents where quality risk is acceptable, not from the critical path.

## Phased Rollout Strategy

Changes are grouped into three phases by risk level, with each phase requiring validation before proceeding to the next.

### Phase 1: Low-risk, easily verified (Quill, Talekeeper to haiku)

**Scope:** Set `model: claude-haiku-4-5` on Quill and Talekeeper.

**Why lowest risk:**
- Both perform templated, mechanical work with fully specified output formats.
- Output quality is immediately visible and easy to spot-check.
- Neither agent is in the critical review path -- bad output does not cascade.
- Errors are cosmetic (documentation quality, narrative formatting), not functional.

**Validation method:**
- Run Talekeeper on 2-3 existing sessions. Compare output quality to previous narratives in `logs/talekeeper-narrative.md`.
- Run Quill on one documentation task. Spot-check formatting, accuracy, completeness.
- If output quality is acceptable, proceed. If not, revert and reassess (sonnet as fallback).

**Duration:** 1-2 sessions.

### Phase 2: Medium-risk, structurally constrained (Windwarden, Everwise to sonnet)

**Scope:** Change `model: claude-opus-4-6` to `model: claude-sonnet-4-6` on Windwarden and Everwise. Riskmancer remains on opus (see revised recommendation and note below).

**Why medium risk:**
- Both follow structured protocols with fixed categories/rubrics.
- Both operate behind Ruinor's opus-level baseline (Windwarden) or are advisory-only (Everwise).
- But they are part of the quality review pipeline -- a missed finding could reach production.

**Validation method:**
- For the first 3-5 sessions after the change, compare specialist review output against what Ruinor flagged at baseline. If specialists are consistently finding less than Ruinor, this is expected (they add depth, not breadth). If specialists are producing empty or irrelevant reviews, investigate.
- A/B comparison: On at least one session, manually re-run a Windwarden review with opus on the same artifact reviewed by sonnet. Compare findings. If the opus run catches material issues sonnet missed, pause and reassess.
- Monitor Ruinor's REJECT/REVISE rate on Bitsmith output -- if it increases, specialists may be missing things that Bitsmith would have caught from their feedback.

**Duration:** 3-5 sessions.

### Phase 3: Knotcutter (set explicitly to opus)

**Scope:** Add `model: claude-opus-4-6` to Knotcutter's frontmatter.

**Why separate phase:**
- This is not a downgrade but an explicit assignment. The actual change depends on what the current default is.
- If the default is already opus, this is a no-op that documents intent.
- If the default is sonnet or haiku, this is an upgrade that ensures Knotcutter gets the reasoning depth its open-ended methodology requires.

**Validation method:** No regression risk since this either maintains or improves the current state.

**Duration:** Immediate.

## Rollback Plan

### Baseline Metrics (Record Before Any Changes)

Before applying Phase 1, record the following baselines from the most recent 5 sessions:

1. **Ruinor REJECT rate** on Bitsmith output (percentage of reviews resulting in REJECT)
2. **Ruinor REVISE rate** on Bitsmith output (percentage of reviews resulting in REVISE)
3. **Specialist finding count** -- average number of findings per Riskmancer/Windwarden review (when invoked)
4. **Review loop count** -- average number of Bitsmith-Ruinor cycles per task before ACCEPT
5. **Quill/Talekeeper output quality** -- subjective baseline score (acceptable / needs-improvement) on last 3 outputs

### Rollback Triggers and Procedures

#### Phase 1 Rollback (Quill, Talekeeper)

| Metric | Threshold | Rollback Procedure |
|--------|-----------|-------------------|
| Talekeeper output has structural errors (broken Mermaid, missing table rows, malformed markdown) | Any occurrence in first 2 sessions | Revert `model:` field to `claude-sonnet-4-6` (not opus -- sonnet is sufficient fallback for templated work). Re-run affected narrations. |
| Quill output has material inaccuracies or missing sections vs. previous quality | Any occurrence in first 2 sessions | Revert `model:` field to `claude-sonnet-4-6`. Re-run affected documentation task. |

#### Phase 2 Rollback (Windwarden, Everwise)

| Metric | Threshold | Rollback Procedure |
|--------|-----------|-------------------|
| Ruinor REVISE rate on Bitsmith output | 20% relative increase (e.g., baseline 30% → threshold 36%) over baseline across 5 sessions | Revert affected specialist(s) to `model: claude-opus-4-6`. Re-run the most recent specialist review with opus to verify the model was the cause. |
| Specialist finding count | -50% decrease vs. baseline across 3 sessions (e.g., baseline 4 findings avg -> observed 2 or fewer) | Revert affected specialist to opus. Run A/B comparison on same artifact to confirm. |
| A/B comparison reveals material miss | Sonnet review misses a HIGH or CRITICAL finding that opus catches | Revert that specific specialist to opus immediately. Document the finding type for future reference. |
| Post-merge defect attributable to missed specialist review | Any occurrence | Revert all Phase 2 agents to opus. Conduct root cause analysis before re-attempting. |

#### Phase 3 Rollback (Knotcutter)

No rollback needed -- setting Knotcutter explicitly to opus either maintains or improves the current state.

### General Rollback Procedure

1. Edit the `model:` field in the affected agent's `claude/agents/{name}.md` file.
2. No restart or deployment needed -- Claude Code reads agent configs on each invocation.
3. Log the rollback in `plans/open-questions.md` with the metric that triggered it and the session IDs involved.
4. Re-run the most recent review by the affected agent on the same artifact to verify the revert resolves the quality issue.

## Risks and Caveats

### Downgrade Risks

1. **Riskmancer remains on opus (revised).** The initial plan classified Riskmancer as a Tier B checklist agent, but this was reconsidered after Riskmancer self-assessment was requested. Its work is not purely checklist-driven: approximately 60% involves data flow tracing, blast radius analysis, and chained vulnerability detection — contextual judgment tasks, not pattern lookups. Combined with low invocation frequency (minimal savings of ~$1-2/month) and the high-stakes security context every invocation by definition carries, the same logic applied to Knotcutter applies here: low-frequency + high-stakes = keep on opus. No downgrade risk applies.

2. **Windwarden on sonnet may miss non-obvious algorithmic complexity.** Mitigation: Same layered defense as Riskmancer. Ruinor catches baseline performance issues. Windwarden's checklist-driven protocol (N+1, missing indexes, unbounded loops) is well within sonnet's capability. True algorithmic analysis (proving O(n^2) vs O(n log n)) is rare in practice and usually flagged by Ruinor first. Rollback trigger: same as Riskmancer.

3. **Everwise on sonnet may produce lower-quality root cause inferences.** Mitigation: Everwise is advisory-only and manually invoked. Its output goes through human review before any config changes are applied. The structured protocol and fixed JSON schema constrain the output enough that sonnet can follow it reliably. Rollback trigger: subjective quality assessment by user.

4. **Talekeeper on haiku may struggle with edge cases** (malformed JSONL, large sessions, complex filtering logic). Mitigation: The 12-step operational procedure is explicit and mechanical. Validated in Phase 1 before proceeding. Rollback to sonnet if structural errors appear.

5. **Quill on haiku may produce lower-quality prose.** Mitigation: Documentation quality is subjective and easily reviewed. Haiku produces clean, structured Markdown. Rollback to sonnet if quality is insufficient.

### Default Model Uncertainty

Three agents (Knotcutter, Quill, Talekeeper) currently have no `model:` field in their frontmatter. The actual behavior when `model:` is omitted is not documented in this codebase and depends on Claude Code's internal default resolution. Possibilities include:

- Inheriting the parent session's model
- Defaulting to sonnet (Claude Code's standard default for sub-agents)
- Defaulting to the model specified in the CLI invocation

**Implication:** Adding `model: claude-haiku-4-5` to Quill and Talekeeper may represent a downgrade from sonnet (moderate change) or from opus (large change) -- or may not change behavior at all if the default is already haiku. Similarly, adding `model: claude-opus-4-6` to Knotcutter may be a no-op or an upgrade. The phased rollout with validation steps accounts for this uncertainty.

### What NOT to Downgrade

- **Pathfinder must stay on opus.** Bad plans cause exponential rework downstream (failed reviews, botched implementations, review-revise loops). The interview workflow and multi-constraint synthesis require frontier reasoning.

- **Ruinor must stay on opus.** As the mandatory quality gate on every artifact, Ruinor's judgment quality directly determines the false-approval rate of the entire system. The adversarial mode escalation, self-audit, and realist check phases require the kind of nuanced meta-reasoning that distinguishes opus from sonnet.

- **Knotcutter should be set to opus.** Its open-ended architectural reasoning, creative judgment requirements, and active code modification tools place it in the same tier as Pathfinder and Ruinor, not in the same tier as Riskmancer and Windwarden.

## Implementation Notes

Model assignments are set in the YAML frontmatter of each agent file in `claude/agents/*.md`. The `model:` field accepts `claude-opus-4-6`, `claude-sonnet-4-6`, or `claude-haiku-4-5`.

### Phase 1 Changes (Low Risk)
1. `claude/agents/quill.md` -- add `model: claude-haiku-4-5` to frontmatter
2. `claude/agents/talekeeper.md` -- add `model: claude-haiku-4-5` to frontmatter

### Phase 2 Changes (Medium Risk -- apply after Phase 1 validation)
3. `claude/agents/windwarden.md` -- change `model: claude-opus-4-6` to `model: claude-sonnet-4-6`
4. `claude/agents/everwise.md` -- change `model: claude-opus-4-6` to `model: claude-sonnet-4-6`

**Note:** Riskmancer is excluded from Phase 2. Its model was changed to `claude-sonnet-4-6` and then reverted to `claude-opus-4-6` after reconsideration. Riskmancer's work is not purely checklist-driven (~60% is data flow tracing, blast radius analysis, and chained vulnerability detection). Low invocation frequency means savings would be ~$1-2/month — insufficient to justify the quality trade-off for a high-stakes security reviewer. Same logic as Knotcutter applied consistently.

### Phase 3 Change (No Risk -- apply anytime)
6. `claude/agents/knotcutter.md` -- add `model: claude-opus-4-6` to frontmatter

No changes to: pathfinder, ruinor, bitsmith, dungeonmaster.

## A/B Comparison Methodology

For at least one session during Phase 2, perform a manual A/B comparison:

1. After a Windwarden sonnet review completes, note the findings.
2. Temporarily revert the agent to opus and re-run the same review on the same artifact.
3. Compare:
   - Did opus find material issues sonnet missed?
   - Were sonnet's findings accurate (no false positives)?
   - Was the severity assessment consistent?
4. Document results. If opus catches HIGH/CRITICAL findings sonnet missed, trigger rollback per the rollback plan.
5. Revert the agent back to sonnet after the comparison (unless rollback is triggered).

Note: Riskmancer is excluded from A/B comparison scope — it remains on opus.

This provides empirical evidence rather than relying solely on theoretical reasoning about model capabilities.

## Success Criteria

- Phase 1 agents (Quill, Talekeeper) produce acceptable output on haiku for 2+ sessions
- Phase 2 agents (Windwarden, Everwise) produce comparable findings on sonnet for 5+ sessions
- Ruinor REJECT/REVISE rate does not increase by more than 20% over baseline
- A/B comparison shows no material findings gap for at least one specialist
- Knotcutter is explicitly assigned to opus with documented rationale
- All rollback triggers are defined with numeric thresholds before changes are applied
