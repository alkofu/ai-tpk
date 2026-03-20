# AI Dotfiles

Configuration files for AI coding assistants, managed centrally and deployed to your home directory.

## Overview

This repository maintains user-scope configuration for:
- **Claude Code** - Anthropic's AI coding assistant CLI
- **Cursor** - AI-powered code editor

## Purpose

Keep AI tool configurations version-controlled and portable across machines. These configs are meant to be copied or symlinked to your user home directory (`~/.claude/`, `~/.cursor/`, etc.).

## Structure

```
.
├── claude/          # Claude Code configs (whitelist: settings.json, skills/, agents/)
│   ├── settings.json    # Plugin config, hooks, marketplace settings
│   ├── agents/          # Specialized AI assistants (e.g., Quill for docs)
│   └── skills/          # Reusable capabilities
├── cursor/          # Cursor configurations (coming soon)
├── docs/            # Documentation
│   └── CONFIGURATION.md # Detailed configuration guide
└── install.sh       # Installation script
```

The installer only installs these paths from `claude/` into `~/.claude/`: `settings.json`, `skills/`, and `agents/`. Anything else in the repo or on disk under `~/.claude/` is left untouched except where those destinations are replaced (after a timestamped backup).

## Installation

Clone the repository:
```bash
git clone git@github.com:alkofu/ai-dotfiles.git
cd ai-dotfiles
```

Run the installation script:

### Option 1: Symlinks (Recommended)
```bash
./install.sh
```

Creates symbolic links for the whitelisted Claude paths (`settings.json`, `skills/`, `agents/`) and for `~/.cursor/` when `cursor/` exists. Changes sync automatically with the repository.

### Option 2: Copy Files
```bash
./install.sh --copy
```

Copies the same whitelisted Claude paths into `~/.claude/` and `~/.cursor/` when present. Manual sync required (see Updating below).

**Note:** The installer automatically backs up any existing configurations with a timestamp.

## Claude Plugins

The installation script automatically:
1. Adds the **claude-plugins-official** marketplace (if not already configured)
2. Installs the following plugins:
   - **superpowers@claude-plugins-official** - Enhanced Claude Code capabilities

If Claude Code is not installed when you run the script, plugin installation will be skipped. You can re-run the script later after installing Claude Code to install the plugins.

For detailed information about hooks, agents, and other configuration options, see [docs/CONFIGURATION.md](/docs/CONFIGURATION.md).

## Updating

```bash
cd ai-dotfiles
git pull
```

**With symlinks:** Changes take effect immediately.
**With copy:** Re-run `./install.sh --copy` after pulling updates.

## Features

### Automated Documentation Checks
A hook automatically runs when you end a Claude session to check if code changes require documentation updates. This helps maintain documentation quality without manual effort.

### Specialized Agents
**Quill** - Documentation specialist agent that creates and updates project documentation, API specs, and architecture guides.

### Skills Library
Reusable capabilities including skill creation, commit message generation, and pull request automation.

## Contributing

When updating configurations:
1. Make changes in this repository
2. Test the configurations
3. Commit and push changes
4. Pull on other machines to sync

When adding new hooks, agents, or skills, update the relevant documentation in `/docs/CONFIGURATION.md`.

## License

Personal configuration files - use as needed.
