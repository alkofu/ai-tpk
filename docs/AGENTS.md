# Agent Reference

This document provides a comprehensive guide to the specialized agents available in this Claude Code configuration.

## Quick Reference

| Agent | Purpose | Primary Use Cases | Model |
|-------|---------|-------------------|-------|
| **Quill** | Documentation specialist | READMEs, API specs, architecture guides, user manuals | claude-sonnet-4.5 |
| **Riskmancer** | Security reviewer | Vulnerability detection, secrets scanning, OWASP analysis | claude-opus-4-6 |
| **Pathfinder** | Planning consultant | Work plans, requirement gathering, implementation strategy | claude-opus-4-6 |
| **Knotcutter** | Complexity elimination specialist | Simplifying bloated code, removing over-engineering, reducing abstractions | claude-sonnet-4.5 |

## When to Use Which Agent

```
Documentation needs → Quill
Security review → Riskmancer
Planning work → Pathfinder
Complexity reduction → Knotcutter
```

## Detailed Agent Profiles

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

