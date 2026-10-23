#!/usr/bin/env bash
set -euo pipefail

# Launches the Kubernetes MCP server in read-only mode. One server covers every
# context in ~/.kube/config: each tool call names its cluster with the
# `context` argument, which the kubernetes-context-guard.sh PreToolUse hook
# makes mandatory. ALLOW_ONLY_READONLY_TOOLS=true limits the server to
# get/describe/logs/explain/api-resources/ping and the context tools; the hook
# also blocks kubectl_context's `set` operation, which would rewrite the
# global current-context.
#
# This is a wrapper rather than a command entry in mcp-servers.json so that a
# change here reaches existing installs: the installer skips command-based
# servers that are already registered, but this script runs on every boot.

export KUBECONFIG="$HOME/.kube/config"
export ALLOW_ONLY_READONLY_TOOLS=true

if [[ ! -f "$KUBECONFIG" ]]; then
  echo "Error: $KUBECONFIG not found -- the Kubernetes MCP server needs a kubeconfig" >&2
  exit 1
fi

echo "Kubernetes MCP: read-only, pass 'context' on every call" >&2
exec npx --yes mcp-server-kubernetes@4.1.9 "$@"
