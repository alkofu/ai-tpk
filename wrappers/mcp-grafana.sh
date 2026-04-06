#!/usr/bin/env bash
set -euo pipefail

: "${GRAFANA_URL:?Error: GRAFANA_URL is not set}"
: "${GRAFANA_SERVICE_ACCOUNT_TOKEN:?Error: GRAFANA_SERVICE_ACCOUNT_TOKEN is not set}"

exec uvx mcp-grafana "$@"
