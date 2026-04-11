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

#### PermissionRequest Hook - Compound Command Enforcement and Request Logging

Runs when a Bash command falls outside the `allowedTools` list and requires permission.

**Behavior:**
1. Reads the permission request event from stdin
2. Extracts the Bash command and strips quoted strings to avoid false positives
3. Detects compound operators: `&&`, `;` (semicolon), or embedded newlines
4. Denies permission if compound operators are found, returning a message directing the agent to split the command into separate Bash calls
5. For single commands, appends a log entry to `~/.claude/permission-requests.log` and exits without output, leaving the normal permission dialog in place
6. Fails open (no output, exit 0) if `jq` is unavailable

**Purpose:** Enforces the no-compound-commands rule defined in `claude/references/bash-style.md` at the permission stage. Keeps the human permission checkpoint intact for any single command not already covered by `allowedTools`, while providing a log for manual review of what commands are being requested.

**Configuration:**
- Script: `claude/hooks/permission-learn.sh`
- Type: PermissionRequest hook
- Timeout: 5 seconds
- Requires `jq`; fails gracefully if unavailable

**Log format** (`~/.claude/permission-requests.log`):
```
2026-04-09T14:27:44Z | agent_type=Bitsmith | agent_id=abc123 | command=npm install express
```

**Example:**
- Denied: `git status && git diff` (contains `&&` — agent is told to split into separate calls)
- Denied: `cd repo ; npm install` (contains `;`)
- Logged + normal dialog: `docker ps` (single command not in allowedTools)
- Allowed silently: `grep "a && b" file.txt` (compound operator is inside a quoted string)

#### SessionStart Hook - Terminal Tab Title Restore

Runs at the start of every Claude Code session to restore a previously stored terminal tab title for resumed sessions. Title generation is handled by the Stop hook (`tab-rename-stop.sh`).

**Behavior:**
1. Reads the session start event from stdin and parses `session_id` via `jq`; exits silently if `session_id` is absent
2. Checks for a `--name` override — walks up to 3 levels of process ancestry; if `--name` (long form only; `-n` is intentionally not checked to avoid false positives with unrelated processes) is detected, exits without setting a title
3. Looks up `~/.claude/session-titles/{session_id}`; if no file exists (new session), exits silently — title generation will be handled by the Stop hook after the first exchange
4. If a stored title is found, detects the active terminal emulator and restores the title to the terminal tab

**Supported terminals and detection:**

| Terminal | Detection | Title mechanism |
|----------|-----------|-----------------|
| tmux | `$TMUX` non-empty | `tmux rename-window` |
| cmux | `$CMUX_WORKSPACE_ID` set (primary) or `$TERM_PROGRAM=ghostty` (fallback) | `cmux rename-tab` CLI; OSC 0 escape if `cmux` not in PATH |
| iTerm2 | `$TERM_PROGRAM=iTerm.app` | OSC 0 escape sequence (`\033]0;...\007`) |

**Detection rationale:** tmux is checked before `$TERM_PROGRAM` because the tmux window name is the visible label regardless of the host terminal emulator (e.g., iTerm2 running in tmux integration mode shows the tmux window name, not the iTerm2 tab title).

**`--name` interaction:** If the user launches Claude with `--name` (to set a session name explicitly), the hook detects this via process ancestry inspection and exits without overwriting the title.

**Async and timeout:** The hook runs asynchronously with a 30-second timeout so that title restore does not block session startup.

**Dependencies:**
- `bash` — required
- `jq` — required; used for payload parsing; hook exits silently if unavailable
- `cmux` CLI — optional; used for cmux tab renaming; falls back to OSC 0 escape if not in PATH

**Configuration:**
- Script: `claude/hooks/session-start.sh`
- Type: Async SessionStart hook
- Timeout: 30 seconds

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

#### Stop Hook - Session Enrichment

Two Stop hooks run asynchronously when you end a Claude session. This section covers session enrichment. See "Stop Hook - Terminal Tab Title Generation" below for the tab rename hook.

Note: A second Stop hook (`tab-rename-stop.sh`) also fires asynchronously for terminal tab renaming — see below.

**Session enrichment (async):**

Processes the raw sub-agent event log captured during the session into a structured chronicle.

1. Reads `logs/talekeeper-raw.jsonl`
2. Filters out `hook-agent-*` noise and `talekeeper` self-captures
3. Extracts structured fields (agent type, session ID, reviewer verdicts) from each entry
4. Writes an enriched JSONL chronicle to `logs/talekeeper-{session_id}.jsonl`
5. Clears the raw log on success

**Enriched Chronicle Schema:**

Each JSONL line in `logs/talekeeper-{session_id}.jsonl` contains:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string (ISO 8601) | When the sub-agent event was captured |
| `event_type` | string | Hook event name (typically `SubagentStop`) |
| `agent_type` | string | Name of the agent (e.g., `pathfinder`, `bitsmith`, `ruinor`) |
| `agent_id` | string | Unique identifier for the agent invocation |
| `session_id` | string | Session ID correlating all events in a session |
| `summary` | string | Structural summary of the agent's completion (not free-text input) |
| `verdict` | string or null | For reviewer agents only: `ACCEPT`, `REVISE`, `REJECT`, or `ACCEPT-WITH-RESERVATIONS`; `null` otherwise |
| `agent_transcript_path` | string or null | For SubagentStop events: path to the agent's JSONL transcript in `~/.claude/projects/`; `null` for non-SubagentStop events |

The `agent_transcript_path` field enables downstream tools (like Everwise Scout) to discover and read raw subagent transcripts for deeper analysis.

**Configuration:**
- Script: `claude/hooks/talekeeper-enrich.sh`
- Type: Async command hook
- Timeout: 60 seconds
- Requires `jq`; exits silently if unavailable or raw log is empty

#### Stop Hook - Terminal Tab Title Generation

Runs after every Claude turn (Stop hook) to generate and store an AI-derived terminal tab title. Title generation fires once per session — subsequent Stop hook invocations are no-ops once a title file exists for the session.

**Behavior:**
1. Reads the Stop event from stdin; parses `session_id`, `transcript_path`, `cwd`, and `last_assistant_message`
2. Single-fire guard: if `~/.claude/session-titles/{session_id}` already exists, exits immediately
3. Checks for a `--name` override via process ancestry (walk up to 3 levels); if `--name` is detected, creates an empty sentinel file at `~/.claude/session-titles/{session_id}` and exits — this prevents future Stop hook invocations from generating a title, and also causes `session-start.sh` to exit silently on resume (preserving whatever title the terminal shows)
4. Counts non-meta user messages in the transcript JSONL; exits without generating a title if fewer than 1 user message is found (e.g., the session ended before the first exchange completed)
5. Extracts the first user prompt from the transcript JSONL file and the last assistant response from the Stop event payload
6. Gathers lightweight project context: directory name and git repo name (if available)
7. Calls `claude -p --bare --model haiku` with a constrained system prompt to generate a 2–5 word session title; `--bare` strips the default system prompt; pipe mode (`-p`) does not fire session hooks, avoiding recursive invocation
8. Sanitizes the title (removes embedded newlines, strips surrounding whitespace, truncates to 40 characters)
9. Stores the title at `~/.claude/session-titles/{session_id}`
10. Detects the active terminal emulator and sets the tab title

**Supported terminals and detection:** Same table as the SessionStart hook above.

**`--name` interaction:** If a session was started with `--name`, the hook writes an empty sentinel file. This means the session title is locked to whatever the terminal already shows — no AI title is generated now or on future resumes.

**Async and timeout:** The hook runs asynchronously with a 30-second timeout so that title generation does not block the user between turns.

**Dependencies:**
- `bash` — required
- `jq` — required; used for transcript parsing and payload extraction; hook exits silently if unavailable
- `claude` CLI — required; used for AI title generation; hook exits silently if invocation fails
- `git` — optional; used for repo name context; absent git context is handled gracefully
- `cmux` CLI — optional; used for cmux tab renaming; falls back to OSC 0 escape if not in PATH

**Configuration:**
- Script: `claude/hooks/tab-rename-stop.sh`
- Type: Async Stop hook
- Timeout: 30 seconds

## Instructions: User-Global vs. Project-Level

Claude Code loads instructions at two levels:

### User-Global Instructions (claude/CLAUDE.md)

`claude/CLAUDE.md` is installed to `~/.claude/CLAUDE.md` by the installer and loaded by Claude Code at session start for every project. It mandates three skills that apply globally across all work:

- **`commit-message-guide`** — required for all git commits; conventional commit format is enforced, no exceptions
- **`open-pull-request`** — required for all pull requests and merge requests; no other PR creation method is allowed
- **`validate-before-pr`** — runs lint and format checks as a mandatory gate before PR creation; must pass before open-pull-request can be invoked

### Project-Level Instructions (.claude/CLAUDE.md)

`.claude/CLAUDE.md` is loaded by Claude Code only in this repository. It provides project-scoped instructions that override or supplement user-global directives.

**This repository's project-level guard:** Before creating or modifying agents, skills, commands, hooks, references, CLAUDE.md, or settings, you must clarify which scope is intended:
- **User scope** (`claude/`) — applied globally across all repositories
- **Project scope** (`.claude/`) — applied only to this repository

See `.claude/CLAUDE.md` for the full scope clarification rules and trigger cases.

**Note:** Skill mandate enforcement depends on Claude Code's instruction precedence behavior. Project-level mandates are intended to supplement, not override, user-level mandates.

## Agents (`claude/agents/`)

Agents are specialized AI assistants that help with specific tasks. They are automatically available in Claude Code.

See [docs/AGENTS.md](/docs/AGENTS.md) for the agent roster and quick reference. For detailed operational specs, tool lists, and workflows, see each agent's config file in `claude/agents/{name}.md`.

**Invoking an agent:**
Simply @-mention the agent by name (e.g., `@quill` or `@riskmancer`) in your Claude conversation to activate it.

## References (`claude/references/`)

Reference files contain shared behavioral vocabulary loaded by agents at runtime. These files eliminate duplication across multiple agent definitions and ensure consistency in how agents apply shared concepts.

### Available References

- **`verdict-taxonomy.md`** — Shared verdict labels (REJECT, REVISE, ACCEPT-WITH-RESERVATIONS, ACCEPT) and severity scales (Ruinor's CRITICAL/MAJOR/MINOR and Specialist CRITICAL/HIGH/MEDIUM/LOW). Reviewer agents load this reference when issuing verdicts. Defines shared vocabulary while noting that domain-specific application is defined per-agent.

- **`worktree-protocol.md`** — Shared rules for interpreting the `WORKING_DIRECTORY:` context block. Agents that operate in isolated git worktrees load this reference to ensure consistent path handling across all file operations and bash commands.

When updating a reference file, changes apply automatically to all agents that load it — no individual agent files need modification.

## Skills (`claude/skills/`)

Skills are reusable capabilities that enhance Claude's functionality.

See the project README for the current skills list.
