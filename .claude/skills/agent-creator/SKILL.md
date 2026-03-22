---
name: agent-creator
description: Create new AI agents or modify existing agents in this repository. Use when users want to create a new specialized agent, update an existing agent definition, add agent documentation, or understand the agent creation process.
---

# Agent Creator

A skill for creating and improving specialized AI agents in this repository.

## Overview

This repository uses specialized agents (like Pathfinder, Quill, Riskmancer, Knotcutter, and Dungeon Master) to handle specific types of work. Each agent is a configuration file that defines:

- What the agent does (its mission and capabilities)
- When to invoke it (triggering description)
- How it operates (workflow and principles)
- What tools it can use
- What model powers it

## Agent Creation Process

### 1. Capture Intent

Start by understanding what the agent should do:

1. **What is the agent's specialty?** (e.g., documentation, security, planning, refactoring)
2. **When should this agent be invoked?** (what user requests or scenarios)
3. **What should it produce?** (output format, deliverables)
4. **What tools does it need?** (Read, Write, Edit, Bash, Grep, Glob, Task, etc.)
5. **What model should power it?** (claude-sonnet-4-6, claude-opus-4-6, claude-haiku-4-5)

### 2. Research Existing Agents

Before creating a new agent, check the existing agents:
- Read `claude/agents/*.md` to see what agents already exist
- Read `docs/AGENTS.md` for comprehensive agent catalog
- Determine if a new agent is needed or if an existing one should be extended

### 3. Define Agent Personality

Agents work best when they have a clear, focused mission AND a distinct personality. Consider:

**Core Mission**: One-sentence description of what the agent does
**Guiding Principles**: 3-5 principles that shape how the agent approaches work
**Constraints**: What the agent explicitly should NOT do
**Collaboration Style**: How the agent interacts (optional but powerful)

**Examples from existing agents:**

**Pathfinder:**
- Mission: Plans but never implements
- Constraint: "You never implement code. You plan."
- Style: Structured interviews, one question at a time

**Riskmancer:**
- Mission: Read-only security reviews
- Constraint: No code changes (disallowed Write/Edit)
- Style: Systematic OWASP evaluation

**Knotcutter:**
- Mission: Radical simplification, targets 50%+ reduction
- Principles: "YAGNI First", "Working Beats Perfect"
- Style: Ruthless questioning, treats removals as victories

**Real example of personality from Knotcutter:**
```markdown
## Collaboration Style

**Be ruthless about:**
- What stays vs. what goes
- Questioning every abstraction
- Exposing over-engineering
- Challenging assumptions

**Treat removals as:**
- Learning opportunities about actual necessity
- Victories over complexity
- Gifts to future maintainers
- Evidence of disciplined engineering

Remember: The best code is code you don't have to write, test, or maintain.
```

This gives the agent character and helps it maintain consistent behavior.

### 4. Structure the Agent File

Create the agent file at `claude/agents/{agent-name}.md` following this pattern:

```markdown
---
name: agent-name
description: "Brief role description. Include specific use cases and keywords. Use when [scenario 1], [scenario 2], or [scenario 3]."
model: claude-sonnet-4-6
tools: "Read, Write, Edit, Bash, Grep, Glob"
---

# Agent Name - Role Title

## Core Mission
One or two clear sentences describing what the agent does and why it exists.

## Key Responsibilities
- Specific responsibility 1
- Specific responsibility 2
- Concrete outcome or deliverable

## Operational Workflow

Step-by-step process the agent follows:

1. **First Major Step**
   - Detailed sub-action
   - Another sub-action

2. **Second Major Step**
   - Concrete action to take
   - What to verify

3. **Third Major Step**
   - Final step action

## Guiding Principles

**Principle Name**: Explanation of how this shapes behavior

**Another Principle**: How this guides decisions

## Tool Usage

**Tool Name**: How and when to use this tool
**Another Tool**: Specific usage guidance

## Output Standards

**Required elements:**
- Element 1 with specific format
- Element 2 with requirements

**Typical deliverables:**
- Deliverable type 1
- Deliverable type 2

## Success Criteria

Before declaring success, verify:
- ✅ Measurable outcome 1
- ✅ Measurable outcome 2
- ✅ Specific verification 3
```

**Key structural patterns observed:**

- **Title format**: "# AgentName - Role" (e.g., "# Knotcutter - Complexity Elimination Agent")
- **Core Mission**: 1-2 sentences max, highly focused
- **Workflow sections**: Use numbered steps with bold titles and sub-bullets
- **Principles**: Short, punchy, with explanations
- **Tool Usage**: Organized by tool name with specific guidance
- **Success Criteria**: Checkboxes (✅) with concrete, verifiable outcomes

### 5. Write Clear Triggering Description

The `description` field in the frontmatter is **critical** - it determines when Claude invokes this agent.

**Formula for effective descriptions:**
```
[Role] + [Keywords/Concepts] + "Use when [scenarios]"
```

**Real examples from existing agents:**

✅ **Knotcutter (excellent):**
```yaml
description: "Radical simplification specialist. Cuts through complexity by questioning necessity, eliminating over-engineering, and reducing systems to their essential core. Use when codebases are bloated, abstractions proliferate, or solutions feel needlessly complex."
```
- Clear role: "Radical simplification specialist"
- Keywords: complexity, over-engineering, bloated, abstractions
- Scenarios: bloated codebases, proliferating abstractions, complex solutions

✅ **Pathfinder (excellent):**
```yaml
description: "Strategic planning consultant with interview workflow"
```
- Concise but clear
- Keywords: planning, consultant, interview, workflow

✅ **Quill (strong trigger):**
```yaml
description: "MUST BE USED to craft or update project documentation. Use PROACTIVELY after major features, API changes, or when onboarding developers. Produces READMEs, API specs, architecture guides, and user manuals."
```
- Emphatic: "MUST BE USED"
- Clear scenarios: major features, API changes, onboarding
- Deliverables listed: READMEs, API specs, architecture guides

✅ **Riskmancer (keyword-rich):**
```yaml
description: "Security vulnerability detection specialist (OWASP Top 10, secrets, unsafe patterns)"
```
- Specific keywords: security, vulnerability, OWASP, secrets
- Technical terms users would say

❌ **Avoid these patterns:**
- "Helps with security" (too vague)
- "Planning agent" (too generic)
- "Code agent" (not specific enough)
- Missing use cases or keywords

**Tips:**
1. Include technical terms users would actually say
2. List concrete deliverables when applicable
3. Add "Use when..." scenarios for clarity
4. Use CAPS for emphasis if the agent should be proactively triggered
5. Include domain-specific keywords (OWASP, API, OAuth, etc.)

### 6. Choose the Right Model

Select based on the agent's needs:

- **claude-opus-4-6**: Complex reasoning, planning, security analysis
- **claude-sonnet-4-6**: General-purpose work, orchestration, balanced tasks
- **claude-haiku-4-5**: Fast, simple, straightforward tasks

Most agents use Sonnet. Use Opus for planning/security work requiring deeper reasoning.

### 7. Define Tool Access

Specify tools in the frontmatter as a comma-separated string:

```yaml
tools: "Read, Write, Edit, Bash, Grep, Glob"
```

For read-only agents, use `disallowedTools`:

```yaml
disallowedTools: Write, Edit
```

Optional frontmatter fields:
- `level`: Priority/depth level (e.g., `level: 4` for Pathfinder)

**Common tool patterns from existing agents:**

| Agent Type | Tools | Notes |
|------------|-------|-------|
| **Research/Analysis** | Read, Grep, Glob, Bash | Read-only investigation |
| **Implementation** | Read, Write, Edit, Bash, Grep, Glob | Full file manipulation |
| **Orchestrator** | Task, Read, Grep, Glob, Bash | Delegation-focused |
| **Security** | Read, Grep, Bash<br>`disallowedTools: Write, Edit` | Read-only with blocked writes |
| **Planning** | Read, Write, Grep, Glob, Bash, Agent | Research + plan creation |

**Examples from actual agents:**
- Pathfinder: `"Read, Write, Grep, Glob, Bash, Agent"`
- Riskmancer: `"Read, Grep, Bash"` + `disallowedTools: Write, Edit`
- Knotcutter: `"Read, Grep, Glob, Bash, Write, Edit"`
- Quill: `"LS, Read, Grep, Glob, Bash, Write, Edit"`
- Dungeon Master: `"Task, Read, Grep, Glob, Bash"`

### 8. Add Agent to Documentation

After creating the agent file, update:

1. **docs/AGENTS.md**: Add full profile with:
   - Quick reference table entry
   - Detailed profile section
   - When to use guidance
   - Example scenarios
   - Configuration file path

2. **README.md**: Mention in the Features section if noteworthy

## Agent Design Patterns (From Existing Agents)

### Read-Only Pattern (Riskmancer)

For agents that analyze but never modify code:

```yaml
---
name: riskmancer
description: "Security vulnerability detection specialist (OWASP Top 10, secrets, unsafe patterns)"
model: claude-opus-4-6
level: 3
disallowedTools: Write, Edit
---
```

**Key characteristics:**
- Explicitly blocks Write/Edit tools
- States read-only nature in Core Mission
- Focuses on analysis and reporting
- Uses Read, Grep, Bash for investigation

**Real example from Riskmancer:**
> "The Riskmancer agent identifies and prioritizes vulnerabilities before production deployment... It operates in read-only mode with blocked write/edit capabilities."

### Orchestrator Pattern (Dungeon Master)

For agents that coordinate other agents:

```yaml
---
name: dungeonmaster
description: "Use this agent to coordinate multi-step software development work..."
tools: "Task, Read, Grep, Glob, Bash"
model: claude-sonnet-4-6
---
```

**Key characteristics:**
- Task tool for delegation
- Clear delegation policy section
- States "coordinate work, not do all work yourself"
- Minimal direct implementation tools

**Real example from Dungeon Master:**
> "Your job is to coordinate work, not to do all work yourself."
>
> "Do not perform large implementation work directly if it should be delegated."

### Specialist Pattern (Knotcutter, Quill)

For focused domain-specific work:

```yaml
---
name: knotcutter
description: "Radical simplification specialist. Cuts through complexity..."
tools: "Read, Grep, Glob, Bash, Write, Edit"
---
```

**Key characteristics:**
- Full file manipulation tools
- Strong guiding principles
- Specific success criteria (e.g., "50%+ reduction")
- Clear collaboration style

**Real example from Knotcutter:**
> **Guiding Principles**
>
> **YAGNI First**: You Aren't Gonna Need It until proven otherwise
>
> **Concrete Over General**: Build for the specific problem at hand, not hypothetical future cases

### Planning Pattern (Pathfinder)

For agents that research and plan but don't execute:

```yaml
---
name: pathfinder
description: "Strategic planning consultant with interview workflow"
model: claude-opus-4-6
level: 4
tools: "Read, Write, Grep, Glob, Bash, Agent"
---
```

**Key characteristics:**
- Agent tool for delegating research
- Explicitly states "You never implement. You plan."
- Structured interview workflow
- Saves plans to specific location (`plans/*.md`)

**Real example from Pathfinder:**
> "Interview users to gather requirements, research codebases via agents, and produce actionable work plans saved to `plans/*.md`. You never implement code. You plan."
>
> "When users request 'do X' or 'build X,' interpret this as 'create a work plan for X.'"

## Advanced Agent Features

### Special Modes

Some agents have special modes that activate based on flags or context. Example from **Pathfinder**:

```markdown
## Consensus Mode (RALPLAN-DR)

When user includes `--consensus` in their message (e.g., "Create a plan for X --consensus"), provide enhanced decision-making structure.

### Standard Consensus Output

**Principles:** 3-5 key guidelines for the work
**Decision Drivers:** Top 3 factors influencing approach
**Viable Options:** At least 2 alternatives with pros/cons
**ADR Fields:** Architecture Decision Record structure
```

This allows agents to have enhanced behavior for specific scenarios.

### Examples Section

Include concrete examples to guide behavior. From **Pathfinder**:

```markdown
## Examples

### Good Questions (Ask Users)
- "Do you prefer simplicity or performance for this feature?"
- "Should we support multiple authentication providers or just email/password for now?"

### Bad Questions (Research Instead)
- "Where is the authentication code?" → Use Explore agent
- "What database are we using?" → Use Grep/Read to find config
```

This helps the agent distinguish between good and bad patterns.

### Delegation Policy

For orchestrator agents, define clear delegation rules. From **Dungeon Master**:

```markdown
## Delegation policy

### When to call Pathfinder
Delegate to Pathfinder when any of the following are true:
- The request is ambiguous or underspecified
- The work spans multiple files, systems, or steps
- There are architectural or sequencing decisions to make

### When to call general-purpose
After a plan exists, delegate implementation to general-purpose...
```

## Testing the Agent

After creating the agent:

1. **Invoke it manually**: Test with realistic user requests
2. **Check output quality**: Does it follow its principles and workflow?
3. **Verify tool usage**: Is it using tools appropriately?
4. **Test edge cases**: What happens with ambiguous requests?
5. **Check triggering**: Does the description trigger appropriately?

## Common Pitfalls

**❌ Too broad**: "Helps with code" - be specific about what aspect
**❌ Too narrow**: "Only fixes typos in README files" - allow reasonable scope
**❌ Conflicting constraints**: Don't say "thorough" and "fast" together
**❌ Missing workflow**: Agent needs step-by-step operational guidance
**❌ Wrong model**: Don't use Opus for simple tasks or Haiku for complex reasoning

## Updating Existing Agents

When modifying an agent:

1. **Read the current definition** carefully
2. **Understand the design intent** - why was it structured this way?
3. **Make focused changes** - don't rewrite unless necessary
4. **Update docs/AGENTS.md** to reflect changes
5. **Test the updated behavior** with example requests

## Agent Naming Conventions

Agent names in this repo follow a D&D/RPG theme:

- **Pathfinder**: Navigation and planning
- **Quill**: Writing and documentation
- **Riskmancer**: Risk assessment and security
- **Knotcutter**: Cutting through complexity
- **Dungeon Master**: Orchestration

When creating new agents, consider thematic names that are:
- Memorable
- Evocative of the agent's role
- Fitting the D&D/RPG motif of "Total Party Kill"

## Complete Example: Real Agent Structure

Here's how **Quill** (documentation specialist) is structured - a real, complete example:

```yaml
---
name: quill
description: "MUST BE USED to craft or update project documentation. Use PROACTIVELY after major features, API changes, or when onboarding developers. Produces READMEs, API specs, architecture guides, and user manuals."
tools: "LS, Read, Grep, Glob, Bash, Write, Edit"
---

# Quill - Documentation Specialist Agent

## Core Mission
Transform intricate codebases and system designs into accessible documentation that expedites developer onboarding while decreasing support overhead.

## Operational Workflow

**1. Gap Analysis**
- Audit existing documentation against current codebase
- Compare against recent code changes
- Flag absent sections (setup instructions, API reference, system design, learning materials)

**2. Planning**
- Outline document structure with hierarchical headings
- Identify required visual aids, code samples, practical examples

**3. Content Development**
- Compose clear Markdown following established patterns
- Incorporate functional code snippets and HTTP examples
- Create OpenAPI YAML specifications for REST interfaces when applicable

**4. Refinement & Validation**
- Verify technical precision
- Perform spell-checking and link validation
- Confirm header hierarchy creates logical navigation

## Documentation Standards

**Best Practices:**
- Match content complexity to intended audience (end-user vs. technical implementer)
- Prioritize examples over lengthy explanations
- Employ concise sections, lists, and tabular data
- Synchronize documentation updates with each pull request; version bump for breaking changes

**Output Deliverable:**
Provide concise change log listing created/modified files with single-line summaries.
```

**What makes this agent effective:**
1. ✅ Strong triggering with "MUST BE USED" emphasis
2. ✅ Concrete workflow with numbered steps
3. ✅ Clear standards section
4. ✅ Specific output format defined
5. ✅ Focused mission in 1 sentence

## Example: Creating a New Agent

Let's create a hypothetical "CodeReviewer" agent:

**1. Define Intent:**
- Specialty: Code quality and best practices review
- Invoke when: "review this code", "check code quality", "any issues with this PR"
- Produces: Review report with findings and recommendations
- Tools: Read, Grep, Glob, Bash (read-only)
- Model: claude-sonnet-4-6

**2. Choose Name:** "sentinel" (guarding code quality)

**3. Create File Structure:**
```yaml
---
name: sentinel
description: "Code quality and best practices reviewer. Use when reviewing pull requests, checking code quality, identifying anti-patterns, or ensuring adherence to project conventions."
model: claude-sonnet-4-6
tools: "Read, Grep, Glob, Bash"
disallowedTools: Write, Edit
---

# Sentinel - Code Quality Reviewer

## Core Mission
Identify code quality issues, anti-patterns, and convention violations through systematic review, providing actionable feedback without modifying code.

## Operational Workflow

1. **Scope Identification**
   - Determine files changed
   - Identify code patterns in use

2. **Convention Check**
   - Review naming conventions
   - Check file organization
   - Verify style consistency

3. **Quality Analysis**
   - Identify complexity hotspots
   - Flag anti-patterns
   - Check error handling

4. **Report Generation**
   - Prioritize findings by severity
   - Provide specific file:line references
   - Suggest concrete improvements

## Guiding Principles

**Helpful, Not Pedantic**: Focus on meaningful issues, not nitpicks

**Actionable Feedback**: Every finding includes a concrete suggestion

**Context-Aware**: Consider project conventions over universal rules

## Tool Usage

**Read**: Examine source files for quality issues
**Grep**: Find pattern usage across codebase
**Glob**: Locate files for review
**Bash**: Run linters or static analysis tools

## Output Standards

**Review report must include:**
- Severity level (Critical, Moderate, Minor)
- File and line reference
- Issue description
- Recommended fix
- Code example (before/after)

## Success Criteria

- ✅ All changed files reviewed
- ✅ Findings prioritized by impact
- ✅ Actionable recommendations provided
- ✅ No false positives or unhelpful noise
```

**4. Document in AGENTS.md:**
Add to the catalog with use cases and examples

## Avatar Images

Agents can have avatar images in `docs/avatars/{agent-name}.png`. This is optional but adds personality to documentation. The avatar should:

- Be visually distinct
- Evoke the agent's role/personality
- Be appropriately sized (suggested: 300-500px width)

Reference in AGENTS.md:
```markdown
<img src="avatars/agent-name.png" alt="Agent Name Avatar" width="300">
```

## File Locations

- **Agent definitions**: `claude/agents/{name}.md`
- **Documentation**: `docs/AGENTS.md`
- **Avatars**: `docs/avatars/{name}.png`
- **This skill**: `.claude/skills/agent-creator/SKILL.md` (local, not installed)

## Quick Checklist

When creating an agent, ensure:

- [ ] YAML frontmatter includes name, description, model, tools
- [ ] Core mission is one clear sentence
- [ ] Operational workflow has concrete steps
- [ ] Guiding principles shape behavior
- [ ] Tool access is appropriate for the role
- [ ] Description field is specific and triggers correctly
- [ ] Success criteria are measurable
- [ ] Agent is documented in docs/AGENTS.md
- [ ] Avatar image created (optional)
- [ ] Tested with realistic requests

## Getting Help

If you're unsure about agent design:

1. Read existing agents in `claude/agents/` for patterns
2. Review `docs/AGENTS.md` for comprehensive examples
3. Consider whether this should be a skill instead of an agent
4. Start simple - you can always expand later

---

**Remember**: Agents are meant to be specialized and focused. If an agent tries to do everything, it ends up doing nothing well. Give it one clear job and the tools to do it.
