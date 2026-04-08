#!/usr/bin/env bash
set -euo pipefail

# Resolve AWS profile: dotfile takes priority over env var
DOTFILE="$HOME/.claude/.current-aws-profile"
if [[ -f "$DOTFILE" ]] && [[ -s "$DOTFILE" ]]; then
  IFS= read -r AWS_PROFILE < "$DOTFILE"
  # Trim leading/trailing whitespace (bash-native, since we already require bash for [[ ]])
  AWS_PROFILE="${AWS_PROFILE#"${AWS_PROFILE%%[! $'\t']*}"}"
  AWS_PROFILE="${AWS_PROFILE%"${AWS_PROFILE##*[! $'\t']}"}"
fi

# Validate profile name if set
if [[ -n "${AWS_PROFILE:-}" ]]; then
  if [[ ! "$AWS_PROFILE" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    printf 'Error: invalid AWS profile name "%s" -- must match [a-zA-Z0-9_-]+\n' "$AWS_PROFILE" >&2
    exit 1
  fi
  export AWS_PROFILE
  echo "CloudWatch MCP: using AWS profile '$AWS_PROFILE'" >&2
  exec uvx awslabs.cloudwatch-mcp-server@0.0.19 "$@"
fi

# Neither dotfile nor env var provided a profile -- fail helpfully
printf 'Error: no AWS profile set.\n' >&2
printf 'Set one by running /set-aws-profile in Claude Code, or:\n' >&2
printf '  echo "my-profile" > ~/.claude/.current-aws-profile\n\n' >&2
printf 'Available profiles in ~/.aws/config:\n' >&2
if [[ -f "$HOME/.aws/config" ]]; then
  grep -E '^\[(default|profile [^]]+)\]' "$HOME/.aws/config" \
    | sed 's/^\[profile //;s/^\[//;s/\]$//' >&2
else
  printf '  (no ~/.aws/config found)\n' >&2
fi
exit 1
