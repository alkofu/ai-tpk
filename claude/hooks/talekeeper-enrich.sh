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
  agent_transcript_path=$(echo "$entry" | jq -r '.agent_transcript_path // ""')

  # Extract token usage from agent transcript if available
  input_tokens=0
  output_tokens=0
  cache_creation_input_tokens=0
  cache_read_input_tokens=0

  if [ -n "$agent_transcript_path" ]
  then
    if [ -f "$agent_transcript_path" ]
    then
      file_size=$(wc -c < "$agent_transcript_path" 2>/dev/null || echo "0")
      if [ "$file_size" -le 52428800 ]
      then
        token_json=$(jq -s '[.[] | select(.type == "assistant") | .message.usage // {}] | { input_tokens: (map(.input_tokens // 0) | add // 0), output_tokens: (map(.output_tokens // 0) | add // 0), cache_creation_input_tokens: (map(.cache_creation_input_tokens // 0) | add // 0), cache_read_input_tokens: (map(.cache_read_input_tokens // 0) | add // 0) }' "$agent_transcript_path" 2>/dev/null)
        if [ -n "$token_json" ]
        then
          input_tokens=$(echo "$token_json" | jq -r '.input_tokens // 0' 2>/dev/null || echo "0")
          output_tokens=$(echo "$token_json" | jq -r '.output_tokens // 0' 2>/dev/null || echo "0")
          cache_creation_input_tokens=$(echo "$token_json" | jq -r '.cache_creation_input_tokens // 0' 2>/dev/null || echo "0")
          cache_read_input_tokens=$(echo "$token_json" | jq -r '.cache_read_input_tokens // 0' 2>/dev/null || echo "0")
        fi
      fi
    fi
  fi

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
  # Build agent_transcript_path arg — emit null when field is absent in raw event
  atp_arg="null"
  if [ -n "$agent_transcript_path" ]; then
    atp_arg="\"$agent_transcript_path\""
  fi

  jq -cn \
    --arg ts "$captured_at" \
    --arg event_type "$hook_event_name" \
    --arg agent_type "$agent_type" \
    --arg agent_id "$agent_id" \
    --arg session_id "$session_id" \
    --arg summary "$summary" \
    --argjson verdict "$verdict" \
    --argjson agent_transcript_path "$atp_arg" \
    --argjson input_tokens "$input_tokens" \
    --argjson output_tokens "$output_tokens" \
    --argjson cache_creation_input_tokens "$cache_creation_input_tokens" \
    --argjson cache_read_input_tokens "$cache_read_input_tokens" \
    '{timestamp: $ts, event_type: $event_type, agent_type: $agent_type, agent_id: $agent_id, session_id: $session_id, summary: $summary, verdict: $verdict, agent_transcript_path: $agent_transcript_path, input_tokens: $input_tokens, output_tokens: $output_tokens, cache_creation_input_tokens: $cache_creation_input_tokens, cache_read_input_tokens: $cache_read_input_tokens}'

done >> "$OUTPUT_FILE" 2>/dev/null

# Only clear the raw log if output was actually written
if [ -s "$OUTPUT_FILE" ]; then
  truncate -s 0 "$RAW_LOG" 2>/dev/null || printf '' > "$RAW_LOG"
fi

exit 0
