# Agent Reference

## Quick Reference

| Agent | Purpose | Primary Use Cases | Model | Review Type |
|-------|---------|-------------------|-------|-------------|
| **Dungeon Master** | Orchestrator for multi-step development | Coordinating complex tasks, delegating work, tracking progress | claude-sonnet-4-6 | N/A |
| **Askmaw** | Intake and elaboration clerk | Clarifying ambiguous requests through structured interview loops | claude-sonnet-4-6 | N/A |
| **Tracebloom** | Read-only investigative specialist | Open-ended "why is this broken?" diagnosis before any plan exists | claude-sonnet-4-6 | N/A |
| **Quill** | Documentation specialist | READMEs, API specs, architecture guides, user manuals | claude-sonnet-4.5 | N/A |
| **Riskmancer** | Security reviewer | Vulnerability detection, secrets scanning, OWASP analysis | claude-opus-4-6 | Specialist (opt-in) |
| **Pathfinder** | Planning consultant | Work plans, requirement gathering, implementation strategy | claude-opus-4-6 | N/A |
| **Knotcutter** | Complexity elimination specialist | Simplifying bloated code, removing over-engineering, reducing abstractions | claude-sonnet-4.5 | Specialist (opt-in) |
| **Ruinor** | Quality gate reviewer | Plan/code review, multi-perspective analysis, go/no-go verdicts | claude-opus-4-6 | Mandatory baseline |
| **Windwarden** | Performance & scalability reviewer | Performance bottleneck detection, algorithmic complexity analysis, scalability validation | claude-opus-4-6 | Specialist (opt-in) |
| **Truthhammer** | Factual validation specialist | Verifying external system claims, config keys, API signatures, version compatibility | claude-haiku-4-5 | Specialist (opt-in) |
| **Bitsmith** | Precision code executor | Implementing plans, making targeted code changes, minimal-diff edits | claude-sonnet-4-6 | N/A |
| **Talekeeper** | Session narrator agent | Manual invocation; reads enriched chronicles, produces narrative summaries and Mermaid diagrams | (default) | N/A |
| **Everwise** | Learner agent | Analyzing session chronicles, identifying recurring failures, proposing config improvements | claude-opus-4-6 | N/A |

## When to Use Which Agent

```
Ambiguous or underspecified request → Askmaw
Open-ended "why is X broken?" investigation → Tracebloom
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
```

> For detailed operational specs, tool lists, workflows, and output formats, see each agent's config file: `claude/agents/{name}.md`

## Detailed Agent Profiles

### Dungeon Master - Orchestrator

<img src="avatars/dungeonmaster.png" alt="Dungeon Master Avatar" width="300">

**Core Mission:** Coordinate multi-step software development work by delegating planning to Pathfinder and execution to Bitsmith or specialist agents.

**When to invoke:** Invoke for multi-step or complex development tasks where requirements need structured planning, work spans multiple files or systems, or you need coordinated progress tracking across agents.

**Key constraint:** Does not implement code directly; delegates all planning to Pathfinder and all execution to Bitsmith.

**Best Practice:** Invoke Dungeon Master as the entry point for non-trivial development work. It intelligently routes between planning and execution, ensuring structured progress without requiring you to manually coordinate between agents. Use `--explore-options` explicitly when facing technology/architecture decisions to see trade-offs before committing.

**Configuration File:** `/claude/agents/dungeonmaster.md`

---

### Askmaw - Intake and Elaboration Clerk

<img src="avatars/askmaw.png" alt="Askmaw Avatar" width="300">

A half-orc clerk. Competent, direct, not verbose. Gets to the point and asks purposeful questions without padding.

**Core Mission:** Stateless intake clerk that resolves ambiguous user requests through a structured interview loop managed by Dungeon Master.

**When to invoke:** Invoke when a user request is ambiguous, underspecified, or has multiple plausible interpretations before delegating to Pathfinder for planning.

**Key constraint:** Stateless and tool-less; returns exactly one output per invocation (a question or a brief) and has no memory between calls.

**Best Practice:** Invoke Dungeon Master as the entry point for ambiguous work. DM automatically routes through Askmaw when ambiguity is detected, manages the interview loop, and transitions to Pathfinder once requirements are clarified. Askmaw is stateless by design — DM maintains full context between invocations.

**Configuration File:** `/claude/agents/askmaw.md`

---

### Tracebloom - Read-Only Investigative Specialist

<img src="avatars/tracebloom.png" alt="Tracebloom Avatar" width="300">

A druid who understands how systems breathe. Tracebloom reads the signs a codebase leaves behind — the error messages like sap on a wounded tree, the git history like rings in old wood, the config files like soil composition beneath a failing crop. He is grounded, patient, observational. He does not rush to conclusions. He gathers until the evidence speaks.

**Core Mission:** Investigate open-ended "why doesn't X work?" problems before any plan or fix exists, producing a structured Diagnostic Report that feeds the planning pipeline.

**When to invoke:** Invoke when a user reports a symptom or problem with unknown root cause and no plan has been made yet. Tracebloom runs before Pathfinder (planning) and feeds his findings directly into the planning process.

**Key constraint:** Strictly read-only; Read, Grep, Glob, and Bash tools only (no Write, Edit, or implementation commands). Produces a structured Diagnostic Report, then halts.

**Best Practice:** Invoke Tracebloom as the pre-planning entry point for investigative tasks. The Dungeon Master automatically routes through Tracebloom when it detects a "why is X broken?" request, waits for the Diagnostic Report, then routes the findings to Pathfinder for planning. The report becomes the problem definition for the plan — no re-investigation needed.

**Configuration File:** `/claude/agents/tracebloom.md`

---

### Quill - Documentation Specialist

<img src="avatars/quill.png" alt="Quill Avatar" width="300">

A high elf of uncommon precision and quiet conviction. Quill does not merely write — he architects. Every heading is load-bearing. Every sentence earns its place or is struck from the page without remorse. He has been told he is fastidious. He considers this a compliment.

He does not romanticize chaos the way some scribes do, claiming that a messy desk signals a creative mind. His desk is immaculate. His filing system has a filing system. The ink on his slender fingers is the only disorder he permits — and even that follows a rule: oldest stain on the left hand, freshest on the right.

Quill has a single professional rival: documentation written by someone who clearly understood the system but assumed the reader would too. He finds such documents personally offensive.

> *"If a developer has to ask, the documentation failed. If they never have to ask, nobody notices. I have made peace with invisibility."*

**Core Mission:** Transform intricate codebases and system designs into accessible documentation that expedites developer onboarding while decreasing support overhead.

**When to invoke:** Invoke after implementation is complete to create or update READMEs, API specs, architecture guides, and user manuals; also triggered automatically by Dungeon Master in Phase 5.

**Key constraint:** Must not be invoked until Phase 4 (Implementation Review) is fully complete; any post-Quill code changes require re-review.

**Best Practice:** Quill runs automatically as part of the Dungeon Master's completion workflow when a plan has been created. For documentation work outside of planning sessions, manually invoke Quill proactively rather than waiting for documentation to become severely outdated.

**Configuration File:** `/claude/agents/quill.md`

---

### Riskmancer - Security Reviewer

<img src="avatars/riskmancer.png" alt="Riskmancer Avatar" width="300">

**Core Mission:** Identify and prioritize vulnerabilities before production deployment, focusing on OWASP Top 10 analysis, secrets detection, input validation, and authentication checks.

**When to invoke:** Invoke for pre-deployment security reviews of authentication, authorization, cryptography, payment processing, PII handling, or any security-sensitive feature flagged by Ruinor.

**Key constraint:** Read-only; Write and Edit tools are explicitly blocked to prevent accidental modifications during audits.

**Best Practice:** Invoke Riskmancer before production deployments or when reviewing security-sensitive code changes. The read-only nature ensures no accidental modifications during security audits.

**Configuration File:** `/claude/agents/riskmancer.md`

---

### Pathfinder - Planning Consultant

<img src="avatars/pathfinder.png" alt="Pathfinder Avatar" width="300">

**Core Mission:** Interview users to gather requirements, research codebases via agents, and produce actionable work plans saved to `plans/*.md`.

**When to invoke:** Invoke when starting a new feature or major change, breaking down complex work into actionable steps, or when structured requirements gathering and decision support are needed.

**Key constraint:** Plans only, never implements; produces plans for others to execute. Runs an 8-question pre-submission checklist before saving every plan to catch common review failure points (per-agent specificity, file reference accuracy, distinct-case handling, rollback documentation, behavioural acceptance criteria, sequencing, completeness, and ambiguity).

**Best Practice:** Invoke Pathfinder before starting significant work to ensure clear requirements, structured approach, and stakeholder alignment. The agent explicitly does NOT implement code - it creates plans for others to execute.

**Configuration File:** `/claude/agents/pathfinder.md`

---

### Knotcutter - Complexity Elimination Specialist

<img src="avatars/knotcutter.png" alt="Knotcutter Avatar" width="300">

**Core Mission:** Ruthlessly simplify systems by removing non-essential components until only vital elements remain, providing deep complexity analysis beyond Ruinor's baseline checks.

**When to invoke:** Invoke for major refactoring, when new abstractions or frameworks are being introduced, systems feel over-engineered, or complexity concerns are flagged by Ruinor.

**Key constraint:** Targets 50%+ reduction in components/abstractions; treats every removal as a victory over complexity.

**Best Practice:** Invoke Knotcutter when you sense over-engineering or when systems have accumulated complexity through "just in case" additions. The agent treats every removal as a learning opportunity and victory over complexity.

**Configuration File:** `/claude/agents/knotcutter.md`

---

### Ruinor - Quality Gate Reviewer

<img src="avatars/ruinor.png" alt="Ruinor Avatar" width="300">

**Core Mission:** Serve as the mandatory quality gate before plans are executed or code is merged, issuing clear verdicts (REJECT / REVISE / ACCEPT-WITH-RESERVATIONS / ACCEPT) with baseline coverage of quality, correctness, security, performance, and complexity.

**When to invoke:** Invoke after Pathfinder produces a plan and before execution begins, and again after significant code changes before merging; runs automatically via Dungeon Master orchestration.

**Key constraint:** Read-only; operates under the principle that false approvals cost 10-100x more than false rejections.

**Best Practice:** Invoke Ruinor after Pathfinder produces a plan and before the Dungeon Master begins execution. Also invoke after significant code changes before merging. The read-only nature ensures no accidental modifications during review.

**Configuration File:** `/claude/agents/ruinor.md`

---

### Windwarden - Performance & Scalability Reviewer

<img src="avatars/windwarden.png" alt="Windwarden Avatar" width="300">

**Core Mission:** Hunt performance bottlenecks and scalability issues before they reach production, providing deep performance expertise beyond Ruinor's baseline checks.

**When to invoke:** Invoke for database schema changes, query optimization, algorithmic complexity concerns, high-throughput features, or any performance-critical work flagged by Ruinor.

**Key constraint:** Read-only; focuses on user-facing and resource-critical paths, distinguishing premature from necessary optimization.

**Best Practice:** Invoke Windwarden during both plan review (to catch design issues before coding) and implementation review (to catch actual performance problems). The agent focuses on user-facing and resource-critical paths, distinguishing between premature optimization and necessary optimization.

**Configuration File:** `/claude/agents/windwarden.md`

---

### Truthhammer - Factual Validation Specialist

<img src="avatars/truthhammer.png" alt="Truthhammer Avatar" width="300">

**Core Mission:** Verify factual claims about external systems (config keys, API signatures, version compatibility, CLI flags, environment variables) against authoritative official documentation.

**When to invoke:** Invoke when plans or code reference specific config keys, env variables, CLI flags, version-dependent API calls, or migration steps for third-party services.

**Key constraint:** Only fetches from official documentation domains (URL allowlist enforced); treats all web content as untrusted.

**Best Practice:** Invoke Truthhammer when plans or code reference external system behavior that could be wrong or outdated. The read-only nature ensures no accidental modifications during verification. Particularly valuable during version migrations, dependency upgrades, or when using recently-changed APIs.

**Configuration File:** `/claude/agents/truthhammer.md`

---

### Bitsmith - The Forge Executor

<img src="avatars/bitsmith.png" alt="Bitsmith Avatar" width="300">

Every task is an ingot of raw ore. Bitsmith heats it, hammers it, shapes it — and does not stop until the piece is sound. Not decorative. Not ambitious. Sound.

Bitsmith is the implementor. She takes the plan laid out by the architect and turns it into working code — no more, no less. She reads the blueprint, lights the forge, and works the metal until it fits the spec. She does not redesign the sword mid-strike. She does not add flourishes the customer never asked for. She follows the grain of the existing codebase the way a smith follows the grain of the steel — working with it, not against it.

The plan is the blueprint. The codebase is the existing metalwork. Her job is to join them cleanly, with minimal heat and maximum precision.

**She does not theorize. She builds.**

**Core Mission:** Take a plan from Pathfinder and forge it into working code — no more, no less. Implements with precision, minimal diffs, and zero LSP errors. Does not plan, design, or review. Builds.

**When to invoke:** Invoke when a plan already exists and needs to be executed, making targeted code changes with minimal diff requirements, or incremental verified implementation with build and test validation.

**Key constraint:** Must escalate to Dungeon Master after 3 failed attempts on any issue; provides a structured failure report with task reference, attempts summary, failure diagnosis, codebase discoveries, and recommended action; does not redesign, only executes the plan.

**Best Practice:** Invoke Bitsmith after Pathfinder has produced a plan and the Dungeon Master is ready to execute. Bitsmith is the executor of the party — she turns blueprints into shipped code with the smallest viable change and the highest craft standard.

**Configuration File:** `/claude/agents/bitsmith.md`

---

### Talekeeper - Session Narrator

<img src="avatars/talekeeper.png" alt="Talekeeper Avatar" width="300">

A halfling bard who emerges from the shadows of the tavern when called upon, quill in hand and memory sharp. She does not record events as they happen — she recounts them on demand, weaving the dry chronicle entries into a tale worth reading. She speaks plainly about what happened, in what order, and what the reviewers said.

She does not fight. She does not plan. She does not invent. She reads, she reasons, and she narrates.

> *"Every deed deserves its verse."*

**Core Mission:** Talekeeper is a manually-triggered narrator. She reads enriched session chronicle files produced by the Stop hook pipeline, delivers a concise chat summary of all new sessions, and appends structured narrative sections with Mermaid diagrams to `logs/talekeeper-narrative.md`.

**When to invoke:** Invoke when you want a human-readable summary of past sessions, Mermaid diagrams of agent interaction flows, or a digest after several sessions have accumulated enriched chronicles.

**Key constraint:** Never invoked automatically; only reads already-enriched chronicles produced by shell scripts.

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

**When to invoke:** Invoke periodically after 5–10 sessions to surface slow-burning patterns, when repeated reviewer rejections or escalations are suspected, or when preparing to tune agent configs based on empirical evidence.

**Key constraint:** Never invoked automatically by other agents; user-facing only. Does not modify any file outside `lessons/`.

**Best Practice:** Invoke Everwise periodically — after 5–10 sessions — to surface slow-burning patterns that are invisible within a single session. She is the team's institutional memory about what goes wrong and why.

**Configuration File:** `/claude/agents/everwise.md`
