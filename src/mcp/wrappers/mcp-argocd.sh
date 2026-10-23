#!/usr/bin/env bash
set -Eeuo pipefail

# Launches one read-only ArgoCD MCP server for the cluster named by
# ARGOCD_CLUSTER. The installer registers one `argocd-<id>` server per cluster
# in ~/.config/tpk/argocd-accounts.json, passing only ARGOCD_CLUSTER; the url
# and token are resolved here at boot, so no token is stored in
# ~/.claude.json. The server always runs with MCP_READ_ONLY=true, which drops
# argocd-mcp's write tools (create/update/delete/sync application, run
# resource action).
#
# SECURITY: Do not add 'set -x' (or otherwise enable bash xtrace) to this script.
# The token passes through $resolved below and would be exposed in stderr by
# xtrace. Never print the loaded JSON or any token value when debugging.

trap 'echo "mcp-argocd wrapper: error on line $LINENO" >&2' ERR

ACCOUNTS_PATH="$HOME/.config/tpk/argocd-accounts.json"

# Validate ARGOCD_CLUSTER is set and non-empty
if [[ -z "${ARGOCD_CLUSTER:-}" ]]; then
  echo "Error: ARGOCD_CLUSTER env var is not set -- this wrapper must be invoked by an installer-registered argocd-<cluster> MCP server" >&2
  exit 1
fi

# Same character class as the installer's ARGOCD_CLUSTER_ID_RE: the id is part
# of the server and tool names, where Claude Code rewrites '.' and treats '__'
# as a separator.
if [[ ! "$ARGOCD_CLUSTER" =~ ^[a-zA-Z0-9-]+$ ]]; then
  echo "Error: ARGOCD_CLUSTER='$ARGOCD_CLUSTER' contains characters outside [a-zA-Z0-9-]" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Error: python3 not found on PATH -- the ArgoCD MCP wrapper requires python3 to read $ACCOUNTS_PATH" >&2
  exit 1
fi

if [[ ! -r "$ACCOUNTS_PATH" ]]; then
  echo "Error: $ACCOUNTS_PATH not found or not readable. Create it (see docs/MCP.md) and run: chmod 600 $ACCOUNTS_PATH" >&2
  exit 1
fi

# Enforce mode 0600 on the accounts file (mirrors mcp-github.sh)
mode=$(stat -f '%Lp' "$ACCOUNTS_PATH" 2>/dev/null || stat -c '%a' "$ACCOUNTS_PATH" 2>/dev/null || echo "")
if [[ -z "$mode" ]]; then
  echo "Error: could not stat $ACCOUNTS_PATH to check file mode" >&2
  exit 1
fi
while [[ "$mode" == 0?* ]]; do mode="${mode#0}"; done
mode="${mode:-0}"
if [[ "$mode" != "600" ]]; then
  echo "Error: $ACCOUNTS_PATH mode is $mode; must be 0600 (run: chmod 600 $ACCOUNTS_PATH)" >&2
  exit 1
fi

# Resolve url (line 1) and token (line 2) for the cluster. The explicit
# if!-guarded form propagates the python exit status under set -e.
if ! resolved="$(
  ACCOUNTS_PATH="$ACCOUNTS_PATH" python3 - <<'PY'
import json
import os
import sys

path = os.environ["ACCOUNTS_PATH"]
cluster_id = os.environ["ARGOCD_CLUSTER"]

try:
    with open(path) as fh:
        data = json.load(fh)
except Exception as e:
    # SECURITY: print only the exception type -- JSON errors can quote the
    # offending text, which may contain a token.
    sys.exit(f"Error: failed to read {path} ({type(e).__name__})")

if not isinstance(data, dict):
    sys.exit(f"Error: {path} must be a flat JSON object mapping cluster ids to {{url, token}}")

entry = data.get(cluster_id)
if entry is None:
    sys.exit(f"Error: ArgoCD cluster '{cluster_id}' not found in {path} -- re-run install.sh after editing the file")
if not isinstance(entry, dict):
    sys.exit(f"Error: ArgoCD cluster '{cluster_id}' in {path} must be an object with url and token")

url = entry.get("url")
token = entry.get("token")
if not isinstance(url, str) or "\n" in url.strip() or not url.strip().lower().startswith(("http://", "https://")):
    sys.exit(f"Error: ArgoCD cluster '{cluster_id}' has no valid http(s) url in {path}")
# SECURITY: identify the offending entry by id only, never by value.
if not isinstance(token, str) or not token.strip() or "\n" in token.strip():
    sys.exit(f"Error: ArgoCD cluster '{cluster_id}' has no valid token in {path}")
print(url.strip())
print(token.strip())
PY
)"; then
  exit 1
fi

ARGOCD_BASE_URL="${resolved%%$'\n'*}"
ARGOCD_API_TOKEN="${resolved#*$'\n'}"
unset resolved

# Belt-and-suspenders: the python lookup validates both, but never launch with
# an empty credential.
if [[ -z "$ARGOCD_BASE_URL" || -z "$ARGOCD_API_TOKEN" ]]; then
  echo "Error: resolved ArgoCD url or token is empty (this should not happen)" >&2
  exit 1
fi

echo "ArgoCD MCP: cluster '$ARGOCD_CLUSTER' -> $ARGOCD_BASE_URL (read-only)" >&2

export ARGOCD_BASE_URL ARGOCD_API_TOKEN
export MCP_READ_ONLY=true
exec npx --yes argocd-mcp@0.9.0 stdio "$@"
