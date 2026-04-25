#!/usr/bin/env bash
set -euo pipefail

# SECURITY: Do not add 'set -x' (or otherwise enable bash xtrace) to this script.
# The PAT passes through $TOKEN below and would be exposed in stderr by xtrace.
# If you need to debug, instrument the python heredoc with explicit print statements
# that NEVER echo the loaded dict or any individual PAT value.

# Validate GITHUB_ACCOUNT is set and non-empty
if [[ -z "${GITHUB_ACCOUNT:-}" ]]; then
  echo "Error: GITHUB_ACCOUNT env var is not set -- this wrapper must be invoked by the installer-registered MCP server" >&2
  exit 1
fi

# Validate GITHUB_ACCOUNT matches safe character class (mirrors cloudwatch/gcp validation pattern)
if [[ ! "$GITHUB_ACCOUNT" =~ ^[a-zA-Z0-9_.-]+$ ]]; then
  echo "Error: GITHUB_ACCOUNT='$GITHUB_ACCOUNT' contains characters outside [a-zA-Z0-9_.-]" >&2
  exit 1
fi

# Validate python3 is available before any token extraction
if ! command -v python3 >/dev/null 2>&1; then
  echo "Error: python3 not found on PATH -- the GitHub MCP wrapper requires python3 to read ~/.config/tpk/github-pats.json" >&2
  exit 1
fi

# Validate pnpx is available before any token extraction
if ! command -v pnpx >/dev/null 2>&1; then
  echo "Error: pnpx not found on PATH -- this repository's wrapper uses pnpm. Install pnpm (https://pnpm.io/installation) and re-try." >&2
  exit 1
fi

# Validate ~/.config/tpk/github-pats.json exists and is readable
if [ ! -r "$HOME/.config/tpk/github-pats.json" ]; then
  echo 'Error: ~/.config/tpk/github-pats.json not found or not readable. Create a flat JSON object mapping account keys to PATs, e.g. {"personal": "ghp_xxx", "work": "ghp_yyy"} and run: chmod 600 ~/.config/tpk/github-pats.json' >&2
  exit 1
fi

# Validate ~/.config/tpk/github-pats.json mode is exactly 0600 (V-1 part 1)
PATS_PATH="$HOME/.config/tpk/github-pats.json"
mode=$(stat -f '%Lp' "$PATS_PATH" 2>/dev/null || stat -c '%a' "$PATS_PATH" 2>/dev/null || echo "")
if [[ -z "$mode" ]]; then
  echo "Error: could not stat $PATS_PATH to check file mode" >&2
  exit 1
fi
# Normalise: strip ALL leading zeros; default to "0" if entirely zero.
# Mirrors the installer's modeStr.replace(/^0+/, "") || "0" logic (F-3).
while [[ "$mode" == 0?* ]]; do mode="${mode#0}"; done
mode="${mode:-0}"
if [[ "$mode" != "600" ]]; then
  echo "Error: $PATS_PATH mode is $mode; must be 0600 (run: chmod 600 $PATS_PATH)" >&2
  exit 1
fi

# Extract the token using explicit if!-guarded heredoc form.
# This form is mandatory -- it propagates the python script's exit status reliably
# even with set -euo pipefail, because command substitution failures inside
# local/export/simple assignments do NOT trigger set -e exit; the explicit if!
# boundary is what makes the failure abort the script.
if ! TOKEN="$(python3 - <<'PY'
import json, os, sys
try:
    with open(os.path.expanduser("~/.config/tpk/github-pats.json")) as f:
        d = json.load(f)
except Exception as e:
    # SECURITY: print only the exception type, never str(e) in case json
    # parsing surfaces file fragments containing the PAT (V-3, V-4).
    sys.stderr.write(f'Error: failed to read ~/.config/tpk/github-pats.json ({type(e).__name__})\n')
    sys.exit(1)
k = os.environ["GITHUB_ACCOUNT"]
if not isinstance(d, dict):
    sys.stderr.write('Error: ~/.config/tpk/github-pats.json must be a JSON object\n')
    sys.exit(1)
if k not in d:
    # SECURITY: it is safe to echo the requested key 'k' because it came
    # from the GITHUB_ACCOUNT env var (already validated above), not from
    # the PATs file. We never echo any value from the dict.
    sys.stderr.write(f"Error: account key '{k}' not found in ~/.config/tpk/github-pats.json\n")
    sys.exit(1)
v = d[k]
if not isinstance(v, str) or not v:
    # SECURITY: identify the offending entry by key only, never by value (V-4).
    sys.stderr.write(f"Error: PAT for account '{k}' must be a non-empty string\n")
    sys.exit(1)
print(v)
PY
)"; then
  exit 1
fi

# Belt-and-suspenders empty-token guard (F-12)
if [[ -z "$TOKEN" ]]; then
  echo "Error: extracted token is empty (this should not happen; the python heredoc validates non-empty strings)" >&2
  exit 1
fi

echo "GitHub MCP: using account '$GITHUB_ACCOUNT'" >&2

export GITHUB_PERSONAL_ACCESS_TOKEN="$TOKEN"
# Belt-and-suspenders: exec replaces the process so $TOKEN goes away with the
# shell anyway, but explicitly unsetting documents intent and protects against
# any future refactor that adds work between this point and the exec call.
unset TOKEN
# Pinned to 2025.4.8 on 2026-04-23. Package archived 2025-05-29; any future
# 'latest' publish would be a supply-chain anomaly we want to opt out of.
# To bump: vet the new version, update the pin, update docs/MCP.md, and
# update the grep assertion in Step 6 sub-step 4.
exec pnpx @modelcontextprotocol/server-github@2025.4.8 "$@"
