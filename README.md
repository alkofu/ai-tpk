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
│   ├── settings.json
│   └── ...
└── cursor/          # Cursor configurations
    └── ...
```

## Installation

### Option 1: Manual Copy
```bash
# Clone this repository
git clone git@github.com:alkofu/ai-dotfiles.git
cd ai-dotfiles

# Copy configurations to home directory
cp -r claude ~/.claude
cp -r cursor ~/.cursor
```

### Option 2: Symlinks (Recommended)
```bash
# Clone this repository
git clone git@github.com:alkofu/ai-dotfiles.git ~/ai-dotfiles

# Create symlinks
ln -s ~/ai-dotfiles/claude ~/.claude
ln -s ~/ai-dotfiles/cursor ~/.cursor
```

Using symlinks keeps your configurations in sync with this repository automatically.

## Updating

```bash
cd ~/ai-dotfiles
git pull origin main
```

If using symlinks, changes take effect immediately. If using manual copy, re-run the copy commands.

## Contributing

When updating configurations:
1. Make changes in this repository
2. Test the configurations
3. Commit and push changes
4. Pull on other machines to sync

## License

Personal configuration files - use as needed.
