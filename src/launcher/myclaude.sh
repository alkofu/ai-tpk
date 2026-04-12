#!/usr/bin/env bash
set -euo pipefail

LAUNCHER_BUNDLE="$HOME/.ai-tpk/launcher.js"

if [[ ! -f "$LAUNCHER_BUNDLE" ]]; then
  printf 'Error: myclaude launcher not found at %s\n' "$LAUNCHER_BUNDLE" >&2
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

exec node "$LAUNCHER_BUNDLE" "$@"
