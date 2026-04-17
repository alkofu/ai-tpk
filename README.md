<div align="center">
  <img src="docs/images/party.jpg" alt="AI TPK — The Adventuring Party" width="640" />
</div>

# AI TPK

Configuration files for AI coding assistants, managed centrally and deployed to your home directory.

**TPK** stands for **Total Party Kill** - a D&D term for when the entire adventuring party is wiped out. This repository is inspired by tabletop roleplaying games, featuring AI agents with D&D-themed roles like Dungeon Master (orchestrator), Riskmancer (security), and Pathfinder (planning). Just as a well-prepared party survives the dungeon, well-configured AI tools help you survive the codebase.

## Overview

This repository maintains user-scope configuration for:
- **Claude Code** - Anthropic's AI coding assistant CLI
- **Cursor** - AI-powered code editor

## Purpose

Keep AI tool configurations version-controlled and portable across machines. These configs are copied to your user home directory (`~/.claude/`, `~/.cursor/`, etc.).

## Structure

```
.
├── claude/          # User-scope Claude Code configs (synced globally)
│   ├── CLAUDE.md         # User-global instructions (skill mandates)
│   ├── settings.json     # Plugin config, hooks, marketplace settings
│   ├── agents/          # Specialized AI assistants (e.g., Quill for docs)
│   ├── references/       # Shared reference files loaded by agents at runtime
│   ├── skills/          # Reusable capabilities
│   └── commands/        # Slash commands for Claude Code
├── .claude/         # Project-scope Claude Code config (this repo only)
│   ├── CLAUDE.md         # Project-level instructions (scope clarification guard)
│   ├── commands/        # Repo-scoped slash commands (e.g., /build-and-install)
│   └── skills/          # Project-scoped skills
├── cursor/          # Cursor configurations (coming soon)
├── docs/            # Documentation
│   ├── images/          # Project images and diagrams
│   └── CONFIGURATION.md # Detailed configuration guide
└── install.sh       # Installation script
```

### Scope: User vs. Project

This repository has two scopes for Claude Code artifacts:

| Directory | Scope | Effect |
|-----------|-------|--------|
| `claude/` | User | Synced by `install.sh` to `~/.claude/` — applies globally across all repositories |
| `.claude/` | Project | Applies only to this repository — not synced by installer |

When modifying agents, skills, commands, hooks, references, CLAUDE.md, or settings, consult `.claude/CLAUDE.md` for scope clarification rules. Before creating or modifying any scoped artifact, ask: "Repo scope (`.claude/`) or user scope (`claude/`)?"

### Installation

The installer only installs these paths from `claude/` into `~/.claude/`: `CLAUDE.md`, `settings.json`, `skills/`, `agents/`, `commands/`, and `references/`. Anything else in the repo or on disk under `~/.claude/` is left untouched except where those destinations are replaced (after a timestamped backup).

The `.claude/` directory is never synced by the installer — it remains project-local.

### Developer Notes

The installation logic is implemented in TypeScript under `src/installer/`. See the source files there for implementation details.

The `install.sh` shim in the repo root runs the pre-built esbuild bundle (`dist/installer.js`) and verifies Node.js >= 18.18.0 is available.

#### Running Tests

The installer includes a comprehensive test suite using `node:test`:

```bash
pnpm test
```

This runs all test files colocated with source under `src/installer/` and `src/launcher/` (files matching `*.test.ts`) with isolated temporary directories. For more details, see the `*.test.ts` files beside their respective source modules.

#### Code Quality: Linting and Formatting

The project uses **oxlint** (TypeScript linter) and **oxfmt** (code formatter) to maintain consistent code quality.

**pnpm scripts:**

- `pnpm run lint` — Run oxlint to check for TypeScript errors and code quality issues
- `pnpm run format` — Apply oxfmt formatting to all TypeScript files in `src/`
- `pnpm run format:check` — Check formatting without modifying files (used in CI)

**Developer workflow:**

Before committing code, run `pnpm run format` to auto-format your changes. This keeps the codebase consistent and prevents formatting failures in CI.

**Pre-Push Hook:**

Lefthook runs lint and format checks on every push when JS/TS files have changed. If either check fails, the push is blocked. Run `pnpm run format` to auto-fix formatting issues. Hook configuration lives in `lefthook.yml`.

## Installation

**Prerequisites:** Node.js >= 18.18.0 is required to run `install.sh`. The installer is implemented in TypeScript and pre-built to a standalone bundle (`dist/installer.js`) via esbuild.

Clone the repository:
```bash
git clone git@github.com:alkofu/ai-tpk.git
cd ai-tpk
```

Run the installation script:

```bash
./install.sh
```

Copies the whitelisted Claude paths (`CLAUDE.md`, `settings.json`, `skills/`, `agents/`, `commands/`, `references/`) into `~/.claude/` and `~/.cursor/` when present.

### Development Setup

To contribute to this repository, you'll need to set up the development environment:

```bash
# Clone the repository
git clone git@github.com:alkofu/ai-tpk.git
cd ai-tpk

# Install dependencies (requires pnpm)
pnpm install

# Build the installer bundle and test it
pnpm run build
pnpm run setup
```

**Note:** The `pnpm run build` command bundles the installer via esbuild into `dist/installer.js`. The `pnpm run setup` command executes the pre-built bundle, ensuring your development environment uses the same code path as end-users. This keeps installer behavior consistent during development.

After setup, you can test changes locally. The pre-push hook (Lefthook) will automatically run linting and format checks before you push commits.

**Note:** The installer automatically backs up any existing configurations with a timestamp before overwriting them.

### Automatic MCP Server Setup

The installer automatically configures user-scoped MCP (Model Context Protocol) servers in `~/.claude.json` when the `claude` CLI is available. Server definitions are read from a declarative `src/mcp/mcp-servers.json` file, allowing you to add or modify servers without editing TypeScript code.

Currently configured servers:

- **Kubernetes MCP Server** (`mcp-server-kubernetes@3.4.0`) — Read-only Kubernetes cluster access via `~/.kube/config`. Skips setup gracefully if that file does not exist.
- **AWS CloudWatch MCP Server** (`awslabs.cloudwatch-mcp-server@0.0.19`) — CloudWatch Metrics, Alarms, and Logs access via `~/.aws` credentials. Uses `src/mcp/wrappers/mcp-cloudwatch.sh` for dynamic AWS profile selection (set with `/set-aws-profile`). Requires `uvx`. Skips setup gracefully if `~/.aws/credentials` does not exist.
- **Grafana MCP Server** (`mcp-grafana`) — Grafana dashboards, datasources, and incident access. Uses `src/mcp/wrappers/mcp-grafana.sh`, which requires `GRAFANA_URL` and `GRAFANA_SERVICE_ACCOUNT_TOKEN` in the shell environment.
- **GitHub MCP Server** (`@modelcontextprotocol/server-github`) — GitHub repository, issue, PR, and code search access. Requires `GITHUB_PERSONAL_ACCESS_TOKEN` set in `src/mcp/mcp-servers.json` before running `install.sh`. Note: the npm package was archived 2025-05-29; the Docker-based successor (`ghcr.io/github/github-mcp-server`) is not used here to avoid a Docker dependency.
- **GCP Observability MCP Server** (`@google-cloud/observability-mcp@0.2.3`) — Read-only access to GCP Cloud Logging, Monitoring, Trace, and Error Reporting. Requires Node.js 20+ and the gcloud CLI. Authenticate before running `install.sh`: `gcloud auth application-default login` then `gcloud auth application-default set-quota-project YOUR_PROJECT_ID`.

MCP servers are available in all repositories once configured. For detailed information about hooks, agents, and other configuration options, see [docs/CONFIGURATION.md](/docs/CONFIGURATION.md).

**Stamp-based skipping:** After a wrapper-based server is registered, the installer records a config signature in `~/.claude/.mcp-install-stamps.json`. On subsequent runs, if the signature matches and the registration is intact, the server is skipped. To force re-registration of all wrapper servers (e.g., after a broken install or to pick up manual `src/mcp/mcp-servers.json` edits that the installer did not detect), delete this file and re-run `./install.sh`.

### myclaude — Session Launcher

The `myclaude` command is an interactive wizard that configures MCP environment variables and launches Claude with the Dungeon Master agent. Instead of manually exporting environment variables before each session, you run `myclaude` from your shell to select your desired MCPs and their configuration (Grafana cluster + role, AWS profile, GCP project), then launch a pre-configured Claude session.

**Prerequisites:** Run `./install.sh` first to install the launcher to `~/bin/myclaude`.

**Usage:** From any directory, run:

```bash
myclaude
```

The wizard will present a multi-step flow:

1. **MCP Selection** — Choose which MCPs to configure for this session (Grafana, CloudWatch, and/or GCP Observability)
2. **Per-MCP Configuration** — For each selected MCP, choose its settings (cluster/role for Grafana; AWS profile for CloudWatch; GCP project ID for GCP Observability)
3. **Launch** — Claude opens with `--agent dungeonmaster` and the correct environment variables set

**Persistence:** Your last-used selections are saved to `~/.config/myclaude/config.json` and pre-fill the wizard on your next run. You can accept them with Enter or change them.

#### Grafana Configuration

Create `~/.config/grafana-clusters.yaml` with your cluster definitions. The file must use this YAML schema:

```yaml
clusters:
  - id: prod-us-east
    name: Production US-East
    url: https://grafana.prod.us-east.example.com
    viewer_token: glsa_xxxxxxxxxxxxxxxx_viewer
    editor_token: glsa_xxxxxxxxxxxxxxxx_editor

  - id: staging
    name: Staging
    url: https://grafana.staging.example.com
    viewer_token: glsa_yyyyyyyyyyyyyyyy_viewer
    editor_token: glsa_yyyyyyyyyyyyyyyy_editor
```

Each cluster requires:
- `id` — Unique identifier for the cluster
- `name` — Display name shown in the wizard
- `url` — Grafana URL (must start with `http://` or `https://`)
- `viewer_token` — Grafana service account token with read-only permissions
- `editor_token` — Grafana service account token with read-write permissions

The wizard lets you select a cluster and choose a role (Viewer or Editor). If you select Viewer, the launcher automatically sets `GRAFANA_DISABLE_WRITE=true`, which the Grafana MCP server wrapper translates into the `--disable-write` CLI flag.

**Legacy token migration:** If your clusters use a single `token` field instead of separate `viewer_token`/`editor_token` fields, the launcher will fall back to using `token` as `viewer_token` with a warning. Update your YAML to add the new token fields to remove the warning.

#### CloudWatch Configuration

The launcher reads AWS profiles from `~/.aws/config` (preferred) or `~/.aws/credentials` (fallback when config is absent). In the wizard, select your active profile for the current session. The launcher stores this choice in `~/.claude/.current-aws-profile` so the CloudWatch MCP server wrapper can resolve it at startup.

**Note:** This is equivalent to running `/set-aws-profile` in Claude — the launcher and the slash command write to the same dotfile, so they stay in sync.

#### GCP Observability Configuration

Before using GCP Observability, authenticate with Application Default Credentials (ADC):

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

When "GCP Observability" is selected, the launcher runs `gcloud projects list` to fetch accessible projects, checks for valid ADC credentials (checking `GOOGLE_APPLICATION_CREDENTIALS` first, then `~/.config/gcloud/application_default_credentials.json`), then shows a `select()` prompt with the available project IDs. The previously used project is pre-selected when it is still present in the list. The selected project ID is stored in `~/.claude/.current-gcp-project` for the MCP wrapper and persisted for the next run. If `gcloud` is not installed, not authenticated, or returns no projects, a descriptive error is shown and the launcher exits.

**Note:** `GOOGLE_CLOUD_PROJECT` is used by the auth library for project ID resolution only — it does not auto-populate tool call parameters. Specify `resourceNames`, `parent`, `name`, or `projectId` explicitly in each tool call. The wrapper prints the active project to stderr as a context hint for Claude.

#### Environment Variables Set by myclaude

When you select Grafana with Viewer role, the launcher sets:
```
GRAFANA_URL={cluster_url}
GRAFANA_SERVICE_ACCOUNT_TOKEN={viewer_token}
GRAFANA_DISABLE_WRITE=true
```

When you select Grafana with Editor role:
```
GRAFANA_URL={cluster_url}
GRAFANA_SERVICE_ACCOUNT_TOKEN={editor_token}
```

When you select CloudWatch:
```
AWS_PROFILE={profile}
```

When you select GCP Observability:
```
GOOGLE_CLOUD_PROJECT={project_id}
```

These variables are passed to `claude --agent dungeonmaster`, and they flow through to all MCP server subprocesses.

#### MCP Server Configuration Format

Server definitions live in `src/mcp/mcp-servers.json`. Each server uses either a `command` field (inline command array) or a `wrapper` field (path relative to `~/.claude/` pointing to an installed wrapper script) — the two are mutually exclusive. Wrapper scripts live in `src/mcp/wrappers/` in the repo and are installed to `~/.claude/wrappers/` by `install.sh`, so a `wrapper` value of `wrappers/mcp-cloudwatch.sh` resolves to `~/.claude/wrappers/mcp-cloudwatch.sh` at runtime. `$HOME` and `$USER` variable expansion is supported in string values.

Two key operational behaviors: a missing `src/mcp/mcp-servers.json` produces a warning and skips MCP setup (installation continues); a malformed JSON file or schema violation stops installation with a non-zero exit code. See `src/mcp/mcp-servers.json` for the schema and `src/installer/mcp.ts` for the installation logic.

## Continuous Integration

Pull requests targeting `main` are validated by a GitHub Actions workflow at `.github/workflows/ci.yml`. See the workflow file for the specific checks that run. For formatting failures, run `pnpm run format` and commit the result.

## Updating

```bash
cd ai-tpk
git pull
./install.sh
```

Re-running the installer after `git pull` copies the latest configurations into place. Any files already present are backed up with a timestamp before being replaced.

## Recovering Backups

The installer automatically creates timestamped backups (e.g., `settings.json.backup.20260407_143022`) before overwriting any existing files. To browse and restore a backup interactively:

```bash
./recover.sh
```

The script scans `~/.claude` and `~/.cursor` for machine-generated backups, lists them newest-first with their original paths and human-readable timestamps, and prompts you to select one by number. If the original path currently exists, it is itself backed up before the selected backup is moved into place.

## Cleaning Up Old Backups

Over time the installer may accumulate multiple timestamped backups for the same file. `clean-backups.sh` removes all but the most recent backup for each original path, keeping your `~/.claude` and `~/.cursor` directories tidy.

```bash
./clean-backups.sh
```

The script scans the same directories as `recover.sh` (`~/.claude` and `~/.cursor`), groups backups by their original file path, and displays the list of files it will delete before proceeding immediately. Original paths that have only one backup are left untouched.

## Cleaning Up Agent Artifacts

Agent-produced files (Pathfinder plans, Everwise lessons) accumulate in `~/.ai-tpk/` over time. Two mechanisms are available for cleanup:

### `/merged` Command — Post-Merge Plan Cleanup

When you run `/merged` after a PR is merged, the command silently auto-deletes plan files from `~/.ai-tpk/plans/{repo-slug}/` that belong to the current session (matched by session timestamp prefix). No prompt is shown for these files.

If the session timestamp is unavailable (e.g. `/merged` was run in a new session without worktree context), no plan files are touched and no prompt is shown.

Files from other sessions are never mentioned or deleted by `/merged`. Use `/clean-ai-tpk-artifacts` for cross-session cleanup.

This is useful for removing planning artifacts after a feature is shipped without any interruption to the cleanup flow.

### `/clean-ai-tpk-artifacts` Command — Age-Based Cleanup

For periodic housekeeping across all repositories, use the age-based cleanup command:

```bash
/clean-ai-tpk-artifacts          # Delete artifacts older than 14 days (default)
/clean-ai-tpk-artifacts 30       # Delete artifacts older than 30 days
/clean-ai-tpk-artifacts 7 --all  # Delete 7-day-old artifacts from ALL repos
```

**Scope behavior:**
- **Default (no `--all`):** Searches `~/.ai-tpk/plans/{current-repo-slug}/` for old plans, and `~/.ai-tpk/lessons/` for old lessons. Plans are scoped to the current repository; lesson files are always searched globally (lessons are not repo-scoped).
- **With `--all` flag:** Searches all repositories' plan directories under `~/.ai-tpk/plans/` and `~/.ai-tpk/lessons/`. Displays a warning that files from other repositories may be included.

The command lists files to be deleted and asks for confirmation before proceeding.

## Features

### Agent Artifacts Storage

Agent-produced artifacts (plans, open-questions files, lessons) are now stored in user-global directories under `~/.ai-tpk/` to decouple them from worktree lifecycle and make them accessible across repositories:

- **Plans** → `~/.ai-tpk/plans/{repo-slug}/` — One subdirectory per repository, containing plan files and associated open-questions files
- **Lessons** → `~/.ai-tpk/lessons/` — Flat structure for Everwise Scout analysis recommendations (cross-repo)

These directories are created automatically when you run `install.sh`.

### Parallel Sessions via Git Worktrees

The Dungeon Master now supports true parallel development workflows using Git worktrees. Each constructive or investigative session automatically creates an isolated worktree on a dedicated branch using conventional commit prefixes (e.g., `.worktrees/feat-add-oauth-login/` on `feat/add-oauth-login`), enabling multiple simultaneous `claude --agent dungeonmaster` terminals to work on unrelated issues without git conflicts or interference. Advisory sessions (`/ask`, `/ops`) never create a worktree.

**Key benefits:**
- Run multiple DungeonMaster sessions simultaneously on the same repository
- Each session operates on its own branch in its own worktree
- Plans are stored globally in `~/.ai-tpk/plans/{repo-slug}/` and remain accessible after worktree removal
- Zero git conflicts between parallel sessions
- At completion, the branch is preserved and a log line points you to `/open-pr` for next steps
- Manual cleanup with `git worktree remove` when you are done

See [docs/WORKTREE_ISOLATION.md](/docs/WORKTREE_ISOLATION.md) for a comprehensive guide with examples and troubleshooting.

### Documentation Integration
The Dungeon Master orchestration agent automatically invokes Quill (documentation specialist) in Phase 5 (Completion) when a planning session was conducted. Quill runs as step 5b — after reservations are logged (5a) but before the Resolution Gate (5c) and completion summary (5d). Quill receives the plan file, list of changed files, and feature summary, then updates documentation to reflect the implementation. If the Resolution Gate triggers post-gate Bitsmith work, Quill is re-invoked after the follow-up Phase 4 review. This ensures documentation stays synchronized with code without manual effort.

### Session Logging
Orchestration sessions are automatically chronicled by a two-stage shell pipeline. During each session, `talekeeper-capture.sh` runs as a SubagentStop command hook and appends raw sub-agent events to `~/.ai-tpk/logs/{REPO_SLUG}/talekeeper-raw.jsonl`. At session end, `talekeeper-enrich.sh` runs as an async Stop hook and processes the raw log into a structured enriched JSONL chronicle (`~/.ai-tpk/logs/{REPO_SLUG}/talekeeper-{session_id}.jsonl`). The enriched chronicle includes all agent metadata plus an `agent_transcript_path` field for SubagentStop events, enabling downstream tools like Everwise Scout to locate and analyze raw transcripts. Both scripts filter out internal hook-agent noise. Logs are gitignored and stay local to your machine.

When you want a human-readable summary of past sessions, invoke the Talekeeper narrator agent manually. It reads the enriched chronicle files, delivers a concise chat digest, and appends structured narrative sections with Mermaid diagrams to `~/.ai-tpk/logs/{REPO_SLUG}/talekeeper-narrative.md`.

### Terminal Tab Rename
Terminal tab titles are automatically managed via a two-hook system:
- **SessionStart Hook** — Restores previously stored session titles for resumed sessions (instant, no AI call); resets the tab to the repo or directory name for fresh sessions (e.g., after `/new`) so the previous session's stale title does not persist
- **Stop Hook** — Generates a contextual 2–5 word title from the first user prompt and assistant response after the first turn completes; stores it for future resume

This provides immediate context recognition when resuming sessions and automatic title generation based on what you actually worked on, without manual naming. Titles are stored in `~/.claude/session-titles/` and persist across terminal restarts. Sessions started with `--name` flag preserve their explicit title without AI override.

See [docs/CONFIGURATION.md](/docs/CONFIGURATION.md) — sections "SessionStart Hook - Terminal Tab Title Restore" and "Stop Hook - Terminal Tab Title Generation" — for detailed behavior, supported terminals (tmux, cmux, iTerm2, ghostty), and dependencies.

### Specialized Agents
Specialized AI assistants are available for orchestration (Dungeon Master), intake clarification (Askmaw), investigative diagnosis (Tracebloom), documentation (Quill), security reviews (Riskmancer), planning (Pathfinder), complexity reduction (Knotcutter), factual validation (Truthhammer), session narration (Talekeeper), performance analysis (Windwarden), code implementation (Bitsmith), and team meta-analysis (Everwise). The orchestration workflow uses an intelligent review system that reduces overhead by 60-70% while maintaining quality.

The system now supports two distinct entry points for tasks:
- **Investigative tasks** ("Why is X broken?") → Tracebloom produces a Diagnostic Report → feeds to Pathfinder or Bitsmith
- **Constructive tasks** ("Add/fix/refactor X") → Askmaw (if ambiguous) or direct to Pathfinder

See [docs/AGENTS.md](/docs/AGENTS.md) for the complete agent catalog, [docs/WORKFLOW_ENTRY_POINTS.md](/docs/WORKFLOW_ENTRY_POINTS.md) for task routing guidance, and [docs/adrs/REVIEW_WORKFLOW.md](/docs/adrs/REVIEW_WORKFLOW.md) for the review workflow guide.

#### Everwise Scout: Subagent Transcript Drill-Down
Everwise now includes Scout, a selective transcript analysis capability. When chronicle analysis identifies specific anomalies—REJECT verdicts, repeated REVISE loops (3+), rapid re-invocations (<60 seconds), unresolved escalations, or anomalous agent routing—Everwise can dynamically discover and read raw Claude Code subagent JSONL transcripts to understand what actually happened beyond the chronicle's metadata. Scout uses a two-pass reading algorithm with a 20-line cap per transcript and a 3-transcript budget per session, keeping context consumption bounded while providing ground-truth behavioral evidence. This capability works in full graceful degradation mode when `~/.claude/` data is unavailable.

### Skills Library
Reusable capabilities including skill creation, commit message generation, and pull request automation. Three mandatory global skills via `CLAUDE.md`:

- **`commit-message-guide`** — Enforces conventional commit format for all git commits
- **`validate-before-pr`** — Runs lint and format checks (via stack detection: npm, Make, Python, Go, Rust) before opening a PR; gates PR creation on passing checks
- **`open-pull-request`** — Creates pull requests with conventional naming, draft mode, and pre-flight validation

Additional skills (non-mandatory):

- **`write-reliable-tests`** — Guides authorship and review of deterministic, isolated, and idempotent automated tests across unit, integration, and e2e levels; applied automatically whenever test code is being written or evaluated

### Slash Commands

Claude Code slash commands provide quick workflow shortcuts. Commands are installed alongside skills and agents into `~/.claude/commands/`.

| Command | Purpose |
|---------|---------|
| `/bug` | Report a bug or investigate unexpected behavior — routes directly to Tracebloom (Investigative Gate), bypassing heuristic task classification. |
| `/feature` | Request a new feature or enhancement — routes directly to the constructive planning pipeline, bypassing the Investigative Gate. |
| `/ask` | Ask a question about the codebase, architecture, or approach — lightweight Q&A with no planning or implementation. Routes to the Advisory Workflow (Phases A-B-C) for read-only research and synthesis. |
| `/ops` | Runs an advisory query and saves the synthesis output as a Markdown report to `reports/` in the current repo. Thin alias for `/ask --save-report`. |
| `/open-pr` | Creates a pull request following the `open-pull-request` skill workflow: conventional branch naming, conventional title, draft mode, assigned to @me, and full pre-flight checklist. |
| `/sync-pr` | Rebases the current PR branch onto `refs/remotes/origin/main` and force-pushes with `--force-with-lease`, keeping open PRs in sync with main's latest changes without manual git gymnastics. |
| `/resolve-conflicts` | Resolves merge conflicts during an in-progress rebase — detects conflicted files, resolves them file-by-file, stages each result, and cycles `rebase --continue` until the rebase completes. Can be invoked standalone or inline from `/sync-pr`. |
| `/clean-the-desk` | Cleans up stale local branches (whose upstream PRs have been merged) and removes their associated git worktrees. Prompts for confirmation before any destructive action. |
| `/merged` | Cleans up after a merged PR: uses session context or remote-gone detection to auto-select the target branch, removes the worktree, deletes the local branch, checks out main, pulls the latest, and silently auto-deletes current-session plan files from `~/.ai-tpk/plans/{repo-slug}/`. Confirms all destructive actions with the user. |
| `/clean-ai-tpk-artifacts` | Deletes plan and lesson files older than N days (default 14) from `~/.ai-tpk/`. By default scoped to the current repository's plans; use `--all` flag to clean across all repositories. Prompts for confirmation before deletion. |
| `/merge-pr` | Syncs the current PR branch with main, waits for all required CI checks to pass, squash-merges the PR, deletes the remote branch, and automatically chains into `/merged` for post-merge cleanup. |
| `/address-pr-comments` | Reviews and replies to unresolved inline GitHub PR review comments — fetches threads via GraphQL, reads current file state, categorizes each comment (FIX, COMPROMISE, PUSH-BACK, ALREADY-ADDRESSED, ACKNOWLEDGE), proposes a reply for user approval, and posts approved replies via the REST API. Saves a session summary to `~/.ai-tpk/pr-review-comments/` with resume support across sessions. |
| `/set-aws-profile` | Selects an AWS profile for the CloudWatch MCP server by listing available profiles from `~/.aws/config` (preferred) or `~/.aws/credentials` (fallback), validating the user's selection, and storing it in `~/.claude/.current-aws-profile` (mode 0600). The profile is read at MCP startup. Requires Claude Code restart or MCP server reload to take effect. |

## Agent Orchestration Workflow

When you invoke the Dungeon Master agent (`claude --agent dungeonmaster`),
it orchestrates a multi-phase workflow with intelligent review gates:

### High-Level Overview

```mermaid
flowchart LR
    Start([User Request]) --> DM[Dungeon Master<br/>Orchestrator]
    DM --> Phase1[📋 Planning Phase]
    Phase1 --> Phase2[⚙️ Implementation Phase]
    Phase2 --> Complete([✅ Complete])

    style DM fill:#e1f5ff
    style Phase1 fill:#fff4e6
    style Phase2 fill:#e8f5e9
    style Complete fill:#d4edda
```

### Planning Phase Detail

```mermaid
flowchart TD
    Start([DM: Need Planning?]) --> DelegateP[DM Delegates to<br/>Pathfinder]
    DelegateP --> PF[Pathfinder<br/>Creates Plan]
    PF --> Checklist[Pre-Submission<br/>Checklist ×8]
    Checklist --> SavePlan[Save to<br/>~/.ai-tpk/plans]
    SavePlan --> MandatoryR[DM → Ruinor<br/>Mandatory Baseline Review]

    MandatoryR --> Decision{Ruinor Flags<br/>Specialists?}

    Decision -->|No Flags| Assess1{Ruinor<br/>Pass?}
    Decision -->|Flags Present| Specialists

    subgraph Specialists["🎯 Specialist Reviews (Conditional)"]
        RS1[Riskmancer<br/>Security Deep-Dive]
        W1[Windwarden<br/>Performance Analysis]
        K1[Knotcutter<br/>Complexity Review]
    end

    Specialists --> Assess2{All Reviews<br/>Pass?}

    Assess1 -->|REJECT/REVISE| Feedback[DM Sends<br/>Consolidated Feedback]
    Assess2 -->|REJECT/REVISE| Feedback
    Feedback --> PF
    Assess1 -->|ACCEPT| Next([To Implementation<br/>Phase])
    Assess2 -->|ACCEPT| Next

    style MandatoryR fill:#ffebcc
    style Specialists fill:#e6f3ff
    style Next fill:#e8f5e9
```

### Implementation Phase Detail

```mermaid
flowchart TD
    Start([Approved Plan]) --> DelegateE[DM Delegates to<br/>Bitsmith]
    DelegateE --> Impl[Bitsmith<br/>Implements Code]
    Impl --> MandatoryR[DM → Ruinor<br/>Mandatory Baseline Review]

    MandatoryR --> Decision{Ruinor Flags<br/>Specialists?}

    Decision -->|No Flags| Assess1{Ruinor<br/>Pass?}
    Decision -->|Flags Present| Specialists

    subgraph Specialists["🎯 Specialist Reviews (Conditional)"]
        RS2[Riskmancer<br/>Security Vulnerabilities]
        W2[Windwarden<br/>Performance Optimization]
        K2[Knotcutter<br/>Simplification]
    end

    Specialists --> Assess2{All Reviews<br/>Pass?}

    Assess1 -->|REJECT/REVISE| Feedback[DM Sends<br/>Consolidated Feedback]
    Assess2 -->|REJECT/REVISE| Feedback
    Feedback --> Fix[Bitsmith<br/>Fixes Issues]
    Fix --> MandatoryR
    Assess1 -->|ACCEPT| Complete([✅ Complete])
    Assess2 -->|ACCEPT| Complete

    style MandatoryR fill:#ffebcc
    style Specialists fill:#e6f3ff
    style Complete fill:#d4edda
```

### Smart Review System: How It Works

#### Old Workflow (Removed)

- All changes reviewed by 4 agents (Ruinor + 3 specialists)
- Simple changes wasted 75% of reviews
- Minimum 8 reviews per feature (4 plan + 4 implementation)

#### New Workflow (Active)

- **Ruinor (mandatory)**: Always runs first, provides baseline review covering
  quality, correctness, basic security, basic performance, basic complexity
- **Specialists (opt-in)**: Only invoked when needed via three triggering
  mechanisms:

#### 1. User Flags (Explicit Control)

```bash
"Add OAuth login --review-security"        # Forces Riskmancer review
"Optimize database queries --review-performance"  # Forces Windwarden review
"Refactor auth module --review-complexity"  # Forces Knotcutter review
"Verify Redis 7 migration --verify-facts"  # Forces Truthhammer review
"Major feature --review-all"                # Forces all 4 specialists
```

#### 2. Ruinor Recommendations (Primary Trigger)

- Ruinor evaluates work in Phase 5 (Specialist Assessment)
- Flags specialists when concerns exceed baseline checks
- Orchestrator parses "Specialist Review Recommended" field

#### 3. Keyword Detection (Heuristic Fallback)

If no user flags and Ruinor doesn't recommend, checks for specialist keywords:

- **Security**: auth, jwt, password, crypto, encrypt, secret, payment, pii,
  oauth
- **Performance**: database, query, scale, cache, index, pagination, algorithm,
  batch
- **Complexity**: refactor, architecture, abstraction, framework, pattern,
  redesign

**Efficiency Gains:**

- Simple changes: 8 reviews → 1-2 reviews (75% reduction)
- Complex changes: 8 reviews → 2-8 reviews (same rigor, targeted)
- Average: 60-70% fewer reviews across typical workload

**Test Results (JWT Auth Feature):**

- Old workflow: 4 plan + 4 implementation = 8 reviews
- New workflow: Ruinor + Riskmancer only = 4 reviews (50% reduction)
- Quality: Caught 8 security gaps total (no reduction in rigor)

For a comprehensive guide to the review workflow, see
[docs/adrs/REVIEW_WORKFLOW.md](/docs/adrs/REVIEW_WORKFLOW.md).

**Key Principles:**

- **Plans are artifacts** - Saved to `~/.ai-tpk/plans/{repo-slug}/` for visibility and persistence
- **Reviews are ephemeral** - Verdicts returned in-memory, not saved to files
- **Quality gates enforce quality** - No execution without approved plan, no
  completion without approved implementation
- **Intelligent triage** - Ruinor provides mandatory baseline, specialists
  handle deep expertise
- **Revision loops** - Plans and code iterate until all reviewers accept
- **DM never implements** - All work is delegated to specialized agents
- **Hard intermediate review gates** - After 2 consecutive Bitsmith invocations,
  a review gate is mandatory before continuing
- **REJECT verdicts require remediation** - When Ruinor issues REJECT, Bitsmith
  must provide a written remediation brief before re-review to prevent
  rubber-stamp approvals
- **Documentation follows implementation** - Quill is invoked only after
  implementation review is fully complete; any post-documentation code changes
  must re-enter the implementation review gate

## Contributing

### Development Workflow

When making changes to this repository:

1. **Setup** — Follow the Development Setup section above to install dependencies and build the bundle
2. **Make changes** — Edit TypeScript files in `src/installer/` or `src/launcher/`, or configuration files in `claude/`
3. **Build and reinstall** — Run `pnpm run build` to rebuild the installer bundle, then `./install.sh` to deploy to `~/.claude/`, then `./clean-backups.sh` to remove stale backups. The `/build-and-install` repo-scope slash command automates all three steps in sequence.
4. **Test** — Run `pnpm test` to execute the test suite
5. **Lint and format** — Run `pnpm run format` to auto-fix formatting, then `pnpm run lint` to verify code quality
6. **Commit and push** — The pre-push hook (Lefthook) automatically runs linting and format checks; they must pass before pushing

### Configuration Updates

When updating Claude configurations (agents, skills, commands, hooks, references, or settings):

1. Make changes in this repository
2. Test the configurations
3. Commit and push changes
4. Pull on other machines to sync

When adding new hooks, agents, or skills, update the relevant documentation in `/docs/CONFIGURATION.md`.

### Shared Agent References

Agent definitions can reference shared behavioral vocabulary defined in `claude/references/`. This eliminates duplication across multiple agents:

- **`claude/references/github-auth-probe.md`** — Canonical procedure for verifying GitHub account access before pushing or committing. Both `commit-message-guide` and `open-pull-request` skills reference this to ensure consistent GitHub authentication checks.
- **`claude/references/implementation-standards.md`** — Shared behavioral norms (Minimal Diff, YAGNI, Test-First) for implementation, planning, and review agents. Bitsmith, Pathfinder, Ruinor, and Knotcutter all cite this as the canonical source; each may elaborate in its own definition file.
- **`claude/references/review-gates.md`** — Shared two-gate review framework (Plan Review Gate and Implementation Review Gate) for all reviewer agents (Ruinor, Riskmancer, Windwarden, Knotcutter, Truthhammer). Defines universal operational constraints (read-only operation, in-memory returns) and plan-file-scoping rules. Each reviewer agent defines its own domain-specific criteria for each gate inline in its definition file.
- **`claude/references/verdict-taxonomy.md`** — Shared verdict labels (REJECT, REVISE, ACCEPT-WITH-RESERVATIONS, ACCEPT) and severity scales. Agents load this reference when issuing verdicts to ensure consistent evaluation vocabulary.
- **`claude/references/worktree-protocol.md`** — Shared rules for how agents interpret and apply the `WORKING_DIRECTORY:` context block. Agents load this reference when operating in isolated worktrees to ensure consistent path handling.
- **`claude/references/dm-routing-examples.md`** — 11 worked routing examples for the Dungeon Master, covering multi-step plans, trivial changes, user flags, explore-options, worktrees, intake, investigation, scope confirmation, advisory queries, and ops reports. The DM loads this reference at runtime rather than embedding the examples inline in its system prompt.
- **`claude/references/completion-templates.md`** — Four rigid per-command completion report templates (A: Constructive, B: Investigative, C: Operational PR, D: Post-Merge) and a shared Common Fields block. The DM output contract and `/open-pr`, `/merged`, `/merge-pr` commands all reference this file to ensure consistent, parseable completion output across sessions.

When modifying these reference files, changes apply automatically to all agents that load them, eliminating the need to update redundant constraints across multiple agent definitions.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
