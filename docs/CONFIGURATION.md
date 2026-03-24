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

## User-Global Instructions (claude/CLAUDE.md)

`CLAUDE.md` is loaded by Claude Code at session start for every project. It mandates two skills that apply globally across all work:

- **`commit-message-guide`** — required for all git commits; conventional commit format is enforced, no exceptions
- **`open-pull-request`** — required for all pull requests and merge requests; no other PR creation method is allowed

These mandates are active for every project. Project-level `.claude/CLAUDE.md` files can provide additional instructions; however, skill mandate enforcement depends on Claude Code's instruction precedence behavior.

## Agents (`claude/agents/`)

Agents are specialized AI assistants that help with specific tasks. They are automatically available in Claude Code.

See [docs/AGENTS.md](/docs/AGENTS.md) for the full agent roster and descriptions.

**Invoking an agent:**
Simply @-mention the agent by name (e.g., `@quill` or `@riskmancer`) in your Claude conversation to activate it.

## Skills (`claude/skills/`)

Skills are reusable capabilities that enhance Claude's functionality.

See the project README for the current skills list.
