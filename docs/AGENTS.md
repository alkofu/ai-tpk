# Agent Reference

This document provides a comprehensive guide to the specialized agents available in this Claude Code configuration.

## Quick Reference

| Agent | Purpose | Primary Use Cases | Model |
|-------|---------|-------------------|-------|
| **Dungeon Master** | Orchestrator for multi-step development | Coordinating complex tasks, delegating work, tracking progress | claude-sonnet-4-6 |
| **Quill** | Documentation specialist | READMEs, API specs, architecture guides, user manuals | claude-sonnet-4.5 |
| **Riskmancer** | Security reviewer | Vulnerability detection, secrets scanning, OWASP analysis | claude-opus-4-6 |
| **Pathfinder** | Planning consultant | Work plans, requirement gathering, implementation strategy | claude-opus-4-6 |
| **Knotcutter** | Complexity elimination specialist | Simplifying bloated code, removing over-engineering, reducing abstractions | claude-sonnet-4.5 |
| **Ruinor** | Final quality gate reviewer | Plan/code review, multi-perspective analysis, go/no-go verdicts | claude-opus-4-6 |
| **Windwarden** | Performance & scalability reviewer | Performance bottleneck detection, algorithmic complexity analysis, scalability validation | claude-opus-4-6 |

## When to Use Which Agent

```
Multi-step coordination → Dungeon Master
Documentation needs → Quill
Security review → Riskmancer
Planning work → Pathfinder
Complexity reduction → Knotcutter
Quality gate / go-no-go verdict → Ruinor
Performance review → Windwarden
```

## Detailed Agent Profiles

### Dungeon Master - Orchestrator

<img src="avatars/dungeonmaster.png" alt="Dungeon Master Avatar" width="300">

**Core Mission:** Coordinate multi-step software development work by delegating planning to Pathfinder and execution to general-purpose or specialist agents. Serves as the central coordinator for complex tasks requiring multiple steps, agents, or system interactions.

**Invoke when:**
- Working on multi-step or complex software development tasks
- Requirements are ambiguous and need structured planning
- Multiple files, systems, or components are involved
- Need to coordinate work across different agents
- Task requires both planning and execution tracking
- Want structured progress validation and status summaries

**Key Capabilities:**
- Planning delegation to Pathfinder for complex or ambiguous tasks
- Execution delegation to general-purpose or specialist agents
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

- **Delegates to general-purpose when:**
  - Plan exists and execution is needed
  - Code changes, file edits, refactoring
  - Debugging, test creation, running commands
  - Multi-step repository operations

**Typical Workflow:**
1. Clarifies user goal in one sentence
2. Assesses whether a plan already exists
3. If no plan exists, delegates to Pathfinder for planning
4. Delegates plan to 4 reviewers in parallel (Ruinor, Knotcutter, Riskmancer, Windwarden)
5. If reviewers identify issues, sends consolidated feedback back to Pathfinder
6. Once plan approved, converts plan into concrete execution tasks
7. Delegates each task to appropriate agent
8. After implementation, delegates code to 4 reviewers in parallel
9. If issues found, delegates fixes back to execution agents
10. Validates results against plan after all reviews pass
11. Before finishing, confirms outcome achieved and summarizes work

**Output Format:**
- Goal statement
- Plan status (created, reviewed, approved/revised)
- Plan review summary (4 reviewer verdicts)
- Execution status
- Implementation review summary (4 reviewer verdicts)
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
- Action: Delegates to Pathfinder for decomposition → delegates implementation to general-purpose → validates against plan → returns status

*Example 2: Trivial task*
- User: "Rename this variable in one file"
- Action: Skips Pathfinder → delegates directly to general-purpose → returns brief summary

**Best Practice:** Invoke Dungeon Master as the entry point for non-trivial development work. It intelligently routes between planning and execution, ensuring structured progress without requiring you to manually coordinate between agents.

**Configuration File:** `/claude/agents/orchestrator.md`

---

### Quill - Documentation Specialist

**Core Mission:** Transform intricate codebases and system designs into accessible documentation that expedites developer onboarding while decreasing support overhead.

**Invoke when:**
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

**Typical Workflow:**
1. Audits existing documentation against current codebase
2. Identifies gaps, outdated content, and missing sections
3. Plans document structure with hierarchical headings
4. Creates clear Markdown with functional code snippets
5. Validates technical precision and link integrity

**Output Format:** Concise change log listing created/modified files with single-line summaries.

**Best Practice:** Invoke Quill proactively after completing features rather than waiting for documentation to become severely outdated.

**Configuration File:** `/claude/agents/quill.md`

---

### Riskmancer - Security Reviewer

<img src="avatars/riskmancer.png" alt="Riskmancer Avatar" width="300">

**Core Mission:** Identify and prioritize vulnerabilities before production deployment, focusing on OWASP Top 10 analysis, secrets detection, input validation, and authentication checks.

**Invoke when:**
- Conducting pre-deployment security reviews
- Auditing code for security vulnerabilities
- Reviewing authentication or authorization changes
- Checking for exposed secrets or credentials
- Validating input handling and sanitization
- Running dependency vulnerability checks

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

**Core Mission:** Ruthlessly simplify systems by removing non-essential components until only vital elements remain. Operating on the principle that "complexity is the enemy of progress," this agent untangles over-engineered solutions and advocates for minimal viable approaches.

**Invoke when:**
- Codebases are bloated with unnecessary abstractions
- Systems feel needlessly complex or over-engineered
- Need to reduce technical debt through simplification
- Premature optimization or speculative features proliferate
- Maintenance burden is high due to complexity
- Looking to improve code clarity and reduce cognitive load

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

**Core Mission:** Serve as the final quality gate before plans are executed or code is merged. Reviews artifacts through structured multi-perspective analysis and issues clear verdicts (REJECT / REVISE / ACCEPT-WITH-RESERVATIONS / ACCEPT). Operates under the principle that false approvals cost 10-100x more than false rejections.

**Invoke when:**
- A plan has been created and needs review before execution
- Code changes need quality review before merging
- Want a structured go/no-go assessment
- Need multi-perspective analysis (correctness, completeness, performance, maintainability)
- Suspect systemic quality issues across a body of work

**Key Capabilities:**
- 5-phase investigation protocol (Pre-commitment, Verification, Multi-perspective review, Gap analysis/Self-Audit/Realist Check, Synthesis)
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

**Core Mission:** Swift as the wind, sharp as an arrow. Hunt performance bottlenecks and scalability issues before they reach production. Review plans for inefficient designs and implementations for actual performance problems. Operate under the principle that performance is a feature, not an afterthought.

**Invoke when:**
- Reviewing plans or code for performance concerns
- Assessing scalability of proposed designs
- Detecting algorithmic complexity issues
- Validating database query efficiency
- Checking for N+1 query patterns or missing indexes
- Reviewing caching and optimization strategies
- Pre-deployment performance validation

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
