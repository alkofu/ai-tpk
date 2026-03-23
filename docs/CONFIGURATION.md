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

#### Stop Hook - Documentation Check

Automatically runs when you end a Claude session to verify documentation is up to date.

**Behavior:**
1. Checks for uncommitted code changes via `git status` and `git diff`
2. Skips the check if only documentation files changed or working tree is clean
3. If code changes exist, verifies that corresponding documentation exists (README.md, docs/, etc.)
4. Analyzes whether existing documentation covers the new functionality
5. Prompts you to update documentation if gaps are detected

**Configuration:**
- Type: Agent-based hook
- Timeout: 30 seconds
- Conservative approach: Only triggers for substantive changes requiring documentation

This hook helps maintain documentation quality by catching missing updates before you close a session.

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
