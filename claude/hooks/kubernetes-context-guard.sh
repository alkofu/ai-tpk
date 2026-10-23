#!/bin/bash
# kubernetes-context-guard.sh — PreToolUse hook for mcp__kubernetes__* tools
# The Kubernetes MCP server falls back to the kubeconfig's current-context when
# a call omits `context`, so a vague request could silently hit whichever
# cluster was last selected in a terminal. This hook makes the target explicit:
#   - every tool must pass a non-empty `context` that exists in the kubeconfig,
#     except ping and kubectl_reconnect (no `context` argument) and
#     kubectl_context's list/get operations;
#   - kubectl_context's `set` operation is denied, because it runs
#     `kubectl config use-context` and rewrites the global current-context.
# Denials name the available contexts so the caller can retry.
# Fails closed (denies) when jq is unavailable: the matcher only sends
# Kubernetes tools here, and an unchecked call is exactly what this prevents.

deny() {
  local reason="$1"
  if command -v jq &>/dev/null; then
    jq -cn --arg reason "$reason" \
      '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
  else
    # Without jq, emit a fixed reason that needs no JSON escaping.
    printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"kubernetes-context-guard: jq is not installed, so Kubernetes MCP calls cannot be checked. Install jq."}}'
  fi
  exit 0
}

if ! command -v jq &>/dev/null; then
  deny "jq is not installed"
fi

PAYLOAD=$(cat)

TOOL_NAME=$(printf '%s' "$PAYLOAD" | jq -r '.tool_name // ""' 2>/dev/null)
CONTEXT=$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.context // "" | gsub("^\\s+|\\s+$"; "")' 2>/dev/null)
OPERATION=$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.operation // ""' 2>/dev/null)

# Only Kubernetes MCP tools are checked; anything else passes through.
case "$TOOL_NAME" in
  mcp__kubernetes__*) ;;
  *) exit 0 ;;
esac

TOOL="${TOOL_NAME#mcp__kubernetes__}"

case "$TOOL" in
  ping | kubectl_reconnect)
    exit 0
    ;;
  kubectl_context)
    if [ "$OPERATION" = "set" ]; then
      deny "kubernetes-context-guard: kubectl_context 'set' is blocked because it rewrites the global current-context in ~/.kube/config. Pass 'context' on the individual tool call instead."
    fi
    exit 0
    ;;
esac

# Available contexts, for validation and for the denial message. If kubectl is
# missing or the kubeconfig cannot be read, only the non-empty check applies.
AVAILABLE=""
if command -v kubectl &>/dev/null; then
  AVAILABLE=$(kubectl config get-contexts -o name 2>/dev/null)
fi
AVAILABLE_LIST=$(printf '%s' "$AVAILABLE" | paste -sd ',' - | sed 's/,/, /g')

if [ -z "$CONTEXT" ]; then
  deny "kubernetes-context-guard: $TOOL_NAME needs an explicit 'context' argument; the default context is never used. Available contexts: ${AVAILABLE_LIST:-unknown}. If the user did not say which cluster, ask them."
fi

if [ -n "$AVAILABLE" ] && ! printf '%s\n' "$AVAILABLE" | grep -qxF -- "$CONTEXT"; then
  deny "kubernetes-context-guard: context '$CONTEXT' is not in ~/.kube/config. Available contexts: $AVAILABLE_LIST."
fi

exit 0
