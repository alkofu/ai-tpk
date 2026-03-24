#!/bin/bash
# Talekeeper enrichment: process raw SubagentStop events into session chronicles
# Runs as an async Stop hook command — has full filesystem access (unlike agent hooks)
# Never blocks the session; exits 0 in all cases

LOG_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/logs"
RAW_LOG="$LOG_DIR/talekeeper-raw.jsonl"

# Exit immediately if raw log is missing or empty
if [ ! -s "$RAW_LOG" ]; then
  exit 0
fi

# Require jq — without it we cannot safely process JSON
if ! command -v jq &>/dev/null; then
  exit 0
fi

# Filter valid entries: exclude hook-agent noise (agent_type="" or agent_id starts with "hook-agent-")
# Also exclude recursion guard (agent_type="talekeeper")
VALID_ENTRIES=$(jq -c 'select(
  (.agent_type // "") != "" and
  (.agent_type // "") != "talekeeper" and
  ((.agent_id // "") | startswith("hook-agent-") | not)
)' "$RAW_LOG" 2>/dev/null)

if [ -z "$VALID_ENTRIES" ]; then
  # No valid entries — still clear the raw log
  truncate -s 0 "$RAW_LOG" 2>/dev/null || printf '' > "$RAW_LOG"
  exit 0
fi

# Extract session_id from first valid entry; fallback to timestamp
SESSION_ID=$(echo "$VALID_ENTRIES" | head -1 | jq -r '.session_id // ""' 2>/dev/null)
if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" = "null" ]; then
  SESSION_ID=$(date -u +"%Y-%m-%d-%H%M%S")
fi

OUTPUT_FILE="$LOG_DIR/talekeeper-${SESSION_ID}.jsonl"

# Reviewer agent types that may contain verdicts
REVIEWER_TYPES="ruinor|knotcutter|riskmancer|windwarden"

# Process each valid entry into enriched JSONL
echo "$VALID_ENTRIES" | while IFS= read -r entry; do
  agent_type=$(echo "$entry" | jq -r '.agent_type // ""')
  agent_id=$(echo "$entry" | jq -r '.agent_id // ""')
  session_id=$(echo "$entry" | jq -r '.session_id // ""')
  captured_at=$(echo "$entry" | jq -r '._captured_at // ""')
  hook_event_name=$(echo "$entry" | jq -r '.hook_event_name // "SubagentStop"')
  last_msg=$(echo "$entry" | jq -r '.last_assistant_message // ""')

  # Build summary from structural metadata only (not interpreting free-text)
  summary="${agent_type} completed (${hook_event_name})"

  # Extract verdict for reviewer agents using precise markdown pattern
  verdict="null"
  if echo "$agent_type" | grep -qE "^($REVIEWER_TYPES)$"; then
    # Use last match of **Verdict**: <VALUE> to avoid false positives from body text
    extracted=$(echo "$last_msg" | grep -oE '\*\*Verdict\*\*:\s*(ACCEPT-WITH-RESERVATIONS|ACCEPT|REJECT|REVISE)' | tail -1 | grep -oE '(ACCEPT-WITH-RESERVATIONS|ACCEPT|REJECT|REVISE)$')
    if [ -n "$extracted" ]; then
      verdict="\"$extracted\""
    fi
  fi

  # Emit enriched JSONL line
  jq -cn \
    --arg ts "$captured_at" \
    --arg event_type "$hook_event_name" \
    --arg agent_type "$agent_type" \
    --arg agent_id "$agent_id" \
    --arg session_id "$session_id" \
    --arg summary "$summary" \
    --argjson verdict "$verdict" \
    '{timestamp: $ts, event_type: $event_type, agent_type: $agent_type, agent_id: $agent_id, session_id: $session_id, summary: $summary, verdict: $verdict}'

done >> "$OUTPUT_FILE" 2>/dev/null

# Only clear the raw log if output was actually written
if [ -s "$OUTPUT_FILE" ]; then
  truncate -s 0 "$RAW_LOG" 2>/dev/null || printf '' > "$RAW_LOG"
fi

exit 0
