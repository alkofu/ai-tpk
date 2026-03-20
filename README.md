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
├── claude/          # Claude Code configurations
├── cursor/          # Cursor configurations (coming soon)
└── install.sh       # Installation script
```

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

Creates symbolic links to `~/.claude/` and `~/.cursor/`. Changes sync automatically with the repository.

### Option 2: Copy Files
```bash
./install.sh --copy
```

Copies files to `~/.claude/` and `~/.cursor/`. Manual sync required (see Updating below).

**Note:** The installer automatically backs up any existing configurations with a timestamp.

## Updating

```bash
cd ai-dotfiles
git pull
```

**With symlinks:** Changes take effect immediately.
**With copy:** Re-run `./install.sh --copy` after pulling updates.

## Contributing

When updating configurations:
1. Make changes in this repository
2. Test the configurations
3. Commit and push changes
4. Pull on other machines to sync

## License

Personal configuration files - use as needed.
