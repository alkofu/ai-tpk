#!/usr/bin/env bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default installation method
INSTALL_METHOD="symlink"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --copy)
      INSTALL_METHOD="copy"
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--copy]"
      echo ""
      echo "Install AI dotfiles to your home directory."
      echo ""
      echo "Options:"
      echo "  --copy    Copy files instead of creating symlinks (default: symlink)"
      echo "  --help    Show this help message"
      echo ""
      echo "Installation methods:"
      echo "  symlink (default): Creates symbolic links. Changes sync automatically."
      echo "  copy:              Copies files. Manual sync required with git pull."
      exit 0
      ;;
    *)
      echo -e "${RED}Error: Unknown option $1${NC}"
      echo "Run '$0 --help' for usage information."
      exit 1
      ;;
  esac
done

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}AI Dotfiles Installer${NC}"
echo -e "${BLUE}=====================${NC}"
echo ""
echo "Installation method: ${GREEN}${INSTALL_METHOD}${NC}"
echo "Source directory: ${SCRIPT_DIR}"
echo ""

# Function to backup existing directory
backup_if_exists() {
  local target="$1"
  if [[ -e "$target" ]]; then
    local backup="${target}.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${YELLOW}Backing up existing ${target} to ${backup}${NC}"
    mv "$target" "$backup"
    return 0
  fi
  return 1
}

# Function to install a directory
install_dir() {
  local src_name="$1"
  local dest_name="$2"
  local src_path="${SCRIPT_DIR}/${src_name}"
  local dest_path="${HOME}/${dest_name}"

  # Check if source exists
  if [[ ! -d "$src_path" ]]; then
    echo -e "${YELLOW}Skipping ${src_name} (not found in repository)${NC}"
    return
  fi

  # Backup existing configuration
  backup_if_exists "$dest_path"

  # Install based on method
  if [[ "$INSTALL_METHOD" == "symlink" ]]; then
    echo -e "${GREEN}Creating symlink:${NC} ${dest_path} -> ${src_path}"
    ln -s "$src_path" "$dest_path"
  else
    echo -e "${GREEN}Copying:${NC} ${src_path} -> ${dest_path}"
    cp -r "$src_path" "$dest_path"
  fi
}

# Install each configuration directory
install_dir "claude" ".claude"
install_dir "cursor" ".cursor"

echo ""
echo -e "${GREEN}✓ Installation complete!${NC}"
echo ""

if [[ "$INSTALL_METHOD" == "symlink" ]]; then
  echo "Your configurations are now symlinked to this repository."
  echo "To update: cd ${SCRIPT_DIR} && git pull"
else
  echo "Your configurations have been copied from this repository."
  echo "To update: cd ${SCRIPT_DIR} && git pull && ./install.sh --copy"
fi
