#!/usr/bin/env bash
# adapters/validate.sh — Verify that adapter output matches committed generated files.
#
# Runs adapters/to-claude.sh and adapters/to-opencode.sh in-place, then checks
# whether any tracked files in claude/agents/, opencode/agents/, or opencode/AGENTS.md
# were modified. Exits 0 if all generated files are up to date; exits 1 if any
# file is out of sync.
#
# Usage:
#   bash adapters/validate.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Running adapters/to-claude.sh ..."
bash "$SCRIPT_DIR/to-claude.sh"

echo "Running adapters/to-opencode.sh ..."
bash "$SCRIPT_DIR/to-opencode.sh"

echo ""
echo "Checking for drift in generated files ..."

if git -C "$REPO_ROOT" diff --exit-code \
    claude/agents/ opencode/agents/ opencode/AGENTS.md 2>/dev/null; then
  echo "All generated files are up to date."
  exit 0
else
  echo ""
  echo "Generated files are out of sync. Run adapters and commit the results:"
  echo "  bash adapters/to-claude.sh"
  echo "  bash adapters/to-opencode.sh"
  exit 1
fi
