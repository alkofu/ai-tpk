#!/usr/bin/env bash
set -euo pipefail

LAUNCHER_DIR="$HOME/.claude/launcher"

if [[ ! -f "$LAUNCHER_DIR/main.ts" ]]; then
  printf 'Error: myclaude launcher not found at %s\n' "$LAUNCHER_DIR" >&2
  printf 'Re-run install.sh to reinstall it.\n' >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  printf 'Error: node is not installed or not in PATH. Please install Node.js >= 18.18.0.\n' >&2
  exit 1
fi

case ":$PATH:" in
  *":${HOME}/bin:"*) ;;
  *)
    printf 'Warning: ~/bin is not in PATH. Add it to your shell profile to use the myclaude command.\n' >&2
    ;;
esac

cd "$LAUNCHER_DIR"
TSX_BIN="$LAUNCHER_DIR/node_modules/.bin/tsx"
if [[ ! -x "$TSX_BIN" ]]; then
  printf 'Error: tsx not found at %s\n' "$TSX_BIN" >&2
  printf 'Re-run install.sh to reinstall dependencies.\n' >&2
  exit 1
fi
exec "$TSX_BIN" main.ts "$@"
