# Configuration Guide

This document explains the Claude Code configurations included in this repository.

## Settings (`claude/settings.json`)

The settings file configures Claude Code's behavior, including plugins, marketplaces, and hooks.

### Plugins

The configuration automatically enables:

- **superpowers@claude-plugins-official** - Enhanced Claude Code capabilities including advanced features and integrations

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

### Quill - Documentation Specialist

**Purpose:** Create and update project documentation

**Use when:**
- Adding major features
- Making API changes
- Onboarding new developers
- Documentation is out of sync with code

**Capabilities:**
- Generate README files
- Create API specifications (including OpenAPI/YAML)
- Write architecture guides
- Develop user manuals
- Audit existing documentation for gaps

**Available tools:** File operations (Read, Write, Edit), search (Grep, Glob), and Bash commands

**Workflow:**
1. Analyzes codebase and existing documentation
2. Identifies gaps and outdated content
3. Creates structured documentation with examples
4. Validates technical accuracy

Invoke Quill proactively after completing features rather than waiting for documentation to become severely outdated.

## Skills (`claude/skills/`)

Skills are reusable capabilities that enhance Claude's functionality. See individual skill directories for specific documentation:

- `skill-creator/` - Meta-skill for creating new Claude skills
- `commit-message-guide/` - Generates conventional commit messages
- `open-pull-request/` - Automates GitHub pull request creation
