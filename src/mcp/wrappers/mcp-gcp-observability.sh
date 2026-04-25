#!/usr/bin/env bash
set -euo pipefail

# Resolve GCP project: dotfile takes priority over env var
DOTFILE="$HOME/.claude/.current-gcp-project"
if [[ -f "$DOTFILE" ]] && [[ -s "$DOTFILE" ]]; then
  IFS= read -r GOOGLE_CLOUD_PROJECT < "$DOTFILE"
  # Trim leading/trailing whitespace
  GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT#"${GOOGLE_CLOUD_PROJECT%%[! $'\t']*}"}"
  GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT%"${GOOGLE_CLOUD_PROJECT##*[! $'\t']}"}"
fi

# Validate project ID if set
if [[ -n "${GOOGLE_CLOUD_PROJECT:-}" ]]; then
  if [[ ! "$GOOGLE_CLOUD_PROJECT" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]] || [[ "$GOOGLE_CLOUD_PROJECT" =~ -- ]]; then
    printf 'Error: invalid GCP project ID "%s" -- must be 6-30 chars, lowercase letters/digits/hyphens, start with letter, not end with hyphen, no consecutive hyphens\n' "$GOOGLE_CLOUD_PROJECT" >&2
    exit 1
  fi
  export GOOGLE_CLOUD_PROJECT
  echo "GCP Observability MCP: project '$GOOGLE_CLOUD_PROJECT'" >&2
  exec npx --yes @google-cloud/observability-mcp@0.2.3 "$@"
fi

# Neither dotfile nor env var provided a project -- fail helpfully
printf 'Error: no GCP project set.\n' >&2
printf 'Set one by running the tpk launcher, or:\n' >&2
printf '  echo "my-project-id" > ~/.claude/.current-gcp-project\n\n' >&2
printf 'To find your project IDs, run: gcloud projects list\n' >&2
exit 1
