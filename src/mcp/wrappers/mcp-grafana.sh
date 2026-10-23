#!/usr/bin/env bash
set -Eeuo pipefail

# Launches one read-only Grafana MCP server for the cluster named by
# GRAFANA_CLUSTER. The installer registers one `grafana-<id>` server per
# cluster in ~/.config/tpk/grafana-clusters.yaml that has a viewer_token,
# passing only GRAFANA_CLUSTER; the url and viewer token are resolved here at
# boot, so no token is stored in ~/.claude.json. The server always runs with
# --disable-write.
#
# SECURITY: Do not add 'set -x' (or otherwise enable bash xtrace) to this script.
# The token passes through $resolved below and would be exposed in stderr by
# xtrace. Never print the loaded YAML or any token value when debugging.

trap 'echo "mcp-grafana wrapper: error on line $LINENO" >&2' ERR

CLUSTERS_PATH="$HOME/.config/tpk/grafana-clusters.yaml"

# Validate GRAFANA_CLUSTER is set and non-empty
if [[ -z "${GRAFANA_CLUSTER:-}" ]]; then
  echo "Error: GRAFANA_CLUSTER env var is not set -- this wrapper must be invoked by an installer-registered grafana-<cluster> MCP server" >&2
  exit 1
fi

# Same character class as the installer's GRAFANA_CLUSTER_ID_RE: the id is part
# of the server and tool names, where Claude Code rewrites '.' and treats '__'
# as a separator.
if [[ ! "$GRAFANA_CLUSTER" =~ ^[a-zA-Z0-9-]+$ ]]; then
  echo "Error: GRAFANA_CLUSTER='$GRAFANA_CLUSTER' contains characters outside [a-zA-Z0-9-]" >&2
  exit 1
fi

# uv provides both the YAML lookup below (uv run) and the server itself (uvx)
if ! command -v uv >/dev/null 2>&1; then
  echo "Error: uv not found on PATH -- the Grafana MCP wrapper requires uv (https://docs.astral.sh/uv/)" >&2
  exit 1
fi

if [[ ! -r "$CLUSTERS_PATH" ]]; then
  echo "Error: $CLUSTERS_PATH not found or not readable. Create it (see docs/MCP.md) and run: chmod 600 $CLUSTERS_PATH" >&2
  exit 1
fi

# Enforce mode 0600 on the clusters file (mirrors mcp-github.sh)
mode=$(stat -f '%Lp' "$CLUSTERS_PATH" 2>/dev/null || stat -c '%a' "$CLUSTERS_PATH" 2>/dev/null || echo "")
if [[ -z "$mode" ]]; then
  echo "Error: could not stat $CLUSTERS_PATH to check file mode" >&2
  exit 1
fi
while [[ "$mode" == 0?* ]]; do mode="${mode#0}"; done
mode="${mode:-0}"
if [[ "$mode" != "600" ]]; then
  echo "Error: $CLUSTERS_PATH mode is $mode; must be 0600 (run: chmod 600 $CLUSTERS_PATH)" >&2
  exit 1
fi

# Resolve url (line 1) and viewer token (line 2) for the cluster. The explicit
# if!-guarded form propagates the python exit status under set -e. PyYAML is
# pinned so the lookup never pulls a new, unreviewed release.
if ! resolved="$(
  CLUSTERS_PATH="$CLUSTERS_PATH" uv run --quiet --no-project --with 'PyYAML==6.0.3' python3 - <<'PY'
import os
import sys

import yaml

path = os.environ["CLUSTERS_PATH"]
cluster_id = os.environ["GRAFANA_CLUSTER"]

try:
    with open(path) as fh:
        data = yaml.safe_load(fh)
except Exception as e:
    # SECURITY: print only the exception type -- YAML errors can quote the
    # offending line, which may contain a token.
    sys.exit(f"Error: failed to read {path} ({type(e).__name__})")

clusters = data.get("clusters") if isinstance(data, dict) else None
if not isinstance(clusters, list):
    sys.exit(f"Error: {path} must contain a top-level 'clusters' list")

for cluster in clusters:
    if not isinstance(cluster, dict) or cluster.get("id") != cluster_id:
        continue
    url = cluster.get("url")
    token = cluster.get("viewer_token")
    if not isinstance(url, str) or not url.strip() or "\n" in url.strip():
        sys.exit(f"Error: Grafana cluster '{cluster_id}' has no valid url in {path}")
    # SECURITY: identify the offending entry by id only, never by value.
    if not isinstance(token, str) or not token.strip() or "\n" in token.strip():
        sys.exit(f"Error: Grafana cluster '{cluster_id}' has no valid viewer_token in {path}")
    print(url.strip())
    print(token.strip())
    sys.exit(0)

sys.exit(f"Error: Grafana cluster '{cluster_id}' not found in {path} -- re-run install.sh after editing the file")
PY
)"; then
  exit 1
fi

GRAFANA_URL="${resolved%%$'\n'*}"
GRAFANA_SERVICE_ACCOUNT_TOKEN="${resolved#*$'\n'}"
unset resolved

# Belt-and-suspenders: the python lookup validates both, but never launch with
# an empty credential.
if [[ -z "$GRAFANA_URL" || -z "$GRAFANA_SERVICE_ACCOUNT_TOKEN" ]]; then
  echo "Error: resolved Grafana url or token is empty (this should not happen)" >&2
  exit 1
fi

echo "Grafana MCP: cluster '$GRAFANA_CLUSTER' -> $GRAFANA_URL (read-only)" >&2

export GRAFANA_URL GRAFANA_SERVICE_ACCOUNT_TOKEN
exec uvx mcp-grafana --disable-write "$@"
