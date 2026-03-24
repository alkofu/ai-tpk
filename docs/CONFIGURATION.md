# Configuration Guide

This document explains the Claude Code configurations included in this repository.

## Settings (`claude/settings.json`)

The settings file configures Claude Code's behavior, including plugins, marketplaces, and hooks.

### Marketplaces

Pre-configured marketplaces for plugin discovery:

- **claude-plugins-official** - Anthropic's official plugin repository
  - Source: `anthropics/claude-plugins-official` (GitHub)

### Hooks

Hooks allow you to run automated checks or tasks at specific points in your Claude workflow.

#### SubagentStop Hook - Session Capture

Runs after every sub-agent completion to capture raw session event data.

**Behavior:**
1. Reads the sub-agent completion event from stdin
2. Filters out internal `hook-agent-*` events (Stop hook agents are not real sub-agents)
3. Appends a timestamped JSONL entry to `logs/talekeeper-raw.jsonl`
4. Always exits 0 — logging must never block the session

**Configuration:**
- Script: `claude/hooks/talekeeper-capture.sh`
- Type: Command hook
- Timeout: 5 seconds
- Requires `jq` for filtering; falls back to a minimal entry if unavailable

#### Stop Hook - Documentation Check + Session Enrichment

Two hooks run when you end a Claude session.

**Hook 1 — Documentation check (synchronous, gated):**

1. First checks whether any code changes exist via `git diff --quiet HEAD`; exits early (halts pipeline) if the working tree is clean
2. If changes exist, an agent reviews uncommitted changes, compares them against existing documentation, and updates docs if gaps are found

**Configuration:**
- Gate: Command hook (`git diff --quiet HEAD && exit 1 || exit 0`) with `halt_pipeline: true`, timeout 5 seconds
- Docs agent: Agent-based hook, timeout 60 seconds
- Conservative approach: Only triggers for substantive changes requiring documentation

**Hook 2 — Session enrichment (async):**

Processes the raw sub-agent event log captured during the session into a structured chronicle.

1. Reads `logs/talekeeper-raw.jsonl`
2. Filters out `hook-agent-*` noise and `talekeeper` self-captures
3. Extracts structured fields (agent type, session ID, reviewer verdicts) from each entry
4. Writes an enriched JSONL chronicle to `logs/talekeeper-{session_id}.jsonl`
5. Clears the raw log on success

**Configuration:**
- Script: `claude/hooks/talekeeper-enrich.sh`
- Type: Async command hook
- Timeout: 60 seconds
- Requires `jq`; exits silently if unavailable or raw log is empty

## Agents (`claude/agents/`)

Agents are specialized AI assistants that help with specific tasks. They are automatically available in Claude Code.

**Available agents:**
- **Dungeon Master** - Orchestrator for coordinating multi-step software development work with intelligent planning and execution delegation
- **Quill** - Documentation specialist for README files, API specs, and architecture guides
- **Riskmancer** - Security specialist reviewer (invoked when security-sensitive work detected or explicitly requested)
- **Pathfinder** - Planning consultant for work plans, requirement gathering, and implementation strategy
- **Knotcutter** - Complexity specialist reviewer (invoked when complexity concerns detected or explicitly requested)
- **Ruinor** - Mandatory baseline quality gate reviewer (runs on all plan and implementation reviews)
- **Windwarden** - Performance specialist reviewer (invoked when performance-critical work detected or explicitly requested)
- **Bitsmith** - Precision code executor for implementing plans, making targeted code changes, and minimal-diff edits
- **Talekeeper** - Manual narrator agent; reads enriched session chronicles and produces human-readable narrative summaries with Mermaid diagrams, appended to `logs/talekeeper-narrative.md`
- **Everwise** - Learner agent; analyzes Talekeeper session chronicles to identify recurring agent-team failures and propose evidence-based config improvements

**Review Workflow:**
The orchestration system uses an intelligent review workflow where Ruinor provides mandatory baseline coverage, and specialists (Riskmancer, Windwarden, Knotcutter) are invoked only when needed. This reduces review overhead by 60-70% while maintaining quality rigor.

See [docs/adrs/REVIEW_WORKFLOW.md](/docs/adrs/REVIEW_WORKFLOW.md) for the complete review workflow guide.

**Invoking an agent:**
Simply @-mention the agent by name (e.g., `@quill` or `@riskmancer`) in your Claude conversation to activate it.

For complete agent capabilities, workflows, use cases, and best practices, see [docs/AGENTS.md](/docs/AGENTS.md).

## Skills (`claude/skills/`)

Skills are reusable capabilities that enhance Claude's functionality. See individual skill directories for specific documentation:

- `skill-creator/` - Meta-skill for creating new Claude skills
- `commit-message-guide/` - Generates conventional commit messages
- `open-pull-request/` - Automates GitHub pull request creation
