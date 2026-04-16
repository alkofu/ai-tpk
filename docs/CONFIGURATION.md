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

#### PermissionRequest Hook - Bash Style Enforcement, Write/Edit/Read Auto-Approve, and Request Logging

Runs when a tool call falls outside the `allowedTools` list and requires permission. Handles Bash commands and Write/Edit/Read tool calls.

**Behavior:**
1. Reads the permission request event from stdin
2. For `Write`, `Edit`, and `Read` tool calls: extracts the `file_path`, normalizes `~` and `$HOME` to the actual home directory, and checks for path traversal (`..` as a path component). Then:
   - Auto-approves `Write` and `Edit` calls whose path targets `~/.ai-tpk/`. `Read` calls to `~/.ai-tpk/` are also auto-approved here.
   - Auto-approves `Read` calls whose path targets an allowed `~/.claude/` config subdirectory or file (agents/, skills/, references/, commands/, hooks/, wrappers/, settings.json, CLAUDE.md). A symlink guard (`readlink -f`) is applied: if the resolved symlink target falls outside the allowlist, the call falls through to the normal dialog instead.
   - Falls through to the normal permission dialog for all other paths.
3. Extracts the Bash command and strips quoted strings to avoid false positives
4. Detects compound operators (`&&`, `;`, embedded newlines) and process substitution (`<(`, `>(`) — denies if found
5. Detects `--no-verify` (and `-n` for `git commit`) on `git commit` and `git push` commands — denies if found
6. For commands that pass the deny checks: neutralizes simple variable expansions (`$VAR`, `${VAR}`, `~`) and checks if the result matches an `allowedTools` Bash pattern. If it matches, runs five safety guards; auto-approves if all pass
7. For commands that do not match any allowedTools pattern, or that fail a safety guard: appends a log entry to `~/.claude/permission-requests.log` and exits without output, leaving the normal permission dialog in place
8. Fails open (no output, exit 0) if `jq` is unavailable

**Why auto-approve?** Three distinct gaps are closed by this hook:
- **Bash with variable expansions:** Claude Code classifies commands containing `$VAR`, `${VAR}`, or `~` as "too-complex" and bypasses `allowedTools` pattern matching in `settings.json`, triggering a permission dialog even when the base command (e.g., `git log`, `mkdir`) is already trusted. The hook closes that gap by performing its own pattern match after neutralizing the expansions.
- **Write/Edit to `~/.ai-tpk/`:** Claude Code's internal permission matcher does not reliably expand `~` before comparing the requested path against the `Write(~/.ai-tpk/**)` / `Edit(~/.ai-tpk/**)` patterns in `settings.json`, triggering a permission dialog on every write to plan, lesson, and open-questions files. The hook closes that gap by performing its own path normalization and matching at runtime.
- **Read of `~/.claude/` config files:** Agents frequently need to read their own installed configuration (skills, agent definitions, references) from `~/.claude/`. Without hook-level approval, these reads trigger a permission dialog despite being listed in `allowedTools`, because `~` expansion is not reliably applied by Claude Code's internal matcher. The hook closes that gap using an explicit allowlist (`is_allowed_claude_read_path`) that covers only configuration subdirectories — runtime state directories (`projects/`, `sessions/`, `history.jsonl`, etc.) are intentionally excluded and continue to require explicit user approval.

**Safety guards (auto-approve path only):**

| Guard | What it blocks |
|-------|---------------|
| Dangerous keywords | `eval`, `exec`, `source`, `sudo` as standalone words (whitespace-delimited to avoid false positives on `--exec-path`, `--source`) |
| `git -c` injection | `git -c key=val` config overrides that can redirect git to arbitrary executables |
| `python -c` / `python3 -c` | Inline code execution arguments |
| `npx` | All `npx` commands (arbitrary package download cannot be distinguished from local project scripts) |
| Complex constructs | Backticks, `$(...)`, pipes, redirections, and complex parameter expansions beyond `$VAR`/`${VAR}` |

All guards operate on single-quote-stripped input so that dangerous constructs inside double-quoted strings (e.g., `--format="$(date)"`) remain visible and are caught.

**Purpose:** Enforces the bash style rules defined in `claude/references/bash-style.md` at the permission stage. Eliminates disruptive permission dialogs for trusted commands that contain simple variable expansions, while keeping the human permission checkpoint intact for commands that are not covered by `allowedTools` or that fail a safety guard.

**Configuration:**
- Script: `claude/hooks/permission-learn.sh`
- Type: PermissionRequest hook
- Timeout: 5 seconds
- Requires `jq`; fails gracefully if unavailable

**Log format** (`~/.claude/permission-requests.log`):
```
2026-04-09T14:27:44Z | agent_type=Bitsmith | agent_id=abc123 | [auto-approved] command=git log --format=$FORMAT
2026-04-09T14:27:50Z | agent_type=Bitsmith | agent_id=abc123 | command=docker ps
2026-04-09T14:27:55Z | agent_type=Bitsmith | agent_id=abc123 | [auto-approved] write_path=/home/alice/.ai-tpk/plans/repo/plan.md
2026-04-09T14:28:02Z | agent_type=Quill | agent_id=def456 | [auto-approved] read_path=/home/alice/.claude/skills/commit-message-guide/SKILL.md
```

Auto-approved entries include the `[auto-approved]` marker; calls falling through to the permission dialog have no marker. Write/Edit auto-approvals use `write_path=`; Read auto-approvals use `read_path=`.

**Examples:**
- Denied: `git status && git diff` (contains `&&` — agent is told to split into separate calls)
- Denied: `cd repo ; npm install` (contains `;`)
- Denied: `diff <(sort a.txt) <(sort b.txt)` (process substitution — agent is told to use temp files)
- Denied: `git commit --no-verify -m "msg"` (bypasses pre-commit hooks)
- Denied: `git commit -n -m "msg"` (short form of `--no-verify` for `git commit`)
- Denied: `git push --no-verify` (bypasses pre-push hooks)
- Auto-approved: `git log --format=$FORMAT` (matches `git *`, simple expansion only, no safety guard triggered)
- Auto-approved: `mkdir -p $HOME/.config` (matches `mkdir *`)
- Auto-approved: `ls ~/projects` (matches `ls *`, tilde is a simple expansion)
- Auto-approved: `gh pr list --repo $REPO` (matches `gh pr *`)
- Auto-approved: `Write to ~/.ai-tpk/plans/repo/plan.md` (matches user-scoped artifact path; `~` expanded at runtime)
- Auto-approved: `Edit to $HOME/.ai-tpk/lessons/candidates.jsonl` (matches user-scoped artifact path; `$HOME` expanded at runtime)
- Auto-approved: `Read ~/.claude/skills/commit-message-guide/SKILL.md` (allowed config subdirectory)
- Auto-approved: `Read ~/.claude/agents/bitsmith.md` (allowed config subdirectory)
- Auto-approved: `Read ~/.claude/CLAUDE.md` (allowed exact-match file)
- Logged + normal dialog: `Read ~/.claude/projects/proj/conversation.jsonl` (sensitive runtime data — not in allowlist)
- Logged + normal dialog: `Read ~/.claude/history.jsonl` (sensitive runtime data — not in allowlist)
- Logged + normal dialog: `Read ~/.ssh/id_rsa` (outside all allowed paths)
- Logged + normal dialog: `docker ps` (single command not in allowedTools)
- Logged + normal dialog: `grep "a && b" file.txt` (compound operator inside a quoted string — no false positive on deny; no allowedTools pattern match — falls through)
- Logged + normal dialog: `gh extension install $PKG` (no matching allowedTools pattern for `gh extension`)
- Logged + normal dialog: `git log --format="$(date)"` (safety guard: `$(...)` inside double quotes)
- Logged + normal dialog: `git -c core.editor="vi" diff` (safety guard: `git -c` config injection)
- Logged + normal dialog: `python3 -c "code"` (safety guard: `python3 -c`)
- Logged + normal dialog: `sudo rm -rf $DIR` (safety guard: dangerous keyword `sudo`)
- Logged + normal dialog: `Write to /tmp/output.txt` (path not in allowed set — falls through to normal dialog)
- Allowed: `echo -n hello`, `git log -n 5` (context-aware: `-n` only blocked in `git commit` context)

#### SessionStart Hook - Terminal Tab Title Restore

Runs at the start of every Claude Code session to restore a previously stored terminal tab title for resumed sessions. Title generation is handled by the Stop hook (`tab-rename-stop.sh`).

**Purpose:** Restores a previously stored terminal tab title when resuming a session. Script: `claude/hooks/session-start.sh`.

**Non-obvious behaviors:** `--name` override is detected via process ancestry (walks up to 3 levels); `-n` is intentionally excluded to avoid false positives. New sessions exit silently — title generation is deferred to the Stop hook after the first exchange.

**Supported terminals and detection:**

| Terminal | Detection | Title mechanism |
|----------|-----------|-----------------|
| tmux | `$TMUX` non-empty | `tmux rename-window` |
| cmux | `$CMUX_WORKSPACE_ID` set (primary) or `$TERM_PROGRAM=ghostty` (fallback) | `cmux rename-tab` CLI; OSC 0 escape if `cmux` not in PATH |
| iTerm2 | `$TERM_PROGRAM=iTerm.app` | OSC 0 escape sequence (`\033]0;...\007`) |

**Detection rationale:** tmux is checked before `$TERM_PROGRAM` because the tmux window name is the visible label regardless of the host terminal emulator (e.g., iTerm2 running in tmux integration mode shows the tmux window name, not the iTerm2 tab title).

**Async and timeout:** The hook runs asynchronously with a 30-second timeout so that title restore does not block session startup.

#### SubagentStop Hook - Session Capture

Runs after every sub-agent completion to capture raw session event data.

**Purpose:** Appends raw sub-agent completion events to `logs/talekeeper-raw.jsonl` for later enrichment. Script: `claude/hooks/talekeeper-capture.sh`.

**Non-obvious behavior:** Filters out `hook-agent-*` events — Stop hook agents are not real sub-agents and must not pollute the log. Always exits 0; logging must never block the session.

#### Stop Hook - Session Enrichment

Two Stop hooks run asynchronously when you end a Claude session. This section covers session enrichment. See "Stop Hook - Terminal Tab Title Generation" below for the tab rename hook.

Note: A second Stop hook (`tab-rename-stop.sh`) also fires asynchronously for terminal tab renaming — see below.

**Session enrichment (async):**

Processes the raw sub-agent event log captured during the session into a structured enriched JSONL chronicle. Script: `claude/hooks/talekeeper-enrich.sh`.

**Non-obvious behaviors:** Filters out `hook-agent-*` events and `talekeeper` self-captures. Reads each agent's transcript file (`agent_transcript_path`) and sums token usage across all assistant turns. Clears the raw log on success.

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
| `input_tokens` | integer | Total input tokens consumed by the agent (summed across all assistant turns); `0` when transcript is unavailable |
| `output_tokens` | integer | Total output tokens produced by the agent; `0` when transcript is unavailable |
| `cache_creation_input_tokens` | integer | Total tokens written to the prompt cache by the agent; `0` when transcript is unavailable |
| `cache_read_input_tokens` | integer | Total tokens read from the prompt cache by the agent; `0` when transcript is unavailable |

The `agent_transcript_path` field enables downstream tools (like Everwise Scout) to discover and read raw subagent transcripts for deeper analysis. The token fields enable Everwise to identify agents or sessions with disproportionate token consumption without requiring direct transcript access.

#### Stop Hook - Terminal Tab Title Generation

Runs after every Claude turn (Stop hook) to generate and store an AI-derived terminal tab title. Title generation fires once per session — subsequent Stop hook invocations are no-ops once a title file exists for the session.

**Purpose:** Generates an AI-derived terminal tab title after the first exchange and stores it for future session resume. Script: `claude/hooks/tab-rename-stop.sh`.

**Non-obvious behaviors:**
- Single-fire guard: once `~/.claude/session-titles/{session_id}` exists, the hook exits immediately — subsequent Stop invocations are no-ops.
- `--name` sentinel: if launched with `--name`, the hook writes an *empty* sentinel file. This locks the title to whatever the terminal already shows and causes `session-start.sh` to exit silently on resume.
- Minimum 1 user message required before title generation — sessions that end before the first exchange produce no title.
- Uses `claude -p --bare --model haiku` in pipe mode to generate the title; pipe mode (`-p`) does not fire session hooks, preventing recursive invocation.

**Supported terminals and detection:** Same table as the SessionStart hook above.

**Async and timeout:** The hook runs asynchronously with a 30-second timeout so that title generation does not block the user between turns.

## Instructions: User-Global vs. Project-Level

Claude Code loads instructions at two levels:

### User-Global Instructions (claude/CLAUDE.md)

`claude/CLAUDE.md` is installed to `~/.claude/CLAUDE.md` by the installer and loaded by Claude Code at session start for every project. It contains two types of global constraints:

**Mandatory skills** — three skills that apply globally across all work:

- **`commit-message-guide`** — required for all git commits; conventional commit format is enforced, no exceptions
- **`open-pull-request`** — required for all pull requests and merge requests; no other PR creation method is allowed
- **`validate-before-pr`** — runs lint and format checks as a mandatory gate before PR creation; must pass before open-pull-request can be invoked

**Behavioral constraints** — directives that govern how Claude Code behaves before and during execution:

- **Bash Command Style** — prohibits command chaining (`&&`, `;`), process substitution, and command substitution (`$(...)`) or heredoc patterns in git commit commands; each command must be issued as a standalone Bash call; git commits must use multiple `-m` flags instead of shell constructs
- **Think Before Coding** — requires surfacing ambiguous interpretations before acting, disclosing non-obvious assumptions, proposing simpler alternatives when they exist, and stopping to ask rather than guessing when context is insufficient

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

- **`bash-style.md`** — Required Bash command style for all agents with Bash tool access. Defines four enforced rules: no compound commands (`&&`, `;`), no process substitution (`<(`, `>(`), no `--no-verify` on git commands, and no command substitution (`$(...)`) or heredoc patterns in git commit commands (use multiple `-m` flags instead). The PermissionRequest hook enforces the first three rules automatically; the fourth is an instruction-level override of Claude Code's built-in commit pattern.

- **`implementation-standards.md`** — Shared behavioral norms for implementation, planning, and review agents: Minimal Diff, YAGNI, and Test-First Protocol. Bitsmith, Pathfinder, Ruinor, and Knotcutter cite this as the canonical source. Each agent may elaborate with role-specific depth in its own definition file.

- **`verdict-taxonomy.md`** — Shared verdict labels (REJECT, REVISE, ACCEPT-WITH-RESERVATIONS, ACCEPT) and severity scales (Ruinor's CRITICAL/MAJOR/MINOR and Specialist CRITICAL/HIGH/MEDIUM/LOW). Reviewer agents load this reference when issuing verdicts. Defines shared vocabulary while noting that domain-specific application is defined per-agent.

- **`worktree-protocol.md`** — Shared rules for interpreting the `WORKING_DIRECTORY:` context block. Agents that operate in isolated git worktrees load this reference to ensure consistent path handling across all file operations and bash commands.

- **`completion-templates.md`** — Four rigid per-command completion report templates and a shared Common Fields block. Defines what the DM must emit at the end of each pipeline: Template A (Constructive, `/feature`), Template B (Investigative, `/bug`), Template C (Operational PR, `/open-pr`), and Template D (Post-Merge, `/merged` and `/merge-pr`). The DM output contract references this file; templates are verbatim formats with no formatting discretion left to the model.

When updating a reference file, changes apply automatically to all agents that load it — no individual agent files need modification.

## Skills (`claude/skills/`)

Skills are reusable capabilities that enhance Claude's functionality.

See the project README for the current skills list.
