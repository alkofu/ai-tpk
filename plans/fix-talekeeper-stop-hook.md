# Feature: Fix Talekeeper Async Stop Hook

## Context and Objectives

**Background:** The Talekeeper session chronicler is configured as an async Stop hook that should read `logs/talekeeper-raw.jsonl`, enrich entries with summaries and verdicts, write a per-session `logs/talekeeper-{session_id}.jsonl` file, and clear the raw log. It has never successfully produced an enriched file. The raw log has grown to 170 entries (391KB) and is never cleared.

**Root Cause Analysis (three compounding failures):**

1. **Permission mode: `dontAsk` blocks writes.** Hook agents run with `permission_mode: "dontAsk"`, which denies Write and Bash tool access. The raw log proves this conclusively -- 36 out of ~50 hook-agent entries explicitly state they cannot write files because "the environment is in don't ask mode." The Talekeeper agent prompt says "write the enriched entries" and "clear the raw log," but the hook agent literally cannot call Write or Bash to do so. This is the primary blocker.

2. **Feedback loop: the SubagentStop capture hook records its own hook-agents.** The `SubagentStop` hook fires `talekeeper-capture.sh` for every subagent stop, including the Stop hook agents themselves (docs-check agent, Talekeeper agent). This means each session appends not just real agent events but also the Stop hook's own SubagentStop events. These entries have `agent_type: ""` and `permission_mode: "dontAsk"` -- they are hook infrastructure noise, not meaningful agent events. 131 of 170 entries have empty `agent_type`, meaning the vast majority of raw log content is hook-agent self-capture.

3. **Raw log never clears, so it grows unboundedly.** Since Talekeeper never successfully writes output, it never clears the raw log. Each session appends more entries (both real agents and hook-agent noise). At 170 entries / 391KB, the file is already challenging for a 60-second agent timeout to process, creating a size-based failure mode on top of the permission failure.

**Secondary issue (working tree drift):** The committed `settings.json` has `"halt_pipeline": true` on the git-diff gate, but the working tree copy has removed it and added a `# gate-v2` comment. This is an uncommitted change that should be resolved, though it does not directly cause the Talekeeper failure since the two Stop hook groups are independent (the gate only affects hooks within its own group).

**Objectives:**
- Talekeeper produces enriched `logs/talekeeper-{session_id}.jsonl` files at session end
- Raw log is cleared after each session so it does not grow unboundedly
- Hook-agent self-capture noise is filtered out of the raw log
- The solution works regardless of the parent session's `permission_mode`

## Guardrails

**Must Have:**
- Talekeeper output files actually get written to disk
- Raw log is cleared after successful enrichment
- Hook-agent SubagentStop events (agent_type="" entries) are excluded
- Solution works in dontAsk, acceptEdits, and default permission modes
- 60-second timeout is sufficient for normal session sizes (1-30 real agent events)

**Must NOT Have:**
- Changes to the Talekeeper agent's conceptual role or security model
- Changes to the SubagentStop capture hook's core behavior (it should still capture real agent events)
- Removal of the async flag (Talekeeper should remain non-blocking)
- Any changes to the docs-check hook group (separate concern)

## Task Flow

### Step 1: Replace the Talekeeper agent hook with a command hook running a shell script

The fundamental problem is that agent-type hooks run as hook-agents with `dontAsk` permission mode, which blocks file writes. A command hook (`type: "command"`) runs as a shell script with full filesystem access, just like `talekeeper-capture.sh` already does for the SubagentStop event.

- [ ] Create `claude/hooks/talekeeper-enrich.sh` as a bash script that performs the enrichment logic:
  - Read `logs/talekeeper-raw.jsonl`; exit 0 immediately if missing or empty
  - Use `jq` to filter out entries where `agent_type` is empty string, null, or `"talekeeper"` (recursion guard + hook-agent noise filter)
  - Extract `session_id` from the first valid entry (fallback: UTC timestamp `YYYY-MM-DD-HHMMSS`)
  - For each valid entry, produce an enriched JSONL line with fields: `timestamp`, `event_type`, `agent_type`, `agent_id`, `session_id`, `summary` (structural metadata only -- e.g., "{agent_type} completed ({event_type})"), `verdict` (extract from `last_assistant_message` for reviewer agents ruinor/knotcutter/riskmancer/windwarden using grep patterns for ACCEPT/REJECT/REVISE; null for non-reviewers)
  - Write output to `logs/talekeeper-{session_id}.jsonl`
  - Truncate `logs/talekeeper-raw.jsonl` to empty
  - Exit 0 always (never surface errors to user)
- [ ] Update `claude/settings.json` Stop hook group 2 to use `type: "command"` with `command: "bash claude/hooks/talekeeper-enrich.sh"` instead of `type: "agent"` with a prompt
- [ ] Keep `async: true` on the hook group

**Acceptance:** The Stop hook runs a shell script that has unconditional filesystem write access, bypassing the dontAsk permission barrier entirely. The script handles empty/missing raw log, filters noise entries, and always exits cleanly.

### Step 2: Filter hook-agent noise in the SubagentStop capture script

Prevent the raw log from accumulating hook-agent self-capture events in the first place.

- [ ] In `claude/hooks/talekeeper-capture.sh`, after reading stdin JSON, check if `agent_id` matches the pattern `hook-agent-*` (using jq or grep)
- [ ] If the entry is a hook-agent event, skip it (exit 0 without appending to the log)
- [ ] Keep the existing fallback behavior for missing jq and invalid JSON

**Acceptance:** After this change, `logs/talekeeper-raw.jsonl` only contains entries from real subagents (bitsmith, ruinor, knotcutter, pathfinder, etc.), not from Stop hook agents. Running `jq -r '.agent_id' logs/talekeeper-raw.jsonl | grep -c 'hook-agent'` returns 0 after a session.

### Step 3: One-time cleanup of the existing raw log

The current raw log has 170 entries accumulated across multiple sessions with mixed session IDs. It needs to be cleaned up before the new system takes over.

- [ ] Create a one-time cleanup: filter the existing `logs/talekeeper-raw.jsonl` to remove all entries where `agent_type` is empty/"" or `agent_id` matches `hook-agent-*`
- [ ] Group remaining valid entries by `session_id`
- [ ] Write each group to `logs/talekeeper-{session_id}.jsonl` as enriched JSONL (using the same format the new script will produce)
- [ ] Truncate `logs/talekeeper-raw.jsonl` to empty after successful processing
- [ ] This can be a one-time jq pipeline run manually or a disposable script

**Acceptance:** After cleanup, `logs/talekeeper-raw.jsonl` is empty. One or more `logs/talekeeper-{session_id}.jsonl` files exist containing only real agent events with enriched fields.

### Step 4: Resolve the uncommitted settings.json drift

The working tree has `halt_pipeline: true` removed and a `# gate-v2` comment added. This should be resolved intentionally.

- [ ] Decide whether `halt_pipeline: true` should be present on the git-diff gate (it was added in commit #31 to prevent the docs-check agent from running when there are no git changes -- this is the intended behavior)
- [ ] If keeping `halt_pipeline`, restore it; if removing it, commit the removal with a clear rationale
- [ ] Remove the `# gate-v2` debug comment regardless (it is noise in production config)

**Acceptance:** `claude/settings.json` has no uncommitted changes, and the git-diff gate behavior is intentionally configured.

### Step 5: Validate end-to-end

- [ ] Start a new Claude Code session in the repo that spawns at least one subagent
- [ ] End the session (triggering the Stop hook)
- [ ] Verify `logs/talekeeper-raw.jsonl` is empty (or contains only entries from the current session if timing allows)
- [ ] Verify a new `logs/talekeeper-{session_id}.jsonl` file exists with enriched entries
- [ ] Verify no hook-agent entries appear in the raw or enriched logs
- [ ] Verify the enriched file schema matches: `timestamp`, `event_type`, `agent_type`, `agent_id`, `session_id`, `summary`, `verdict`

**Acceptance:** At least one enriched session chronicle file exists in `logs/` after a real session. The raw log is cleared. No hook-agent noise is present.

## Edge Cases to Handle

| Case | Expected Behavior |
|------|-------------------|
| Empty or missing raw log | Script exits 0 immediately, no output file created |
| No valid entries after filtering | Script exits 0, no output file, raw log cleared |
| No `session_id` in any entry | Use UTC timestamp `YYYY-MM-DD-HHMMSS` as filename |
| Very large raw log (500+ entries) | Shell script with jq processes this in <5 seconds, well within 60s timeout |
| Malformed JSON lines in raw log | jq skips invalid lines; script continues processing valid ones |
| Multiple session_ids in raw log | Group by session_id and write separate files (or use first session_id for simplicity) |
| `jq` not installed | Script should check for jq and exit 0 gracefully (same pattern as capture script) |

## Success Criteria

- After a normal session with subagent activity, a `logs/talekeeper-{session_id}.jsonl` file is created
- The raw log is cleared after each session
- No entries with `agent_type: ""` or `agent_id: "hook-agent-*"` appear in enriched output
- The enrichment works regardless of the parent session's permission mode (dontAsk, acceptEdits, default)
- The script completes in under 10 seconds for typical session sizes (1-30 agent events)
- The existing `talekeeper.md` agent doc can be updated to reflect the new command-based approach (optional, low priority)
