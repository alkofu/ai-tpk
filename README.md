<div align="center">
  <img src="docs/images/party.jpg" alt="AI TPK — The Adventuring Party" width="640" />
</div>

# AI TPK

**AI TPK** (Total Party Kill — a D&D term for when the entire adventuring party is wiped out) is a clone-run-forget tool that installs a curated set of AI agents, skills, slash commands, hooks, and MCP servers into `~/.claude/` (and into `~/.cursor/` when present). It is inspired by tabletop roleplaying games, featuring agents with D&D-themed roles like Dungeon Master (orchestrator), Riskmancer (security), and Pathfinder (planning). Just as a well-prepared party survives the dungeon, well-configured AI tools help you survive the codebase.

## Quick Install

```bash
git clone git@github.com:alkofu/ai-tpk.git
cd ai-tpk
./install.sh
```

See [docs/INSTALLATION.md](/docs/INSTALLATION.md) for prerequisites, development setup, updating, and backup recovery.

## Scope: User vs. Project

This repository has two scopes for Claude Code artifacts:

| Directory | Scope | Effect |
|-----------|-------|--------|
| `claude/` | User | Synced by `install.sh` to `~/.claude/` — applies globally across all repositories |
| `.claude/` | Project | Applies only to this repository — not synced by installer |

When modifying agents, skills, commands, hooks, references, CLAUDE.md, or settings, consult `.claude/CLAUDE.md` for scope clarification rules. Before creating or modifying any scoped artifact, ask: "Repo scope (`.claude/`) or user scope (`claude/`)?"

## Documentation

- [docs/INSTALLATION.md](/docs/INSTALLATION.md) — Install lifecycle: clone, run install.sh, set up a dev environment, update, recover and clean backups, clean agent artifacts.
- [docs/DEMO.md](/docs/DEMO.md) — A short, screenshot-driven tour of what an AI TPK session looks like in practice.
- [docs/CONFIGURATION.md](/docs/CONFIGURATION.md) — Settings, hooks, MCP servers, myclaude launcher, agents, references, skills, slash commands, CI, and configuration update workflow.
- [docs/AGENTS.md](/docs/AGENTS.md) — Agent roster, per-agent profiles, documentation/session-logging integrations, and shared reference files.
- [docs/WORKFLOW_ENTRY_POINTS.md](/docs/WORKFLOW_ENTRY_POINTS.md) — Investigative vs. constructive task routing.
- [docs/WORKTREE_ISOLATION.md](/docs/WORKTREE_ISOLATION.md) — Parallel sessions, agent artifacts storage, and worktree mechanics.
- [docs/adrs/REVIEW_WORKFLOW.md](/docs/adrs/REVIEW_WORKFLOW.md) — Mandatory-baseline + opt-in-specialist review workflow with diagrams and key principles.
- Contributing — see [docs/CONFIGURATION.md § Configuration Updates](/docs/CONFIGURATION.md#configuration-updates) for the configuration update workflow and [docs/AGENTS.md § Shared Agent References](/docs/AGENTS.md#shared-agent-references) for shared reference file conventions. For repo-wide development workflow (build, test, lint, format, push), see [docs/INSTALLATION.md § Development Setup](/docs/INSTALLATION.md#development-setup).

## License

MIT — see [LICENSE](LICENSE).
