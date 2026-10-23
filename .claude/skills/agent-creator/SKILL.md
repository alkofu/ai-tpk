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
4. **What tools does it need?** (Read, Write, Edit, Bash, Grep, Glob, Agent, etc.)
5. **What model and effort should power it?** (sonnet, opus, haiku, or inherit; effort low to max)

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
- Style: Researches first, asks the user only on a real fork between approaches

**Riskmancer:**
- Mission: Read-only security reviews
- Constraint: No code changes (Write and Edit are left out of its `tools`)
- Style: Systematic OWASP evaluation

**Knotcutter:**
- Mission: Radical simplification, targets 50%+ reduction
- Principles: "YAGNI First", "Working Beats Perfect"
- Style: Ruthless about what stays vs. what goes

**Real example of personality from Knotcutter:**
```markdown
## Collaboration Style

**Be ruthless about:**
- What stays vs. what goes
- Questioning every abstraction
- Exposing over-engineering
- Challenging assumptions
```

This gives the agent character and helps it maintain consistent behavior.

### 4. Structure the Agent File

Create the agent file at `claude/agents/{agent-name}.md` following this pattern:

```markdown
---
name: agent-name
description: "Brief role description. Include specific use cases and keywords. Use when [scenario 1], [scenario 2], or [scenario 3]."
color: green
model: sonnet
effort: medium
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

✅ **Pathfinder (inputs and behavior):**
```yaml
description: "Strategic planning consultant: turns a clear task (Askmaw Task Brief, Tracebloom report, or clear request) into a reviewed work plan, asking the user only on a real fork between approaches"
```
- Clear role: "Strategic planning consultant"
- Names its inputs: Task Brief, Tracebloom report, clear request
- States its key behavior: asks only on a real fork

✅ **Tracebloom (scenario in the user's words):**
```yaml
description: "Read-only investigative agent for open-ended 'why is this broken?' tasks. Produces a structured Diagnostic Report with observations, tests performed, root cause (or inconclusive), and recommended next action. Invoked before any plan or fix exists."
```
- Quotes the phrase users actually say: "why is this broken?"
- Deliverable listed: a Diagnostic Report and what it contains
- Timing is explicit: before any plan or fix exists

✅ **Quill (deliverables and inputs):**
```yaml
description: "Documentation specialist. Produces or updates project docs (READMEs, API specs, architecture guides, user manuals) from a session plan and a list of changed files."
```
- Deliverables listed: READMEs, API specs, architecture guides, user manuals
- Inputs listed: a session plan and changed files

✅ **Riskmancer (keyword-rich):**
```yaml
description: "Security vulnerability detection specialist (OWASP, secrets, auth, crypto)."
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

- **opus**: Complex reasoning, planning, security analysis, reviews
- **sonnet**: General-purpose work, orchestration, intake, balanced tasks
- **haiku**: Fast, simple, straightforward tasks
- **inherit**: Use the invoking session's model; reserve for agents whose task spectrum is very broad (Bitsmith)

Most agents use Sonnet. Use Opus for planning, review, and security work requiring deeper reasoning. `claude/references/agent-model-policy.md` lists the current tier of every agent; update it when you add an agent or change a tier.

Also set `effort` (`low`, `medium`, `high`, `xhigh`, `max`): `low` for lightweight work (Quill), `medium` for routine work (Bitsmith, Askmaw), `high` for reasoning-heavy work (Pathfinder, Ruinor, Tracebloom).

### 7. Define Tool Access

Specify tools in the frontmatter as a comma-separated string:

```yaml
tools: "Read, Write, Edit, Bash, Grep, Glob"
```

For read-only agents, leave Write and Edit out of `tools`. `disallowedTools` also exists, but an explicit `tools` list is the convention here.

Use `Agent` (not its old name `Task`) for agents that delegate to other agents.

Other frontmatter fields used in this repo:
- `color`: One of `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan`. Other values are not supported.
- `permissionMode`: `acceptEdits` for agents that write files, `auto` for agents that run read-only Bash (reviewers, Tracebloom). Omit it for agents with no write or Bash tools, and for the Dungeon Master, which runs as the main-thread orchestrator.
- `skills`: Skills to preload into the agent's context (e.g., `implementation-discipline` for Bitsmith).
- `memory`: Persistent memory scope (`user`, `project`, `local`); Everwise uses `user`.

Repo-only metadata (Claude Code ignores these; only this repo's docs read them):
- `level`: Priority/depth level (e.g., `level: 4` for Pathfinder)
- `mandatory`, `invoke_when`: Reviewer metadata (e.g., `mandatory: true` for Ruinor)

**Common tool patterns from existing agents:**

| Agent Type | Tools | Notes |
|------------|-------|-------|
| **Research/Analysis** | Read, Grep, Glob, Bash | Read-only investigation |
| **Implementation** | Read, Write, Edit, Bash, Grep, Glob, Agent | Full file manipulation |
| **Orchestrator** | Agent, Read, Grep, Glob, Bash, AskUserQuestion | Delegation-focused |
| **Security** | Read, Grep, Glob, Bash, WebFetch, WebSearch | Read-only, with web lookups for advisories |
| **Planning** | Read, Write, Grep, Glob, Bash, Agent | Research + plan creation |

**Examples from actual agents:**
- Pathfinder: `"Read, Write, Grep, Glob, Bash, Agent"`
- Riskmancer: `"Read, Grep, Glob, Bash, WebFetch, WebSearch"`
- Knotcutter: `"Read, Grep, Glob, Bash"`
- Quill: `"Read, Grep, Glob, Bash, Write, Edit"`
- Dungeon Master: `"Agent, Read, Grep, Glob, Bash, AskUserQuestion"`

### 8. Add Agent to Documentation

After creating the agent file, update:

1. **docs/AGENTS.md**: Add compact profile with:
   - Quick reference table entry
   - Compact profile section using the standard template (Core Mission, When to invoke, Key constraint, Best Practice, Configuration File)
   - Lore paragraph if the agent has a fantasy persona

2. **README.md**: No changes needed — the README is now a concise landing page; agent details live in `docs/AGENTS.md`

## Agent Design Patterns (From Existing Agents)

### Read-Only Pattern (Riskmancer)

For agents that analyze but never modify code:

```yaml
---
name: riskmancer
color: orange
description: "Security vulnerability detection specialist (OWASP, secrets, auth, crypto)."
model: opus
effort: high
permissionMode: auto
level: 3
tools: "Read, Grep, Glob, Bash, WebFetch, WebSearch"
mandatory: false
invoke_when: "security-sensitive features or when Ruinor flags security concerns"
---
```

**Key characteristics:**
- No Write/Edit in its tool list
- States when to invoke it, and when not to, right after the frontmatter
- Focuses on analysis and reporting
- Uses Read, Grep, Glob, Bash for investigation, plus web tools for advisories

**Real example from Riskmancer:**
> "The Riskmancer agent identifies and prioritizes security vulnerabilities before production deployment, focusing on OWASP Top 10 analysis, secrets detection, input validation, and authentication checks."

### Orchestrator Pattern (Dungeon Master)

For agents that coordinate other agents:

```yaml
---
name: dungeonmaster
description: "Use this agent to coordinate multi-step software development work..."
color: purple
tools: "Agent, Read, Grep, Glob, Bash, AskUserQuestion"
model: sonnet
effort: high
---
```

**Key characteristics:**
- Agent tool for delegation
- Clear delegation policy section
- States that it coordinates and never implements
- No Write/Edit tools

**Real example from Dungeon Master:**
> "Your job is to coordinate work exclusively. You must NEVER perform implementation work yourself — even for trivial tasks. Every unit of work must be delegated to the appropriate named agent."

### Specialist Pattern (Knotcutter, Quill)

For focused domain-specific work:

```yaml
---
name: knotcutter
color: yellow
description: "Radical simplification specialist for complexity elimination reviews."
tools: "Read, Grep, Glob, Bash"
model: opus
effort: high
permissionMode: auto
level: 3
mandatory: false
invoke_when: "major refactors, new abstractions, or when Ruinor flags complexity concerns"
---
```

**Key characteristics:**
- Read-only review tools (it recommends cuts rather than making them)
- Strong guiding principles
- Specific success criteria (e.g., "50%+ reduction")
- Clear collaboration style

**Real example from Knotcutter (excerpt from its `## Guiding Principles` section):**
> **YAGNI First**: You Aren't Gonna Need It until proven otherwise
>
> **Concrete Over General**: Build for the specific problem at hand, not hypothetical future cases

### Planning Pattern (Pathfinder)

For agents that research and plan but don't execute:

```yaml
---
name: pathfinder
color: blue
description: "Strategic planning consultant: turns a clear task (Askmaw Task Brief, Tracebloom report, or clear request) into a reviewed work plan, asking the user only on a real fork between approaches"
model: opus
effort: high
permissionMode: acceptEdits
level: 4
tools: "Read, Write, Grep, Glob, Bash, Agent"
skills:
  - planning
---
```

**Key characteristics:**
- Agent tool for delegating research
- Explicitly states "You never implement. You plan."
- Preloads the `planning` skill, which holds the methodology; the agent file adds only its DM-specific rules
- Saves session-namespaced plans (`~/.ai-tpk/plans/{REPO_SLUG}/{SESSION_TS}-{feature-slug}.md`)

**Real example from Pathfinder:**
> "Turn a clear task into an actionable work plan saved to `~/.ai-tpk/plans/{REPO_SLUG}/{SESSION_TS}-{feature-slug}.md`, researching the codebase via agents. You never implement code. You plan."

## Advanced Agent Features

### Special Modes

Some agents have special modes that activate based on flags or context. Example from the `planning` skill that **Pathfinder** preloads:

```markdown
## Consensus mode (high-stakes decisions)

When the user asks for consensus or deliberate treatment (e.g. `--consensus`), or the decision is high-risk and hard to reverse, add:

- **Principles** — 3-5 guidelines for the work
- **Decision drivers** — the top 3 factors influencing the approach
- **Viable options** — 2-4 alternatives with pros, cons, and reversibility
- **Comparison matrix** — options against the decision drivers
- **ADR fields** — Status, Context, Decision, Consequences
```

This allows agents to have enhanced behavior for specific scenarios.

### Examples Section

Include concrete examples to guide behavior. An illustrative example for a planning agent:

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

### Agent Registry

#### When to call Pathfinder

Delegate to Pathfinder when any of the following are true:
- The request is ambiguous or underspecified
- The work spans multiple files, systems, or steps
- There are architectural or sequencing decisions to make
- There is risk of rework without an explicit plan
- The user asks for design, scope, decomposition, or approach
```

When you add an agent that DM should route to, append its `#### When to call {Agent}` subsection to DM's Agent Registry.

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

Here's how **Quill** (documentation specialist) starts. Read `claude/agents/quill.md` for the full file:

```yaml
---
name: quill
color: pink
description: "Documentation specialist. Produces or updates project docs (READMEs, API specs, architecture guides, user manuals) from a session plan and a list of changed files."
tools: "Read, Grep, Glob, Bash, Write, Edit"
model: sonnet
effort: low
permissionMode: acceptEdits
skills:
  - docs-writing
---

# Quill - Documentation Specialist Agent

## Core Mission

Transform intricate codebases and system designs into accessible documentation that expedites developer onboarding while decreasing support overhead.

## Documentation Style and Workflow

The `docs-writing` skill, preloaded into your context, is the canonical style guide and workflow (gap analysis via `doc-review`, outline, write, validate, report). All documentation decisions defer to it. This file adds only the Dungeon Master invocation modes, worktree rules, and escalation protocol.
```

**What makes this agent effective:**
1. ✅ The description says what it produces and from which inputs
2. ✅ The methodology lives in a preloaded skill, so the agent file holds only agent-specific rules
3. ✅ Invocation modes and an escalation protocol define its boundaries
4. ✅ The tool list is limited to what documentation work needs
5. ✅ Focused mission in 1 sentence

## Example: Creating a New Agent

Let's create a hypothetical "CodeReviewer" agent:

**1. Define Intent:**
- Specialty: Code quality and best practices review
- Invoke when: "review this code", "check code quality", "any issues with this PR"
- Produces: Review report with findings and recommendations
- Tools: Read, Grep, Glob, Bash (read-only)
- Model: sonnet

**2. Choose Name:** "sentinel" (guarding code quality)

**3. Create File Structure:**
```yaml
---
name: sentinel
description: "Code quality and best practices reviewer. Use when reviewing pull requests, checking code quality, identifying anti-patterns, or ensuring adherence to project conventions."
color: green
model: sonnet
effort: medium
permissionMode: auto
tools: "Read, Grep, Glob, Bash"
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
Add compact profile to docs/AGENTS.md using the standard template

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

- [ ] YAML frontmatter includes name, description, model, effort, color, tools
- [ ] `color` is one of the 8 allowed values, and delegating agents use `Agent`, not `Task`
- [ ] `claude/references/agent-model-policy.md` lists the new agent's model tier
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
2. Review `docs/AGENTS.md` for agent catalog and `claude/agents/*.md` for detailed operational specs
3. Consider whether this should be a skill instead of an agent
4. Start simple - you can always expand later

---

**Remember**: Agents are meant to be specialized and focused. If an agent tries to do everything, it ends up doing nothing well. Give it one clear job and the tools to do it.
