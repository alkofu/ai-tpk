# Agent Reference

This document provides a comprehensive guide to the specialized agents available in this Claude Code configuration.

## Quick Reference

| Agent | Purpose | Primary Use Cases | Model |
|-------|---------|-------------------|-------|
| **Quill** | Documentation specialist | READMEs, API specs, architecture guides, user manuals | claude-sonnet-4.5 |
| **Riskmancer** | Security reviewer | Vulnerability detection, secrets scanning, OWASP analysis | claude-opus-4-6 |

## When to Use Which Agent

```
Documentation needs → Quill
Security review → Riskmancer
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

