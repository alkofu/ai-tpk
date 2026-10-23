#!/bin/bash
# test-kubernetes-context-guard.sh — Shell test harness for kubernetes-context-guard.sh
# Feeds PreToolUse payloads to the hook with a stub kubectl on PATH and asserts
# whether each call is denied or allowed.
# Usage: bash claude/hooks/test-kubernetes-context-guard.sh  (from repo root)
# Exits 1 if any test fails.

HOOK="$(cd "$(dirname "$0")" && pwd)/kubernetes-context-guard.sh"

if [ ! -f "$HOOK" ]; then
  printf 'ERROR: Hook not found at %s\n' "$HOOK"
  exit 1
fi

STUB_DIR=$(mktemp -d)
trap 'rm -rf "$STUB_DIR"' EXIT

# Stub kubectl: `kubectl config get-contexts -o name` lists two contexts.
cat >"$STUB_DIR/kubectl" <<'STUB'
#!/bin/sh
printf 'aws-prd-use1\naws-prd-use2\n'
STUB
chmod +x "$STUB_DIR/kubectl"

PASS=0
FAIL=0

# test_case DESCRIPTION JSON_PAYLOAD EXPECTED [PATH_OVERRIDE]
# EXPECTED is one of: deny | allow
test_case() {
  local description="$1"
  local payload="$2"
  local expected="$3"
  local test_path="${4:-$STUB_DIR:$PATH}"

  local output
  output=$(printf '%s' "$payload" | PATH="$test_path" bash "$HOOK" 2>/dev/null)

  local result="allow"
  if printf '%s' "$output" | grep -q '"permissionDecision":"deny"'; then
    result="deny"
  fi

  if [ "$result" = "$expected" ]; then
    printf 'PASS  %s\n' "$description"
    PASS=$((PASS + 1))
  else
    printf 'FAIL  %s\n' "$description"
    printf '      expected=%s  got=%s  output=%s\n' "$expected" "$result" "$output"
    FAIL=$((FAIL + 1))
  fi
}

# payload TOOL INPUT_JSON
payload() {
  jq -cn --arg tool "mcp__kubernetes__$1" --argjson input "$2" \
    '{hook_event_name: "PreToolUse", tool_name: $tool, tool_input: $input}'
}

test_case 'get with a known context is allowed' \
  "$(payload kubectl_get '{"resourceType":"pods","context":"aws-prd-use2"}')" allow
test_case 'get without context is denied' \
  "$(payload kubectl_get '{"resourceType":"pods"}')" deny
test_case 'get with an empty context is denied' \
  "$(payload kubectl_get '{"resourceType":"pods","context":""}')" deny
test_case 'get with a whitespace-only context is denied' \
  "$(payload kubectl_get '{"resourceType":"pods","context":"   "}')" deny
test_case 'get with an unknown context is denied' \
  "$(payload kubectl_get '{"resourceType":"pods","context":"aws-prd-use9"}')" deny
test_case 'logs without context is denied' \
  "$(payload kubectl_logs '{"resourceType":"pod","name":"x"}')" deny
test_case 'describe with a known context is allowed' \
  "$(payload kubectl_describe '{"resourceType":"pod","name":"x","context":"aws-prd-use1"}')" allow
test_case 'list_api_resources without context is denied' \
  "$(payload list_api_resources '{}')" deny
test_case 'explain_resource with a known context is allowed' \
  "$(payload explain_resource '{"resource":"pods","context":"aws-prd-use1"}')" allow
test_case 'ping needs no context' \
  "$(payload ping '{}')" allow
test_case 'kubectl_reconnect needs no context' \
  "$(payload kubectl_reconnect '{}')" allow
test_case 'kubectl_context list is allowed' \
  "$(payload kubectl_context '{"operation":"list"}')" allow
test_case 'kubectl_context get is allowed' \
  "$(payload kubectl_context '{"operation":"get"}')" allow
test_case 'kubectl_context set is denied' \
  "$(payload kubectl_context '{"operation":"set","name":"aws-prd-use1"}')" deny
test_case 'non-Kubernetes tool passes through' \
  '{"tool_name":"Read","tool_input":{"file_path":"/tmp/x"}}' allow

# Without kubectl, the non-empty check still applies but names are not validated.
NO_KUBECTL_PATH="$(dirname "$(command -v jq)"):/usr/bin:/bin"
if ! PATH="$NO_KUBECTL_PATH" command -v kubectl &>/dev/null; then
  test_case 'without kubectl, any non-empty context is allowed' \
    "$(payload kubectl_get '{"resourceType":"pods","context":"anything"}')" allow "$NO_KUBECTL_PATH"
  test_case 'without kubectl, a missing context is still denied' \
    "$(payload kubectl_get '{"resourceType":"pods"}')" deny "$NO_KUBECTL_PATH"
fi

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
