#!/usr/bin/env bash
set -euo pipefail

DOTFILE="$HOME/.claude/.current-argocd-cluster"
export ACCOUNTS_FILE="$HOME/.config/argocd-accounts.json"

# --- Require dotfile ---
if [[ ! -f "$DOTFILE" ]] || [[ ! -s "$DOTFILE" ]]; then
  printf 'Error: no ArgoCD cluster selected.\n' >&2
  printf 'Run: tpk (and select ArgoCD)\n' >&2
  printf 'Or: echo "my-cluster" > %s\n' "$DOTFILE" >&2
  exit 1
fi

# --- Read and trim cluster id ---
IFS= read -r ARGOCD_CLUSTER_ID < "$DOTFILE"
ARGOCD_CLUSTER_ID="${ARGOCD_CLUSTER_ID#"${ARGOCD_CLUSTER_ID%%[! $'\t']*}"}"
ARGOCD_CLUSTER_ID="${ARGOCD_CLUSTER_ID%"${ARGOCD_CLUSTER_ID##*[! $'\t']}"}"
export ARGOCD_CLUSTER_ID

# --- Validate cluster id ---
if [[ ! "$ARGOCD_CLUSTER_ID" =~ ^[a-zA-Z0-9_.-]+$ ]]; then
  printf 'Error: invalid ArgoCD cluster id "%s" -- must match [a-zA-Z0-9_.-]+\n' "$ARGOCD_CLUSTER_ID" >&2
  exit 1
fi

# --- Require accounts file ---
if [[ ! -f "$ACCOUNTS_FILE" ]]; then
  printf 'Error: ArgoCD accounts file not found at %s.\n' "$ACCOUNTS_FILE" >&2
  printf 'Create it: echo '"'"'{}'"'"' > %s && chmod 600 %s\n' "$ACCOUNTS_FILE" "$ACCOUNTS_FILE" >&2
  exit 1
fi

# --- Enforce mode 0600 on accounts file (mirrors mcp-github.sh:39-53) ---
# ArgoCD tokens are equivalent in sensitivity to GitHub PATs; we adopt the strict
# GitHub posture rather than the legacy Grafana advisory-only posture.
mode=$(stat -f '%Lp' "$ACCOUNTS_FILE" 2>/dev/null || stat -c '%a' "$ACCOUNTS_FILE" 2>/dev/null || echo "")
if [[ -z "$mode" ]]; then
  echo "Error: could not stat $ACCOUNTS_FILE to check file mode" >&2
  exit 1
fi
while [[ "$mode" == 0?* ]]; do mode="${mode#0}"; done
mode="${mode:-0}"
if [[ "$mode" != "600" ]]; then
  echo "Error: $ACCOUNTS_FILE mode is $mode; must be 0600 (run: chmod 600 $ACCOUNTS_FILE)" >&2
  exit 1
fi

# --- Require python3 ---
if ! command -v python3 >/dev/null 2>&1; then
  echo "Error: python3 not found on PATH -- the ArgoCD MCP wrapper requires python3 to read $ACCOUNTS_FILE" >&2
  exit 1
fi

# --- Extract URL and token with python3 ---
# Use `if !` form to bypass set -e cleanly (no set +e/set -e toggle dance).
# The python heredoc reads the accounts file, looks up the cluster by id,
# and extracts url and token. It exits non-zero on any missing or null/empty value.
if ! read -r ARGOCD_BASE_URL ARGOCD_API_TOKEN < <(python3 - <<'PY'
import json, os, sys
accounts_file = os.environ["ACCOUNTS_FILE"]
cluster_id = os.environ["ARGOCD_CLUSTER_ID"]
try:
    with open(accounts_file) as f:
        d = json.load(f)
except Exception as e:
    sys.stderr.write(f'Error: failed to read {accounts_file} ({type(e).__name__})\n')
    sys.exit(1)
if not isinstance(d, dict) or cluster_id not in d:
    sys.stderr.write(f'Error: ArgoCD cluster "{cluster_id}" not found in {accounts_file}, or its url/token is missing.\n')
    sys.exit(1)
entry = d[cluster_id]
if not isinstance(entry, dict):
    sys.stderr.write(f'Error: ArgoCD cluster "{cluster_id}" not found in {accounts_file}, or its url/token is missing.\n')
    sys.exit(1)
url = entry.get("url")
token = entry.get("token")
if not url or not token:
    sys.stderr.write(f'Error: ArgoCD cluster "{cluster_id}" not found in {accounts_file}, or its url/token is missing.\n')
    sys.exit(1)
print(url, token)
PY
); then
  exit 1
fi

# Belt-and-suspenders: catch null/empty values output by python (should not happen; python validates above)
if [[ -z "$ARGOCD_BASE_URL" || -z "$ARGOCD_API_TOKEN" ]]; then
  printf 'Error: ArgoCD cluster "%s" not found in %s, or its url/token is missing.\n' "$ARGOCD_CLUSTER_ID" "$ACCOUNTS_FILE" >&2
  exit 1
fi

# --- Validate URL shape ---
if [[ ! "$ARGOCD_BASE_URL" =~ ^https?:// ]]; then
  printf 'Error: ArgoCD url for cluster "%s" must start with http:// or https://\n' "$ARGOCD_CLUSTER_ID" >&2
  exit 1
fi

# --- Export and exec ---
export ARGOCD_BASE_URL ARGOCD_API_TOKEN
echo "ArgoCD MCP: cluster '$ARGOCD_CLUSTER_ID' (${ARGOCD_BASE_URL})" >&2
exec npx --yes argocd-mcp@0.5.0 stdio "$@"
