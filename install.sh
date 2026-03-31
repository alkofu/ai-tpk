#!/usr/bin/env bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default installation method and harness
INSTALL_METHOD="symlink"
HARNESS="claude"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --copy)
      INSTALL_METHOD="copy"
      shift
      ;;
    --harness)
      if [[ -z "${2:-}" ]]; then
        echo -e "${RED}Error: --harness requires a value (claude, opencode, all)${NC}"
        exit 1
      fi
      HARNESS="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [--copy] [--harness <claude|opencode|all>]"
      echo ""
      echo "Install AI TPK to your home directory."
      echo ""
      echo "Harnesses:"
      echo "  --harness claude    (default) Install Claude Code artifacts to ~/.claude/"
      echo "  --harness opencode  Install OpenCode artifacts to ~/.config/opencode/"
      echo "  --harness all       Install artifacts for both Claude Code and OpenCode"
      echo ""
      echo "Claude Code (--harness claude):"
      echo "  - Whitelisted paths: settings.json, CLAUDE.md, skills/, agents/"
      echo "  - Destination: ~/.claude/"
      echo ""
      echo "OpenCode (--harness opencode):"
      echo "  - Installs: agents/, AGENTS.md"
      echo "  - Destination: ~/.config/opencode/"
      echo ""
      echo "Options:"
      echo "  --copy    Copy files instead of creating symlinks (default: symlink)"
      echo "  --help    Show this help message"
      echo ""
      echo "Installation methods:"
      echo "  symlink (default): Creates symbolic links. Changes sync automatically."
      echo "  copy:              Copies files. Manual sync required with git pull."
      echo ""
      echo "Prerequisites:"
      echo "  deno  Required for adapter scripts that regenerate harness-specific files."
      echo "        macOS/Linux: curl -fsSL https://deno.land/install.sh | sh"
      echo "        or: https://docs.deno.com/runtime/getting_started/installation/"
      exit 0
      ;;
    *)
      echo -e "${RED}Error: Unknown option $1${NC}"
      echo "Run '$0 --help' for usage information."
      exit 1
      ;;
  esac
done

# Validate --harness value
case "$HARNESS" in
  claude|opencode|all) ;;
  *)
    echo -e "${RED}Error: Unknown harness '${HARNESS}'. Valid values: claude, opencode, all${NC}"
    exit 1
    ;;
esac

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}AI TPK Installer${NC}"
echo -e "${BLUE}=====================${NC}"
echo ""
echo "Installation method: ${GREEN}${INSTALL_METHOD}${NC}"
echo "Harness: ${GREEN}${HARNESS}${NC}"
echo "Source directory: ${SCRIPT_DIR}"
echo ""

# Check for deno dependency (required by adapter scripts)
check_deno() {
  if ! command -v deno &>/dev/null; then
    echo "Error: deno is required but not installed."
    echo "Install: https://docs.deno.com/runtime/getting_started/installation/"
    echo "  macOS/Linux: curl -fsSL https://deno.land/install.sh | sh"
    exit 1
  fi
}

# Function to backup existing path if present (always returns 0 so set -e is safe)
backup_if_exists() {
  local target="$1"
  if [[ -e "$target" ]]; then
    local backup="${target}.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${YELLOW}Backing up existing ${target} to ${backup}${NC}"
    mv "$target" "$backup"
  fi
  return 0
}

# Install a source path to a destination path (file or directory)
install_path() {
  local src_path="$1"
  local dest_path="$2"

  backup_if_exists "$dest_path"

  if [[ "$INSTALL_METHOD" == "symlink" ]]; then
    echo -e "${GREEN}Creating symlink:${NC} ${dest_path} -> ${src_path}"
    ln -s "$src_path" "$dest_path"
  else
    echo -e "${GREEN}Copying:${NC} ${src_path} -> ${dest_path}"
    cp -r "$src_path" "$dest_path"
  fi
}

# Function to install a top-level directory from the repo into the home directory
install_dir() {
  local src_name="$1"
  local dest_name="$2"
  local src_path="${SCRIPT_DIR}/${src_name}"
  local dest_path="${HOME}/${dest_name}"

  if [[ ! -d "$src_path" ]]; then
    echo -e "${YELLOW}Skipping ${src_name} (not found in repository)${NC}"
    return
  fi

  install_path "$src_path" "$dest_path"
}

# Whitelist only: ~/.claude/settings.json, ~/.claude/CLAUDE.md, ~/.claude/skills/, ~/.claude/agents/
install_claude_whitelist() {
  local claude_src="${SCRIPT_DIR}/claude"

  if [[ ! -d "$claude_src" ]]; then
    echo -e "${YELLOW}Skipping claude/ (not found in repository)${NC}"
    return
  fi

  # Replace legacy full-tree ~/.claude symlink with a real directory
  if [[ -L "${HOME}/.claude" ]]; then
    backup_if_exists "${HOME}/.claude"
  fi
  mkdir -p "${HOME}/.claude"

  local settings_src="${claude_src}/settings.json"
  if [[ -f "$settings_src" ]]; then
    install_path "$settings_src" "${HOME}/.claude/settings.json"
  else
    echo -e "${YELLOW}Skipping claude/settings.json (not found in repository)${NC}"
  fi

  local claude_md_src="${claude_src}/CLAUDE.md"
  if [[ -f "$claude_md_src" ]]; then
    install_path "$claude_md_src" "${HOME}/.claude/CLAUDE.md"
  else
    echo -e "${YELLOW}Skipping claude/CLAUDE.md (not found in repository)${NC}"
  fi

  local name
  for name in skills agents hooks commands; do
    local sub_src="${claude_src}/${name}"
    if [[ -d "$sub_src" ]]; then
      install_path "$sub_src" "${HOME}/.claude/${name}"
    else
      echo -e "${YELLOW}Skipping claude/${name}/ (not found in repository)${NC}"
    fi
  done
}

# Install OpenCode artifacts to ~/.config/opencode/
install_opencode_artifacts() {
  local opencode_src="${SCRIPT_DIR}/opencode"

  if [[ ! -d "$opencode_src" ]]; then
    echo -e "${YELLOW}Skipping opencode/ (not found in repository)${NC}"
    return
  fi

  mkdir -p "${HOME}/.config/opencode"

  local agents_src="${opencode_src}/agents"
  if [[ -d "$agents_src" ]]; then
    install_path "$agents_src" "${HOME}/.config/opencode/agents"
  else
    echo -e "${YELLOW}Skipping opencode/agents/ (not found in repository)${NC}"
  fi

  local agents_md_src="${opencode_src}/AGENTS.md"
  if [[ -f "$agents_md_src" ]]; then
    install_path "$agents_md_src" "${HOME}/.config/opencode/AGENTS.md"
  else
    echo -e "${YELLOW}Skipping opencode/AGENTS.md (not found in repository)${NC}"
  fi
}

# Run cursor harness: install cursor directory
run_cursor() {
  echo "--- Cursor harness ---"
  install_dir "cursor" ".cursor"
}

# Run claude harness: regenerate artifacts then install
run_claude() {
  echo -e "${BLUE}--- Claude Code harness ---${NC}"
  echo "Regenerating claude/agents/ from source..."
  "${SCRIPT_DIR}/adapters/to-claude.ts"
  echo ""
  install_claude_whitelist
  run_cursor
}

# Run opencode harness: regenerate artifacts then install
run_opencode() {
  echo -e "${BLUE}--- OpenCode harness ---${NC}"
  echo "Regenerating opencode/agents/ and opencode/AGENTS.md from source..."
  "${SCRIPT_DIR}/adapters/to-opencode.ts"
  echo ""
  install_opencode_artifacts
}

# Check deno before running any adapter
check_deno

# Dispatch by harness
case "$HARNESS" in
  claude)
    run_claude
    ;;
  opencode)
    run_opencode
    ;;
  all)
    run_claude
    echo ""
    run_opencode
    ;;
esac

echo ""
echo -e "${GREEN}Installation complete!${NC}"
echo ""

if [[ "$INSTALL_METHOD" == "symlink" ]]; then
  echo "Your configurations are now symlinked to this repository."
  echo "To update: cd ${SCRIPT_DIR} && git pull"
else
  echo "Your configurations have been copied from this repository."
  case "$HARNESS" in
    claude)
      echo "To update: cd ${SCRIPT_DIR} && git pull && ./install.sh --copy"
      ;;
    opencode)
      echo "To update: cd ${SCRIPT_DIR} && git pull && ./install.sh --harness opencode --copy"
      ;;
    all)
      echo "To update: cd ${SCRIPT_DIR} && git pull && ./install.sh --harness all --copy"
      ;;
  esac
fi
