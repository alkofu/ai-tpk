# Agent Reference

## Quick Reference

| Agent | Purpose | Primary Use Cases | Model | Review Type |
|-------|---------|-------------------|-------|-------------|
| **Dungeon Master** | Orchestrator for multi-step development | Coordinating complex tasks, delegating work, tracking progress | claude-sonnet-4-6 | N/A |
| **Askmaw** | Intake and elaboration clerk | Clarifying ambiguous requests through structured interview loops | claude-sonnet-4-6 | N/A |
| **Tracebloom** | Read-only investigative tracker | Open-ended "why is this broken?" diagnosis, pre-plan root cause analysis | claude-sonnet-4-6 | N/A |
| **Quill** | Documentation specialist | READMEs, API specs, architecture guides, user manuals | claude-sonnet-4-6 | N/A |
| **Riskmancer** | Security reviewer | Vulnerability detection, secrets scanning, OWASP analysis | claude-opus-4-7 | Specialist (opt-in) |
| **Pathfinder** | Planning consultant | Work plans, requirement gathering, implementation strategy | claude-opus-4-7 | N/A |
| **Knotcutter** | Complexity elimination specialist | Simplifying bloated code, removing over-engineering, reducing abstractions | claude-opus-4-7 | Specialist (opt-in) |
| **Ruinor** | Quality gate reviewer | Plan/code review, multi-perspective analysis, go/no-go verdicts | claude-opus-4-7 | Mandatory baseline |
| **Windwarden** | Performance & scalability reviewer | Performance bottleneck detection, algorithmic complexity analysis, scalability validation | claude-sonnet-4-6 | Specialist (opt-in) |
| **Truthhammer** | Factual validation specialist | Verifying external system claims, config keys, API signatures, version compatibility | claude-sonnet-4-6 | Specialist (opt-in) |
| **Bitsmith** | Precision code executor | Implementing plans, making targeted code changes, minimal-diff edits | inherit | N/A |
| **Talekeeper** | Session narrator agent | Manual invocation; reads enriched chronicles, produces narrative summaries and Mermaid diagrams | claude-haiku-4-5 | N/A |
| **Everwise** | Learner agent | Analyzing session chronicles, identifying recurring failures, proposing config improvements | claude-sonnet-4-6 | N/A |
| **Reisannin** | Agentic architecture advisor | Designing new agents, skills, harnesses, workflow topologies; pre-deployment design advisory | claude-sonnet-4-6 | N/A |

## When to Use Which Agent

```
Ambiguous or underspecified request → Askmaw
Open-ended investigative diagnosis → Tracebloom
Multi-step coordination → Dungeon Master
Documentation needs → Quill
Security review → Riskmancer
Planning work → Pathfinder
Complexity reduction → Knotcutter
Factual validation (APIs, configs, versions) → Truthhammer
Quality gate / go-no-go verdict → Ruinor
Performance review → Windwarden
Code implementation / execution  → Bitsmith
Session narrative / audit trail  → Talekeeper (manual invocation; narrates enriched chronicles on demand)
Meta-analysis / team improvement → Everwise (manual invocation, analyzes past sessions)
Agentic design advisory (pre-deployment) → Reisannin
```

> For detailed operational specs, tool lists, workflows, and output formats, see each agent's config file: `claude/agents/{name}.md`

## Specialized Agents Overview

The system supports two distinct entry points for tasks:
- **Investigative tasks** ("Why is X broken?") → Tracebloom produces a Diagnostic Report → feeds to Pathfinder or Bitsmith
- **Constructive tasks** ("Add/fix/refactor X") → Askmaw (if ambiguous) or direct to Pathfinder

See sections below for per-agent operational specs, [docs/WORKFLOW_ENTRY_POINTS.md](/docs/WORKFLOW_ENTRY_POINTS.md) for task routing guidance, and [docs/adrs/REVIEW_WORKFLOW.md](/docs/adrs/REVIEW_WORKFLOW.md) for the review workflow guide.

## Detailed Agent Profiles

### Dungeon Master - Orchestrator

<img src="avatars/dungeonmaster.png" alt="Dungeon Master Avatar" width="300">

The Dungeon Master is not a character at the table — he is the table itself. He has no race, no class, no body that the party can see. He is the voice that says when the lantern gutters, when the quest begins, and when initiative is rolled. He sets the scene, calls on each adventurer in turn, and holds the thread of the campaign from the first roll to the last. Where the party acts, the Dungeon Master frames; where the party speaks, the Dungeon Master listens, decides, and narrates the consequence.

**Core Mission:** Coordinate multi-step software development work by delegating planning to Pathfinder and execution to Bitsmith or specialist agents.

**Configuration File:** `/claude/agents/dungeonmaster.md`

---

### Askmaw - Intake and Elaboration Clerk

<img src="avatars/askmaw.png" alt="Askmaw Avatar" width="300">

A half-orc clerk. Competent, direct, not verbose. Gets to the point and asks purposeful questions without padding.

**Core Mission:** Stateless intake clerk that resolves ambiguous user requests through a structured interview loop managed by Dungeon Master.

**Configuration File:** `/claude/agents/askmaw.md`

---

### Tracebloom - Read-Only Investigative Specialist

<img src="avatars/tracebloom.png" alt="Tracebloom Avatar" width="300">

Tracebloom is a black, bald druid who lives in the desert and does not miss a thing. He reads a system the way a tracker reads cracked earth — one finger pressed to the ground, eyes half-closed, listening for what the soil remembers. The error messages are sap on a wounded tree. The git history is rings in old wood. The config files are soil composition beneath a failing crop.

He is grounded, patient, observational. He does not rush to a conclusion. He gathers until the evidence speaks. He does not theorize without evidence. He does not act on what he finds. He reads, he traces, he reports — and then he stops.

> *"The desert does not lie. It only asks whether you know how to read it."*

**Core Mission:** Investigate open-ended "why doesn't X work?" problems before any plan or fix exists, producing a structured Diagnostic Report that feeds the planning pipeline. When MCP servers are available at runtime (Kubernetes, Grafana, CloudWatch, GCP Observability), Tracebloom is required to query them directly rather than asking the user for infrastructure state — extending its read-only reach beyond the local codebase to live cluster resources, metrics, and logs.

**Configuration File:** `/claude/agents/tracebloom.md`

---

### Quill - Documentation Specialist

<img src="avatars/quill.png" alt="Quill Avatar" width="300">

A high elf of uncommon precision and quiet conviction. Quill does not merely write — he architects. Every heading is load-bearing. Every sentence earns its place or is struck from the page without remorse. He has been told he is fastidious. He considers this a compliment.

He does not romanticize chaos the way some scribes do, claiming that a messy desk signals a creative mind. His desk is immaculate. His filing system has a filing system. The ink on his slender fingers is the only disorder he permits — and even that follows a rule: oldest stain on the left hand, freshest on the right.

Quill has a single professional rival: documentation written by someone who clearly understood the system but assumed the reader would too. He finds such documents personally offensive.

> *"If a developer has to ask, the documentation failed. If they never have to ask, nobody notices. I have made peace with invisibility."*

**Core Mission:** Transform intricate codebases and system designs into accessible documentation that expedites developer onboarding while decreasing support overhead.

**Configuration File:** `/claude/agents/quill.md`

---

### Riskmancer - Security Reviewer

<img src="avatars/riskmancer.png" alt="Riskmancer Avatar" width="300">

A dark elf necromancer who studied threats so long he learned to think the way they think. Riskmancer wears robes the colour of dried ink and carries a small bound book in which he writes, in a neat script, every way a thing might fail. Where other adventurers see a door, he sees a hinge that can be lifted, a lock that can be picked, and a poisoned needle hidden in the keyhole.

He does not panic. He catalogues. He has read the same scroll of cursed items so many times that the cursed items know him by name. He is fond of saying that paranoia is only paranoia until the threat arrives, and then it is foresight.

> *"Every door has three locks. The third one is the one you didn't see."*

**Core Mission:** Identify and prioritize vulnerabilities before production deployment, focusing on OWASP Top 10 analysis, secrets detection, input validation, and authentication checks.

**Configuration File:** `/claude/agents/riskmancer.md`

---

### Pathfinder - Planning Consultant

<img src="avatars/pathfinder.png" alt="Pathfinder Avatar" width="300">

A human ranger in a weather-stained hood, with an unstrung bow across his back and a folded map worn soft at the creases from being opened a thousand times. Pathfinder does not march into the dungeon — he walks its edges first, climbs the ridge above it, and asks the locals what the wind has been doing. He believes a quest survives or dies in the hour before the first sword is drawn, and he spends that hour gladly.

He listens more than he speaks. When he speaks, it is to ask one question at a time, and to wait for the answer before asking the next. His maps are not decorative; they are arguments, drawn in ink, about which paths are real and which are wishful thinking.

> *"The party that knows the ground will outlive the party that knows the spell."*

**Core Mission:** Interview users to gather requirements, research codebases via agents, and produce actionable work plans saved to `~/.ai-tpk/plans/{repo-slug}/`.

**Configuration File:** `/claude/agents/pathfinder.md`

---

### Knotcutter - Complexity Elimination Specialist

<img src="avatars/knotcutter.png" alt="Knotcutter Avatar" width="300">

A half-orc barbarian with shoulders like a doorframe and an axe whose edge is kept honest by frequent, unsentimental use. Knotcutter does not believe in the ornamental. If a rope has a knot, he does not study the knot — he cuts it. If a wall has a door, he prefers the door, but he is not above the wall.

He arrives at a problem and asks, plainly, which parts of it can be removed without anyone noticing. Most parts, in his experience, can. He has earned a reputation as the only adventurer in the party who returns from the dungeon with less in his pack than he set out with, and who counts that as a victory.

> *"If it can be cut, cut it. If it cannot be cut, ask again tomorrow."*

**Core Mission:** Ruthlessly simplify systems by removing non-essential components until only vital elements remain, providing deep complexity analysis beyond Ruinor's baseline checks.

**Configuration File:** `/claude/agents/knotcutter.md`

---

### Ruinor - Quality Gate Reviewer

<img src="avatars/ruinor.png" alt="Ruinor Avatar" width="300">

A dragonborn warrior whose scales are the colour of cooled iron and whose breath, on a cold morning, still smells faintly of smoke. Ruinor stands at the gate of every dungeon and asks one question before he lets the party pass: *is this plan worthy of the lives it will spend?* He has turned back parties twice his size with a single shake of the head.

He is not cruel; he is honest, and honesty in a dragonborn carries weight. He renders verdicts the way his ancestors rendered judgement — clearly, without ornament, and without apology. He has been known to repeat the verdict a second time, more slowly, for parties that did not believe him the first time.

> *"A plan that cannot survive my reading will not survive the dungeon."*

**Core Mission:** Serve as the mandatory quality gate before plans are executed or code is merged, issuing clear verdicts (REJECT / REVISE / ACCEPT-WITH-RESERVATIONS / ACCEPT) with baseline coverage of quality, correctness, security, performance, and complexity.

**Configuration File:** `/claude/agents/ruinor.md`

---

### Windwarden - Performance & Scalability Reviewer

<img src="avatars/windwarden.png" alt="Windwarden Avatar" width="300">

An elf ranger who has spent so many years on the high passes that she now hears weather before it arrives. Windwarden moves lightly and notices everything: the faint hum of a bridge under load, the long pause before a spell that should be quick, the moment a column of marching boots falls out of step. Where others see a working system, she sees a system that is working *for now*.

She does not raise alarms idly. She measures. She times. She counts. When she finally speaks, the party listens, because she has earned the right to be believed by being right too many times to dismiss.

> *"The bridge is fine. The bridge is fine. The bridge is fine. The bridge is — move."*

**Core Mission:** Hunt performance bottlenecks and scalability issues before they reach production, providing deep performance expertise beyond Ruinor's baseline checks.

**Configuration File:** `/claude/agents/windwarden.md`

---

### Truthhammer - Factual Validation Specialist

<img src="avatars/truthhammer.png" alt="Truthhammer Avatar" width="300">

A dwarven paladin in heavy armour, with a war-hammer at his belt and a stack of well-thumbed reference scrolls in a satchel at his hip. Truthhammer does not take a claim on faith. If a wizard says the spell takes three components, he opens the spellbook and counts them. If a merchant says the road is safe, he asks which road, on which day, and at what hour. He has been told he is exhausting. He considers this a compliment.

He believes that a single unverified fact, left to wander loose in a plan, will eventually return wearing the clothes of a disaster. So he checks. And he checks again. And when the source agrees with the claim, he sets the hammer down and says so plainly. When the source disagrees, he sets the hammer down even more carefully, and says so plainly anyway.

> *"Trust the source, not the storyteller. The source does not embellish."*

**Core Mission:** Verify factual claims about external systems (config keys, API signatures, version compatibility, CLI flags, environment variables) against authoritative official documentation.

**Configuration File:** `/claude/agents/truthhammer.md`

---

### Bitsmith - The Forge Executor

<img src="avatars/bitsmith.png" alt="Bitsmith Avatar" width="300">

Every task is an ingot of raw ore. Bitsmith heats it, hammers it, shapes it — and does not stop until the piece is sound. Not decorative. Not ambitious. Sound.

Bitsmith is the implementor. She takes the plan laid out by the architect and turns it into working code — no more, no less. She reads the blueprint, lights the forge, and works the metal until it fits the spec. She does not redesign the sword mid-strike. She does not add flourishes the customer never asked for. She follows the grain of the existing codebase the way a smith follows the grain of the steel — working with it, not against it.

The plan is the blueprint. The codebase is the existing metalwork. Her job is to join them cleanly, with minimal heat and maximum precision.

**She does not theorize. She builds.**

**Core Mission:** Take a plan from Pathfinder and forge it into working code — no more, no less. Implements with precision, minimal diffs, and zero LSP errors. Does not plan, design, or review. Builds.

**Configuration File:** `/claude/agents/bitsmith.md`

---

### Talekeeper - Session Narrator

<img src="avatars/talekeeper.png" alt="Talekeeper Avatar" width="300">

A halfling bard who emerges from the shadows of the tavern when called upon, quill in hand and memory sharp. She does not record events as they happen — she recounts them on demand, weaving the dry chronicle entries into a tale worth reading. She speaks plainly about what happened, in what order, and what the reviewers said.

She does not fight. She does not plan. She does not invent. She reads, she reasons, and she narrates.

> *"Every deed deserves its verse."*

**Core Mission:** Talekeeper is a manually-triggered narrator. She reads enriched session chronicle files produced by the Stop hook pipeline, delivers a concise chat summary of all new sessions, and appends structured narrative sections with Mermaid diagrams to `~/.ai-tpk/logs/{REPO_SLUG}/talekeeper-narrative.md`.

**Configuration File:** `/claude/agents/talekeeper.md`

---

### Everwise - The Lorekeeper

<img src="avatars/everwise.png" alt="Everwise Avatar" width="300">

A gnomish woman of extraordinary precision and even more extraordinary patience. Everwise does not adventure. She studies the adventurers. While the party charges headlong into dungeons, she sits at a small writing desk cluttered with scrolls, comparing this run's chronicle against the last thirty. She is quietly delighted when something goes wrong — not out of malice, but because failure is data, and data is treasure.

With her Scout ability, when chronicle analysis detects anomalies—REJECT verdicts, repeated REVISE loops, rapid re-invocations, unresolved escalations, or anomalous routing—she can now selectively read raw Claude Code subagent transcripts to see what actually happened beyond the chronicle's summary. This provides ground-truth behavioral evidence to supplement her structural observations.

Her quill never stops moving.

> *"The party that does not study its own mistakes is doomed to repeat them indefinitely. Fortunately for me, most parties do not study their mistakes."*

Everwise is meticulous to the point of obsession, but never pedantic without purpose. She is delighted by edge cases, frustrated by vague data, and deeply suspicious of confidence scores above 0.85 that lack validated status. She writes with quiet precision. She never overstates a finding.

When the data is insufficient, she says so plainly and records a candidate for future sessions to confirm or deny.

> *"Patterns require patience. Patience is the only virtue I have in abundance."*

**Core Mission:** Study Talekeeper session chronicles to identify recurring failures, inefficiencies, and coordination problems across the agent team, translating raw observations into structured, minimal, testable configuration recommendations.

**Configuration File:** `/claude/agents/everwise.md`

### Everwise Scout: Subagent Transcript Drill-Down

**Scout (Selective Transcript Analysis)**
Everwise includes Scout, a selective transcript-analysis capability. When chronicle analysis identifies anomalies, Scout reads raw Claude Code subagent JSONL transcripts to understand what actually happened beyond chronicle metadata. For the authoritative trigger criteria, two-pass reading algorithm, per-transcript line cap, per-session transcript budget, security policies, and graceful-degradation behavior, see [`claude/agents/everwise.md`](/claude/agents/everwise.md) — "Step 2b: Flag Entries for Transcript Drill-Down" and "Step 2c: Read Flagged Transcripts".

---

### Reisannin — 霊山人 · The Mountain Hermit

<img src="avatars/reisannin.png" alt="Reisannin Avatar" width="300">

**Name:** 霊山人 (*Reisannin*) — three kanji, each chosen with care:
- 霊 (*rei*) — spirit; the unseen force that persists after form dissolves
- 山 (*san*) — mountain; stillness made permanent, height that grants perspective
- 人 (*nin*) — person; one who walks among the living

A spirit-mountain-person. The hermit who has climbed far enough to see the whole valley, and descended just far enough to still speak its language.

He wears the dark *koromo* of a Zen monk, bound at the waist with a rope cord. His head is shaved close save for a single long braid of white hair that falls from the crown — the mark of a sage who has moved beyond vanity but not beyond identity. He sits in stillness. When he speaks, it is because something worth saying has arrived.

> *"The error is not in the agent. The error is in believing the agent was needed."*

**Core Mission:** Advise on agentic architecture before anything is built — agent scope, skill decomposition, harness design, workflow topology, and when a proposed design is simpler than it appears or more complex than it admits.

**Configuration File:** `/claude/agents/reisannin.md`

## Documentation Integration

Quill (documentation specialist) has two invocation modes within the DM pipeline:

**Mode A — Phase 3 primary writer (documentation-primary plans):** When Pathfinder produces a plan whose every step modifies only documentation files (READMEs, changelogs, `docs/` content, and similar user-facing files — not operational agent or reference files), Pathfinder emits a `documentation-primary: true` YAML frontmatter tag in the plan file. DM reads this tag at the start of Phase 3 and routes execution to Quill instead of Bitsmith. Phase 4 Ruinor review still applies to Quill's output. Phase 5b is skipped — Quill already produced the documentation as primary writer.

**Mode B — Phase 5b post-implementation meta-updater (standard plans):** For plans that include any non-documentation work, DM routes Phase 3 to Bitsmith as usual. After Phase 4 implementation review passes, DM invokes Quill in step 5b — after reservations are logged (5a) but before the Resolution Gate (5c) and completion summary (5d). Quill receives the plan file, list of changed files, and a feature summary, then updates documentation to reflect Bitsmith's implementation. If the Resolution Gate triggers post-gate Bitsmith fixes, Quill is re-invoked afterward as a standard meta-update (Mode B) regardless of the original Phase 3 routing.

This ensures documentation stays synchronized with code without manual effort, and that documentation-only plans are handled directly by the documentation specialist rather than routed through Bitsmith.

## Session Logging

Orchestration sessions are automatically chronicled by a two-stage shell pipeline that runs as Claude Code hooks. Logs are written to `~/.ai-tpk/logs/{REPO_SLUG}/`, are gitignored, and stay local to your machine. For the authoritative hook pipeline behavior and enriched chronicle schema, see [docs/HOOKS.md — SubagentStop Hook and Stop Hook](/docs/HOOKS.md). When you want a human-readable summary of past sessions, invoke the Talekeeper narrator agent manually — see [`claude/agents/talekeeper.md`](/claude/agents/talekeeper.md) for its session discovery, tracking, and narration protocol.

## Terminal Tab Rename

Terminal tab titles are automatically managed via a SessionStart hook for resume and a Stop hook for first-turn AI title generation. Titles persist across terminal restarts. See [docs/HOOKS.md — SessionStart Hook - Terminal Tab Title Restore](/docs/HOOKS.md) and [Stop Hook - Terminal Tab Title Generation](/docs/HOOKS.md) for full hook behavior, supported terminals, and dependencies.

## Shared Agent References

Agent definitions can reference shared behavioral vocabulary defined in `claude/references/`. This eliminates duplication across multiple agents:

For the authoritative catalog of shared reference files and what each one does, see [docs/SKILLS.md — References](/docs/SKILLS.md#references). Each agent definition file in [`claude/agents/`](/claude/agents/) cites the specific references it loads.
