#!/usr/bin/env bash
set -euo pipefail

: "${GRAFANA_URL:?Error: GRAFANA_URL is not set}"
: "${GRAFANA_SERVICE_ACCOUNT_TOKEN:?Error: GRAFANA_SERVICE_ACCOUNT_TOKEN is not set}"

EXTRA_ARGS=()
if [[ "${GRAFANA_DISABLE_WRITE:-}" == "true" ]]; then
  EXTRA_ARGS+=("--disable-write")
fi

exec uvx mcp-grafana ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"} "$@"
