#!/usr/bin/env bash

set -euo pipefail

RED='\033[0;31m'
NC='\033[0m'

if ! command -v node >/dev/null 2>&1; then
  printf "${RED}Error: node is not installed or not in PATH. Please install Node.js >= 18.18.0.${NC}\n" >&2
  exit 1
fi

NODE_VERSION=$(node -e 'process.stdout.write(process.versions.node)')
NODE_MAJOR="${NODE_VERSION%%.*}"
NODE_MINOR="${NODE_VERSION#*.}"
NODE_MINOR="${NODE_MINOR%%.*}"
if [[ "$NODE_MAJOR" -lt 18 ]] || [[ "$NODE_MAJOR" -eq 18 && "$NODE_MINOR" -lt 18 ]]; then
  printf "${RED}Error: Node.js >= 18.18.0 required (found ${NODE_VERSION}).${NC}\n" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec npx tsx "${SCRIPT_DIR}/installer/main.ts" "$@"
