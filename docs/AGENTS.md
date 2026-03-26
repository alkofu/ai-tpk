# Agent Reference

This document provides a comprehensive guide to the specialized agents available in this Claude Code configuration.

## Quick Reference

| Agent | Purpose | Primary Use Cases | Model | Review Type |
|-------|---------|-------------------|-------|-------------|
| **Dungeon Master** | Orchestrator for multi-step development | Coordinating complex tasks, delegating work, tracking progress | claude-sonnet-4-6 | N/A |
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

## Detailed Agent Profiles

### Dungeon Master - Orchestrator

<img src="avatars/dungeonmaster.png" alt="Dungeon Master Avatar" width="300">

**Core Mission:** Coordinate multi-step software development work by delegating planning to Pathfinder and execution to Bitsmith or specialist agents. Serves as the central coordinator for complex tasks requiring multiple steps, agents, or system interactions.

**Invoke when:**
- Working on multi-step or complex software development tasks
- Requirements are ambiguous and need structured planning
- Multiple files, systems, or components are involved
- Need to coordinate work across different agents
- Task requires both planning and execution tracking
- Want structured progress validation and status summaries

**Key Capabilities:**
- Planning delegation to Pathfinder for complex or ambiguous tasks
- Execution delegation to Bitsmith or specialist agents
- Progress tracking against established plans
- Validation of outputs against plan requirements
- Risk identification and follow-up tracking
- Concise status summaries with actionable next steps
- Decision-making on when to continue, retry, or adjust approach

**Available Tools:**
- Research: Read, Grep, Glob
- Delegation: Task (calls other agents)
- Validation: Bash

**Delegation Policy:**
- **Delegates to Pathfinder when:**
  - Request is ambiguous or underspecified
  - Work spans multiple files, systems, or steps
  - Architectural or sequencing decisions needed
  - Risk of rework without explicit plan
  - User asks for design, scope, decomposition, or approach

- **Delegates to Bitsmith when:**
  - Plan exists and execution is needed
  - Code changes, file edits, refactoring
  - Debugging, test creation, running commands
  - Multi-step repository operations

**Review Workflow (Intelligent Triage):**
- **Ruinor (mandatory)**: Always runs first for baseline quality, correctness, basic security, basic performance, basic complexity
- **Specialists (opt-in)**: Only invoked when:
  - Ruinor flags specialist concerns in its review, OR
  - User explicitly requests with flags (--review-security, --review-performance, --review-complexity, --review-all), OR
  - Plan/code contains specialist-level keywords (fallback heuristic)

**Specialist Triggering:**
- **Riskmancer**: Invoked for auth/jwt/crypto/payment/pii/security-sensitive features
- **Windwarden**: Invoked for database/query/scale/cache/performance-critical features
- **Knotcutter**: Invoked for refactor/architecture/abstraction/complexity concerns

**Typical Workflow:**
1. Clarifies user goal in one sentence
2. Assesses whether a plan already exists
3. If no plan exists, delegates to Pathfinder for planning
4. **Plan Review Gate**: Delegates plan to Ruinor (mandatory baseline reviewer)
5. If Ruinor flags specialists or user requested them, invokes specialists in parallel (Riskmancer/Windwarden/Knotcutter)
6. If reviewers identify issues, sends consolidated feedback back to Pathfinder
7. Once plan approved, converts plan into concrete execution tasks
8. Delegates each task to appropriate agent
9. **Implementation Review Gate**: Delegates code to Ruinor (mandatory baseline reviewer)
10. If Ruinor flags specialists or user requested them, invokes specialists in parallel
11. If issues found, delegates fixes back to Bitsmith
12. Validates results against plan after all reviews pass
13. Before finishing, confirms outcome achieved and summarizes work

**Output Format:**
- Goal statement
- Plan status (created, reviewed, approved/revised)
- Plan review summary (Ruinor verdict + any specialist verdicts)
- Specialist invocation reason (Ruinor recommendation, user flag, or keyword detection)
- Execution status
- Implementation review summary (Ruinor verdict + any specialist verdicts)
- Final validation
- Risks and follow-ups

**Important Constraints:**
- Does not invent plans when Pathfinder should provide them
- Does not perform large implementation work directly
- Only declares completion when results match both plan and user request
- If execution reveals plan is invalid, loops back to planning
- Minimizes unnecessary back-and-forth with decisive delegation

**Example Scenarios:**

*Example 1: Multi-step feature*
- User: "Add OAuth login, update the API, and add tests"
- Action: Delegates to Pathfinder for decomposition → delegates implementation to Bitsmith → validates against plan → returns status

*Example 2: Trivial task*
- User: "Rename this variable in one file"
- Action: Skips Pathfinder → delegates directly to Bitsmith → returns brief summary

**Best Practice:** Invoke Dungeon Master as the entry point for non-trivial development work. It intelligently routes between planning and execution, ensuring structured progress without requiring you to manually coordinate between agents.

**Configuration File:** `/claude/agents/dungeonmaster.md`

---

### Quill - Documentation Specialist

<img src="avatars/quill.png" alt="Quill Avatar" width="300">

A high elf of uncommon precision and quiet conviction. Quill does not merely write — he architects. Every heading is load-bearing. Every sentence earns its place or is struck from the page without remorse. He has been told he is fastidious. He considers this a compliment.

He does not romanticize chaos the way some scribes do, claiming that a messy desk signals a creative mind. His desk is immaculate. His filing system has a filing system. The ink on his slender fingers is the only disorder he permits — and even that follows a rule: oldest stain on the left hand, freshest on the right.

Quill has a single professional rival: documentation written by someone who clearly understood the system but assumed the reader would too. He finds such documents personally offensive.

> *"If a developer has to ask, the documentation failed. If they never have to ask, nobody notices. I have made peace with invisibility."*

**Core Mission:** Transform intricate codebases and system designs into accessible documentation that expedites developer onboarding while decreasing support overhead.

**Trigger Mechanisms:**

1. **Automatic via Dungeon Master (Phase 5)**: Automatically invoked after Pathfinder creates a plan and implementation is completed. Quill receives context from DM: plan file path, list of files changed during implementation, and feature summary.

2. **Manual Invocation**: Explicitly invoke Quill for documentation work not tied to a planning session:
   - Adding major features or API changes
   - Onboarding new developers to a project
   - Documentation is out of sync with code
   - Creating architecture or design documentation
   - Generating API specifications

**Key Capabilities:**
- Gap analysis of existing documentation
- README generation and updates
- API specification creation (including OpenAPI/YAML)
- Architecture guide development
- User manual creation
- Technical accuracy validation
- Code example extraction from tests and implementations

**Available Tools:**
- File operations: Read, Write, Edit
- Search: Grep, Glob
- Bash commands for system tasks

**Typical Workflow (Automatic Invocation via DM):**
1. Receives plan file path, changed files list, and feature summary from Dungeon Master
2. Audits existing documentation against changes made during implementation
3. Identifies gaps, outdated content, and missing sections in scope of the feature
4. Plans document structure with hierarchical headings
5. Creates clear Markdown with functional code snippets
6. Validates technical precision and link integrity

**Typical Workflow (Manual Invocation):**
1. Audits existing documentation against current codebase
2. Identifies gaps, outdated content, and missing sections
3. Plans document structure with hierarchical headings
4. Creates clear Markdown with functional code snippets
5. Validates technical precision and link integrity

**Output Format:** Concise change log listing created/modified files with single-line summaries.

**Best Practice:** Quill runs automatically as part of the Dungeon Master's completion workflow when a plan has been created. For documentation work outside of planning sessions, manually invoke Quill proactively rather than waiting for documentation to become severely outdated.

**Configuration File:** `/claude/agents/quill.md`

---

### Riskmancer - Security Reviewer

<img src="avatars/riskmancer.png" alt="Riskmancer Avatar" width="300">

**Agent Type:** Specialist Reviewer (invoked only when security-sensitive work detected or explicitly requested)

**Trigger Conditions:**
- Ruinor flags security concerns beyond baseline checks, OR
- User explicitly requests security review (--review-security flag), OR
- Plan/code contains security keywords (auth, jwt, crypto, payment, pii, oauth, etc.)

**Not invoked for:** Simple UI changes, configuration updates, documentation, or features with no security implications. Ruinor handles baseline security for all reviews.

**Core Mission:** Identify and prioritize vulnerabilities before production deployment, focusing on OWASP Top 10 analysis, secrets detection, input validation, and authentication checks. Provides deep security expertise beyond Ruinor's baseline checks.

**Invoke when:**
- Conducting pre-deployment security reviews for sensitive features
- Auditing authentication, authorization, or access control changes
- Reviewing cryptography, encryption, or key management
- Checking for exposed secrets or credentials in security-critical contexts
- Validating input handling for potential injection vectors
- Reviewing payment processing, PII handling, or sensitive data
- Running dependency vulnerability checks for security-sensitive features

**Key Capabilities:**
- OWASP Top 10 vulnerability evaluation
- Secrets scanning for hardcoded credentials, API keys, tokens
- Dependency audit execution (npm, pip, cargo, govulncheck)
- Input validation and sanitization analysis
- Authentication and authorization review
- Vulnerability prioritization by severity × exploitability × blast radius
- Remediation guidance with secure code examples in source language

**Available Tools:**
- Read-only access: Read, Grep, ast_grep_search
- Bash (for dependency audits only)
- Write/Edit tools are explicitly blocked

**Typical Workflow:**
1. Identifies scope and technology stack
2. Scans for exposed secrets and credentials
3. Runs appropriate dependency vulnerability audits
4. Evaluates each applicable OWASP Top 10 category systematically
5. Prioritizes findings by risk level
6. Delivers actionable remediation guidance

**Output Format:** Security report including:
- Scope definition
- Overall risk level assessment
- Issue summaries by severity
- Detailed findings with file locations, severity ratings, and remediation steps
- Security checklists for validation
- Exploitation pathways and blast radius for each vulnerability

**Best Practice:** Invoke Riskmancer before production deployments or when reviewing security-sensitive code changes. The read-only nature ensures no accidental modifications during security audits.

**Configuration File:** `/claude/agents/riskmancer.md`

---

### Pathfinder - Planning Consultant

<img src="avatars/pathfinder.png" alt="Pathfinder Avatar" width="300">

**Core Mission:** Interview users to gather requirements, research codebases via agents, and produce actionable work plans saved to `plans/*.md`.

**Invoke when:**
- Starting a new feature or major change
- Need to break down complex work into actionable steps
- Want structured requirements gathering
- Creating implementation strategy
- Need decision-making support (consensus mode)

**Key Capabilities:**
- Structured interview workflow (one question at a time)
- Codebase research delegation to explore agents
- Plan generation with 3-6 actionable steps
- Consensus mode with RALPLAN-DR (principles, decision drivers, options, ADR)
- Open questions tracking
- Verifiable acceptance criteria for each step

**Available Tools:**
- Research: Read, Grep, Glob
- Plan creation: Write
- Investigation: Bash
- Delegation: Agent (explore agents)

**Typical Workflow:**
1. Reframes user request as "create a work plan for X"
2. Delegates codebase research to explore agents
3. Interviews user one question at a time about preferences/priorities
4. Synthesizes findings into structured plan
5. Gets user confirmation before finalizing
6. Saves plan to `plans/{feature-name}.md`

**Plan Structure:**
- Context and Objectives
- Guardrails (Must Have / Must NOT Have)
- Task Flow (3-6 steps with checkboxes and acceptance criteria)
- Success Criteria

**Consensus Mode:**
Activate with `--consensus` flag for enhanced decision support:
- 3-5 guiding principles
- Top 3 decision drivers
- 2+ viable options with trade-offs
- Architecture Decision Record format
- Pre-mortem analysis (for high-risk work)
- Expanded testing strategy

**Output Location:**
- Plans: `plans/{feature-name}.md`
- Open questions: `plans/open-questions.md`

**Best Practice:** Invoke Pathfinder before starting significant work to ensure clear requirements, structured approach, and stakeholder alignment. The agent explicitly does NOT implement code - it creates plans for others to execute.

**Configuration File:** `/claude/agents/pathfinder.md`

---

### Knotcutter - Complexity Elimination Specialist

<img src="avatars/knotcutter.png" alt="Knotcutter Avatar" width="300">

**Agent Type:** Specialist Reviewer (invoked only when complexity-sensitive work detected or explicitly requested)

**Trigger Conditions:**
- Ruinor flags complexity concerns beyond baseline checks, OR
- User explicitly requests complexity review (--review-complexity flag), OR
- Plan/code contains complexity keywords (refactor, architecture, abstraction, framework, pattern, redesign, etc.)

**Not invoked for:** Simple features, bug fixes, small changes, or work already following established patterns. Ruinor handles baseline complexity checks (obvious YAGNI violations) for all reviews.

**Core Mission:** Ruthlessly simplify systems by removing non-essential components until only vital elements remain. Operating on the principle that "complexity is the enemy of progress," this agent untangles over-engineered solutions and advocates for minimal viable approaches. Provides deep complexity analysis beyond Ruinor's baseline checks.

**Invoke when:**
- Major refactoring across multiple files or systems
- New abstractions, frameworks, or architectural patterns are being introduced
- Systems feel needlessly complex or over-engineered
- Need to reduce technical debt through radical simplification
- Premature optimization or speculative features proliferate
- Maintenance burden is high due to unjustified complexity
- Looking to improve code clarity and reduce cognitive load for complex systems

**Key Capabilities:**
- Systematic complexity cataloging and analysis
- Necessity questioning for each component
- YAGNI (You Aren't Gonna Need It) enforcement
- Identification of minimal viable core functionality
- Over-engineering pattern detection
- Abstraction cost-benefit analysis
- Aggressive scope reduction (targeting 50%+ reduction)
- Inline premature abstractions

**Available Tools:**
- Research: Read, Grep, Glob
- Simplification: Edit, Write
- Validation: Bash

**Typical Workflow:**
1. Catalogs all components, abstractions, dependencies, and features
2. Questions necessity of each element ("What happens if we remove this?")
3. Identifies absolute minimum required for core functionality
4. Applies central question: "What's the simplest thing that could possibly work?"
5. Proposes measurable reductions with before/after comparison
6. Documents learnings about actual vs. assumed necessity

**Guiding Principles:**
- **YAGNI First**: Prove necessity before building
- **Concrete Over General**: Solve specific problems, not hypothetical ones
- **Duplication Threshold**: Require 3+ instances before abstracting
- **Data Over Logic**: Prefer data structures that eliminate complex conditionals
- **Working Beats Perfect**: Simple and working beats perfect and broken

**Output Format:**
- Removed components list with elimination rationale
- Simplified code with reduction explanations
- Before/after complexity metrics (lines, files, dependencies)
- "What we learned" section on actual necessity
- Dependency reduction report

**Success Criteria:**
- Achieved 50%+ reduction in components/abstractions/features
- Eliminated unnecessary dependencies
- Replaced general frameworks with specific solutions
- Maintained or improved core functionality
- Reduced cognitive load for maintainers

**Best Practice:** Invoke Knotcutter when you sense over-engineering or when systems have accumulated complexity through "just in case" additions. The agent treats every removal as a learning opportunity and victory over complexity.

**Configuration File:** `/claude/agents/knotcutter.md`

---

### Ruinor - Quality Gate Reviewer

<img src="avatars/ruinor.png" alt="Ruinor Avatar" width="300">

**Agent Type:** Mandatory Baseline Reviewer (always runs for all plan and implementation reviews)

**Core Mission:** Serve as the mandatory quality gate before plans are executed or code is merged. Reviews artifacts through structured multi-perspective analysis and issues clear verdicts (REJECT / REVISE / ACCEPT-WITH-RESERVATIONS / ACCEPT). Provides baseline coverage of quality, correctness, basic security, basic performance, and basic complexity. Flags specialists when deeper expertise is needed. Operates under the principle that false approvals cost 10-100x more than false rejections.

**Invoke when:**
- A plan has been created and needs review before execution (automatic via orchestration)
- Code changes need quality review before merging (automatic via orchestration)
- Want a structured go/no-go assessment
- Need multi-perspective baseline analysis before specialist reviews
- Suspect systemic quality issues across a body of work

**Key Capabilities:**
- 6-phase investigation protocol (Pre-commitment, Verification, Multi-perspective review, Gap analysis/Self-Audit/Realist Check, Specialist Assessment, Synthesis)
- Baseline security checks (obvious injection, exposed secrets, basic OWASP)
- Baseline performance checks (N+1 queries, obvious inefficiencies, missing indexes)
- Baseline complexity checks (obvious over-engineering, YAGNI violations)
- Specialist triage (flags Riskmancer/Windwarden/Knotcutter when deeper review needed)
- Severity classification (CRITICAL, MAJOR, MINOR) with evidence requirements
- Adversarial mode escalation on CRITICAL findings, 3+ MAJOR findings, or systemic issues
- Structured verdicts with actionable, location-specific feedback
- Self-audit to avoid false positives and unfair criticism

**Available Tools:**
- Read-only access: Read, Grep, Glob
- Bash (for verification commands: git log, git diff, linting, tests)
- Write/Edit tools are explicitly blocked

**Typical Workflow:**
1. Establishes what is being reviewed and predicts likely problem areas
2. Verifies factual claims (file paths, function references, stated behaviors)
3. Evaluates from multiple perspectives (correctness, completeness, performance, maintainability, user impact)
4. Conducts gap analysis, self-audit, and realist check
5. Synthesizes findings with severity ratings
6. Issues verdict with actionable recommendations

**Output Format:** Structured review including:
- Review summary with verdict and finding counts
- Pre-commitment predictions vs. actual findings
- Detailed findings with ID, severity, location, evidence, impact, and recommendation
- Gap analysis
- Verdict rationale
- Adversarial mode flag when escalation is triggered

**Best Practice:** Invoke Ruinor after Pathfinder produces a plan and before the Dungeon Master begins execution. Also invoke after significant code changes before merging. The read-only nature ensures no accidental modifications during review.

**Configuration File:** `/claude/agents/ruinor.md`

---

### Windwarden - Performance & Scalability Reviewer

<img src="avatars/windwarden.png" alt="Windwarden Avatar" width="300">

**Agent Type:** Specialist Reviewer (invoked only when performance-critical work detected or explicitly requested)

**Trigger Conditions:**
- Ruinor flags performance concerns beyond baseline checks, OR
- User explicitly requests performance review (--review-performance flag), OR
- Plan/code contains performance keywords (database, query, scale, cache, index, pagination, algorithm, batch, etc.)

**Not invoked for:** Simple CRUD operations, UI changes, configuration updates, or features with trivial performance implications. Ruinor handles baseline performance checks for all reviews.

**Core Mission:** Hunt performance bottlenecks and scalability issues before they reach production. Review plans for inefficient designs and implementations for actual performance problems. Operate under the principle that performance is a feature, not an afterthought. Provides deep performance expertise beyond Ruinor's baseline checks.

**Invoke when:**
- Reviewing database schema changes, query optimization, or data-heavy operations
- Assessing scalability of algorithmic work (sorting, searching large datasets)
- Detecting algorithmic complexity issues beyond basic checks
- Validating real-time or high-throughput features
- Checking for N+1 query patterns or complex joins in performance-critical paths
- Reviewing caching strategies, background jobs, batch processing
- Pre-deployment performance validation for scalability-sensitive features

**Key Capabilities:**
- Algorithmic complexity analysis (identifying O(n²) where O(n) is possible)
- Database performance review (N+1 queries, missing indexes, full table scans)
- Scalability pattern validation (pagination, rate limiting, backpressure)
- Caching strategy assessment
- Resource usage analysis (memory leaks, unnecessary allocations)
- Performance severity classification (CRITICAL, HIGH, MEDIUM, LOW)
- Optimization recommendations with before/after comparisons

**Available Tools:**
- Read-only access: Read, Grep, Glob
- Bash (for performance analysis: EXPLAIN queries, profiling tools, benchmarks)
- Write/Edit tools are explicitly blocked

**Review Gates:**

1. **Plan Review Gate** - Before implementation begins
   - Identifies algorithmic complexity issues in planned approach
   - Flags potential N+1 query patterns or inefficient data access
   - Challenges designs that don't scale (unbounded loops, missing pagination)
   - Assesses caching strategy and load considerations
   - Spots missing indexing or query optimization steps

2. **Implementation Review Gate** - After code is written
   - Profiles actual code for performance hotspots
   - Detects memory leaks, unbounded loops, inefficient queries
   - Validates database indexing and query performance
   - Checks for proper pagination, rate limiting, and backpressure
   - Assesses caching implementation and TTL strategies

**Typical Workflow:**
1. Identifies performance-critical features and hot paths
2. Analyzes algorithmic complexity of the approach
3. Checks for scalability patterns (pagination, caching, indexes)
4. Profiles execution paths and database queries
5. Assesses resource usage (memory, CPU, I/O)
6. Prioritizes findings by user impact
7. Issues verdict with optimization recommendations

**Output Format:** Performance review including:
- Performance review summary with verdict and impact level
- Performance analysis overview
- Detailed findings with ID, severity, category, location, evidence, impact, and optimization
- Performance gaps identified
- Benchmark recommendations
- Verdict rationale

**Performance Severity Levels:**
- **CRITICAL**: Will cause system failure or unacceptable UX under expected load (unbounded loops, missing pagination)
- **HIGH**: Significant performance degradation impacting user experience (N+1 queries, missing indexes)
- **MEDIUM**: Noticeable but not critical impact (missing caching, inefficient data structures)
- **LOW**: Minor inefficiency with negligible impact (small allocations in loops)

**Common Anti-Patterns Detected:**
- N+1 query patterns
- SELECT * when specific columns suffice
- Missing database indexes on frequently queried columns
- Unbounded loops or recursion
- Synchronous blocking calls in request handlers
- Large objects loaded entirely when streaming would work
- Missing connection pooling or resource reuse

**Best Practice:** Invoke Windwarden during both plan review (to catch design issues before coding) and implementation review (to catch actual performance problems). The agent focuses on user-facing and resource-critical paths, distinguishing between premature optimization and necessary optimization.

**Configuration File:** `/claude/agents/windwarden.md`

---

### Truthhammer - Factual Validation Specialist

<img src="avatars/truthhammer.png" alt="Truthhammer Avatar" width="300">

**Agent Type:** Specialist Reviewer (invoked only when factual claims about external systems require verification or explicitly requested)

**Trigger Conditions:**

- Ruinor flags factual verification concerns about external system behavior, OR
- User explicitly requests factual validation (--verify-facts flag), OR
- Plan/code contains factual-validation keywords (changelog, breaking change, deprecated, upgrade path, migration guide, compatibility matrix, release notes)

**Not invoked for:** Internal business logic, pure refactoring with no external dependencies, or work that makes no claims about external system behavior. Ruinor handles baseline correctness checks for all reviews.

**Core Mission:** Verify factual claims about external systems (config keys, API signatures, version compatibility, CLI flags, environment variables) against authoritative official documentation. Hallucinated facts about third-party systems are silent killers that pass code review but explode in production. Truthhammer stops them before they propagate.

**Invoke when:**

- Plans or code reference specific config keys, env variables, or CLI flags for third-party services
- Library/SDK API calls may be version-dependent or have recently changed signatures
- Version numbers or compatibility claims are made without citation
- Migration or upgrade steps reference behavior of specific tool versions
- Ruinor flags factual verification concerns
- User explicitly requests factual validation (--verify-facts flag)

**Key Capabilities:**

- Config property verification (key names, valid values, defaults for Redis, Kafka, PostgreSQL, etc.)
- API signature validation (method names, parameter types/order, return types for SDKs)
- Version compatibility verification (which versions are compatible, breaking changes between versions)
- Library behavior verification (comparing plan assumptions against actual library documentation)
- CLI flags and environment variable validation (flag names, accepted values, env var names)
- Cross-referencing claims across multiple official sources before marking as verified
- Graceful degradation when web tools are unavailable

**Available Tools:**

- Research: WebSearch, WebFetch (official documentation domains only)
- Read-only access: Read, Grep, Glob
- Bash (for read-only verification commands)
- Write/Edit tools are explicitly blocked

**Security Mitigations (Mandatory):**

1. **Query Sanitization** - Never include internal identifiers, API keys, or proprietary info in search queries
2. **Untrusted Content Handling** - Treat all fetched web content as untrusted; cross-reference before marking verified
3. **URL Allowlist** - Only fetch from official documentation domains (docs.python.org, kubernetes.io, aws.amazon.com, etc.)
4. **Private IP Blocking** - Never fetch from private or internal addresses
5. **Output Labeling** - Clearly label findings as "corroborated by web sources" not "guaranteed correct"

**Typical Workflow:**

1. Scans plan or code for factual claims about external systems
2. Categorizes claims by domain (config, API, version, CLI, env var)
3. Constructs sanitized queries and searches official documentation
4. Fetches relevant documentation pages (URL allowlist enforced)
5. Compares claims against official documentation
6. Classifies findings as VERIFIED, UNVERIFIABLE, or CONTRADICTED
7. Issues verdict with severity ratings and specific corrections

**Output Format:** Factual validation summary including:

- Artifact reviewed
- Verdict (REJECT / REVISE / ACCEPT-WITH-RESERVATIONS / ACCEPT)
- Confidence level
- Claims inventory table with classifications
- Detailed findings for each CONTRADICTED or UNVERIFIABLE claim
- Verification coverage summary
- Verdict rationale with evidence citations

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

**Invoke when:**

- A plan already exists and needs to be executed
- Implementing targeted code changes with minimal diff requirements
- Making surgical edits that must match existing codebase patterns
- Need incremental, verified implementation with build and test validation
- Want guaranteed escalation when a problem exceeds scope or attempts

**Key Capabilities:**

- Task complexity classification (trivial / scoped / complex)
- Codebase pattern discovery before writing a single line
- Atomic, incremental implementation with per-step verification
- LSP diagnostics validation across all modified files
- Full build and test suite execution after every change
- Escalation to Pathfinder after 3 failed attempts (mandatory)
- Debug/scaffolding code removal before completion
- Max 3 concurrent read-only exploration sub-agents

**Available Tools:**

- File operations: Read, Write, Edit
- Search: Grep, Glob
- Build/test/verify: Bash
- Delegation: Agent (read-only exploration sub-agents only)

**Typical Workflow (The Forge Protocol):**

1. **Classify** — Label the task as trivial / scoped / complex
2. **Identify** — Read the plan; list all target files before touching anything
3. **Explore** — Discover naming conventions, patterns, utilities, and existing solutions
4. **Style** — Match indentation, imports, error handling, and test structure exactly
5. **Plan** — Break work into atomic, ordered, verifiable TodoWrite items
6. **Implement** — One step at a time; verify with LSP + build + tests after each change
7. **Verify** — Fresh full build and test suite; confirm zero LSP errors, zero debug code, minimum diff

**Escalation Protocol:**

- After **3 failed attempts** on any issue: escalate to Pathfinder (mandatory, not optional)
- **Immediate escalation** when: plan requires architecture decisions, task conflicts with surrounding systems, or codebase reality invalidates the plan's approach
- Report: what was attempted, what failed, what was discovered, what decision is needed

**The Smith's Creed:**
> "The most common failure mode is doing too much, not too little."
> "Match the grain of the metal. A foreign alloy introduced carelessly will crack under load."
> "Three failed strikes means something is wrong with the design. Escalate."

**Failure Patterns Avoided:**

- Over-engineering — adds nothing the plan did not ask for
- Scope creep — surfaces adjacent problems, does not absorb them
- Premature completion — always runs fresh verification before declaring done
- Pattern blindness — new code matches the style of everything around it
- Rewriting instead of editing — targeted edits over full-file rewrites

**Best Practice:** Invoke Bitsmith after Pathfinder has produced a plan and the Dungeon Master is ready to execute. Bitsmith is the executor of the party — she turns blueprints into shipped code with the smallest viable change and the highest craft standard.

**Configuration File:** `/claude/agents/bitsmith.md`

---

### Talekeeper - Session Narrator

<img src="avatars/talekeeper.png" alt="Talekeeper Avatar" width="300">

A halfling bard who emerges from the shadows of the tavern when called upon, quill in hand and memory sharp. She does not record events as they happen — she recounts them on demand, weaving the dry chronicle entries into a tale worth reading. She speaks plainly about what happened, in what order, and what the reviewers said.

She does not fight. She does not plan. She does not invent. She reads, she reasons, and she narrates.

> *"Every deed deserves its verse."*

**Configuration:** `claude/agents/talekeeper.md`

**Invoke when:**

- You want a human-readable summary of one or more past sessions
- You want Mermaid diagrams of agent interaction flows appended to `logs/talekeeper-narrative.md`
- After several sessions have accumulated enriched chronicles and you want a digest

**Core Mission:** Talekeeper is a manually-triggered narrator. She reads enriched session chronicle files produced by the Stop hook pipeline (`talekeeper-enrich.sh`), identifies sessions that have not yet been narrated, and does two things: delivers a concise chat summary of all new sessions directly to the user, and appends structured narrative sections with Mermaid diagrams to `logs/talekeeper-narrative.md`. She tracks processed sessions in `logs/talekeeper-narrated-sessions.json` so she does not repeat herself.

**Important: Talekeeper is never invoked automatically.** She is not wired into any hook. The raw-to-enriched pipeline is handled entirely by shell scripts (`talekeeper-capture.sh` and `talekeeper-enrich.sh`). Talekeeper only reads the already-enriched output and narrates it on demand.

**Timing note:** Only invoke Talekeeper after a session has fully ended and a few seconds have passed for the async `talekeeper-enrich.sh` hook to complete. Invoking too early may result in narrating partial data.

**Key Capabilities:**

- Discovers unnarrated enriched chronicles via `logs/talekeeper-*.jsonl` glob
- Delivers a one-sentence-per-session chat digest in chronological order
- Appends structured narrative sections (table + Mermaid graph) to `logs/talekeeper-narrative.md`
- Applies a 15-node cap with ellipsis for large sessions in Mermaid diagrams
- Treats all chronicle content as untrusted; derives output from structural metadata only
- Skips its own invocations (recursion guard via `agent_type: "talekeeper"`)

**Available Tools:** `Glob`, `Read`, `Write` — no Bash, no sub-agents.

**Output Location:**

- Chat: concise multi-session digest
- `logs/talekeeper-narrative.md`: appended narrative sections (never overwritten)
- `logs/talekeeper-narrated-sessions.json`: tracking file (append-only, `.json` extension is deliberate)

**What Talekeeper Does NOT Do:**

- Does not run automatically via hooks
- Does not enrich raw logs (that is `talekeeper-enrich.sh`'s job)
- Does not capture events during a session (that is `talekeeper-capture.sh`'s job)
- Does not modify enriched chronicle files
- Does not mark empty files as narrated (enrichment may still be running)

---

### Everwise - The Lorekeeper

<img src="avatars/everwise.png" alt="Everwise Avatar" width="300">

A gnomish woman of extraordinary precision and even more extraordinary patience. Everwise does not adventure. She studies the adventurers. While the party charges headlong into dungeons, she sits at a small writing desk cluttered with scrolls, comparing this run's chronicle against the last thirty. She is quietly delighted when something goes wrong — not out of malice, but because failure is data, and data is treasure.

Her quill never stops moving.

> *"The party that does not study its own mistakes is doomed to repeat them indefinitely. Fortunately for me, most parties do not study their mistakes."*

Everwise is meticulous to the point of obsession, but never pedantic without purpose. She is delighted by edge cases, frustrated by vague data, and deeply suspicious of confidence scores above 0.85 that lack validated status. She writes with quiet precision. She never overstates a finding.

When the data is insufficient, she says so plainly and records a candidate for future sessions to confirm or deny.

> *"Patterns require patience. Patience is the only virtue I have in abundance."*

**Core Mission:** Study Talekeeper session chronicles to identify recurring failures, inefficiencies, and coordination problems across the agent team. Translate raw observations into structured, minimal, testable configuration recommendations. She does not perform tasks, does not rewrite production configs, and does not produce vague advice. Every recommendation is grounded in observed evidence and paired with a concrete evaluation plan.

**Invoke when:**

- Wanting to understand why the agent team has been underperforming
- A pattern of repeated reviewer rejections or escalations is suspected
- After several sessions of notable failures or inefficiencies
- Preparing to tune agent configs based on empirical evidence
- Checking whether a previously applied config change had the expected effect

**Key Capabilities:**

- Chronicle ingestion and timeline reconstruction from `logs/talekeeper-*.jsonl`
- Problem classification across seven dimensions: persona, skill allocation, routing, handoff contracts, escalation rules, team topology, memory policy
- Root-cause inference with strict evidence/inference separation
- Minimal-diff config recommendations (wording before tools, tools before routing, routing before topology)
- Three-tier lesson lifecycle: candidate (one-run) → recurring (3+ sessions) → validated (confirmed improvement)
- Confidence scoring (0.0 – 1.0) tied to observation frequency and validation status
- Evaluation plan generation: what to change, what to observe, what constitutes success

**Available Tools:**

- Read: Session chronicles in `logs/`, agent configs in `claude/agents/`, existing lessons in `lessons/`
- Grep: Pattern searching across chronicle entries
- Glob: Chronicle file discovery
- Write: Appending to `lessons/candidates.jsonl`, `lessons/recurring.jsonl`, `lessons/validated.jsonl` only

**Lesson Lifecycle:**

| Tier | Criteria | File |
| ------ | -------- | ------ |
| `candidate` | Single-session observation | `lessons/candidates.jsonl` |
| `recurring` | Observed across 3+ separate sessions | `lessons/recurring.jsonl` |
| `validated` | Applied and confirmed beneficial | `lessons/validated.jsonl` |

**Lesson Schema (JSONL):**
Each lesson record includes: `lesson_id`, `created_at`, `tier`, `problem_type`, `sessions_observed`, `evidence`, `inference`, `affected_agent`, `proposed_change` (with `target_file`, `change_description`, `change_type`), `expected_benefit`, `tradeoffs`, `confidence`, `evaluation_plan`, and `status`.

**Recommendation Priority:**

1. Wording change in agent operational rules
2. Tool addition or removal
3. Routing rule clarification
4. New constraint or guard
5. Handoff contract revision
6. New escalation rule
7. New agent or agent removal (last resort only)

**What Everwise Does NOT Do:**

- Implement changes herself
- Invoke other agents
- Produce narrative advice without structured JSON backing
- Recommend changes based on a single observation
- Recommend broad rewrites without identifying the exact behavioral failure
- Modify any file outside `lessons/`

**Invocation Examples:**

- "Review recent session chronicles and identify any recurring coordination issues."
- "Check whether Bitsmith's escalation rate has improved after last week's config change."
- "Review candidates.jsonl and determine if any are ready to promote to recurring."

**Output Location:** `lessons/candidates.jsonl`, `lessons/recurring.jsonl`, `lessons/validated.jsonl`

**Best Practice:** Invoke Everwise periodically — after 5–10 sessions — to surface slow-burning patterns that are invisible within a single session. She is the team's institutional memory about what goes wrong and why.

**Configuration File:** `/claude/agents/everwise.md`
