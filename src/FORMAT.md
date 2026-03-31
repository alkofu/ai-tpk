# Source Agent Format Schema

This document describes the canonical format for agent definition files in `src/agents/`. These files are the single source of truth for all agent definitions. Adapter scripts in `adapters/` transform them into harness-specific formats.

## File Naming

Agent names are derived from the filename. A file named `bitsmith.md` defines the agent named `bitsmith`. No `name` field appears in frontmatter.

## Universal Fields

These fields appear in every source agent file and are understood by all adapters:

```yaml
---
description: "Short description of what the agent does."
model: claude-sonnet-4-6
system_prompt_below: true
---
```

| Field               | Type    | Required | Description                                                   |
|---------------------|---------|----------|---------------------------------------------------------------|
| `description`       | string  | yes      | One-line description of the agent's role and capabilities     |
| `model`             | string  | yes      | Full model identifier (see Model Identifier Format below)     |
| `system_prompt_below` | boolean | yes  | Always `true`; signals that the Markdown body is the system prompt |

The `name` field is intentionally absent. Both Claude Code and OpenCode derive the agent name from the filename.

## Model Identifier Format

The `model` field uses full model identifiers as the source of truth. No short aliases or neutral names.

| Source identifier    | Claude Code output     | OpenCode output                   |
|----------------------|------------------------|-----------------------------------|
| `claude-sonnet-4-6`  | `claude-sonnet-4-6`    | `anthropic/claude-sonnet-4-6`     |
| `claude-opus-4-6`    | `claude-opus-4-6`      | `anthropic/claude-opus-4-6`       |
| `claude-haiku-4-5`   | `claude-haiku-4-5`     | `anthropic/claude-haiku-4-5`      |

The Claude adapter emits the model identifier as-is. The OpenCode adapter prepends `anthropic/` if the identifier is not already prefixed.

## Harness-Specific Extension Blocks

Fields that apply only to a specific harness live under a namespaced key. Adapters for other harnesses ignore blocks they do not own.

```yaml
---
description: "..."
model: claude-sonnet-4-6
system_prompt_below: true

claude:
  tools: "Read, Write, Edit, Bash, Grep, Glob, Agent"
  level: 2

opencode:
  permission:
    - read
    - write
    - edit
    - bash
    - grep
    - glob
  mode: subagent
---
```

### The `claude:` Extension Block

Contains all Claude Code-specific frontmatter fields. The Claude adapter reads these fields and emits them verbatim into the output frontmatter.

| Field              | Type              | Description                                                              |
|--------------------|-------------------|--------------------------------------------------------------------------|
| `tools`            | string            | Comma-separated list of permitted tools (Claude Code capitalized names)  |
| `level`            | integer           | Agent trust/capability level                                             |
| `disallowedTools`  | string            | Comma-separated list of tools the agent is forbidden to use              |
| `mandatory`        | boolean           | Whether the agent is always invoked (vs. on-demand)                      |
| `trigger_keywords` | array of strings  | Keywords that trigger automatic invocation of this agent                 |
| `invoke_when`      | string            | Human-readable description of when to invoke this agent                  |

All fields are optional. Include only the fields that apply to the agent.

### The `opencode:` Extension Block

Contains all OpenCode-specific frontmatter fields. The OpenCode adapter reads these fields and emits them into the output frontmatter using only valid OpenCode keys.

| Field         | Type            | Description                                              |
|---------------|-----------------|----------------------------------------------------------|
| `permission`  | array of strings | Lowercase tool names the agent is permitted to use      |
| `mode`        | string          | One of `subagent`, `primary`, `all`                     |
| `temperature` | number          | Sampling temperature                                     |
| `top_p`       | number          | Top-p sampling parameter                                 |
| `color`       | string          | Agent color in the OpenCode UI                           |
| `steps`       | number          | Maximum number of steps the agent may take               |

All fields are optional. The `permission` array must use lowercase OpenCode tool names (see Tool Name Mapping below).

## Tool Name Mapping

Claude Code uses capitalized tool names in a comma-separated string. OpenCode uses lowercase tool names in a YAML array under `permission`. The source format stores each in its native format within the respective extension block.

| Claude Code Tool | OpenCode Tool | Notes                           |
|------------------|---------------|---------------------------------|
| `Read`           | `read`        | Direct mapping (case change)    |
| `Write`          | `write`       | Direct mapping (case change)    |
| `Edit`           | `edit`        | Direct mapping (case change)    |
| `Bash`           | `bash`        | Direct mapping (case change)    |
| `Grep`           | `grep`        | Direct mapping (case change)    |
| `Glob`           | `glob`        | Direct mapping (case change)    |
| `Agent`          | (omit)        | No OpenCode equivalent; omit    |
| `TodoWrite`      | `todowrite`   | Direct mapping (case change)    |

`Agent` has no OpenCode equivalent and must be omitted from the `opencode.permission` array. Tools listed in `claude.disallowedTools` must also be omitted from `opencode.permission`.

OpenCode-only tools (`list`, `lsp`, `patch`, `skill`, `webfetch`, `websearch`, `question`) have no Claude Code equivalent. They may appear in `opencode.permission` if needed but have no entry in `claude.tools`.

## Handling Unmappable Features

Some fields exist in one harness only. The adapter for the other harness ignores them:

| Field              | Claude Code | OpenCode | Strategy                                                    |
|--------------------|-------------|----------|-------------------------------------------------------------|
| `level`            | Yes         | No       | In `claude:` block; OpenCode adapter ignores                |
| `disallowedTools`  | Yes         | No       | In `claude:` block; OpenCode adapter omits those tools from `permission` |
| `mandatory`        | Yes         | No       | In `claude:` block; OpenCode adapter ignores                |
| `trigger_keywords` | Yes         | No       | In `claude:` block; OpenCode adapter ignores                |
| `invoke_when`      | Yes         | No       | In `claude:` block; OpenCode adapter ignores                |
| `mode`             | No          | Yes      | In `opencode:` block; Claude adapter ignores                |
| `steps`            | No          | Yes      | In `opencode:` block; Claude adapter ignores                |
| `color`            | No          | Yes      | In `opencode:` block; Claude adapter ignores                |

## System Prompt Body

Everything after the closing `---` of the frontmatter is the system prompt body. The `system_prompt_below: true` field signals this convention. Adapters copy the body verbatim into generated output without modification.

```
---
description: "..."
model: claude-sonnet-4-6
system_prompt_below: true

claude:
  tools: "Read, Write, Edit"
  level: 2

opencode:
  permission:
    - read
    - write
    - edit
  mode: subagent
---

# Agent Name — Role Title

System prompt content begins here and continues for the rest of the file.
```

## Adding a New Harness

To add support for a new harness:

1. Add a new namespaced extension block (e.g., `myharness:`) to agent files that need harness-specific fields.
2. Create `adapters/to-myharness.sh` that reads universal fields and the `myharness:` block, ignoring all other extension blocks.
3. Update `install.sh` to accept `--harness myharness` and call the new adapter.

Adapters for existing harnesses are unaffected — they continue to ignore the new `myharness:` block.
