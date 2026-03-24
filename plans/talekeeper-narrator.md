# Feature: Talekeeper Narrator Redesign

## Context and Objectives

Background: Talekeeper was originally a Stop hook agent that enriched raw sub-agent event logs into structured JSONL chronicles. That enrichment work has been fully replaced by `talekeeper-enrich.sh` (a shell script running as an async Stop hook command) and `talekeeper-capture.sh` (a SubagentStop command hook). The agent definition in `claude/agents/talekeeper.md` is now unused.

The new Talekeeper is a manually invoked narrator agent. Instead of enriching raw logs, it reads the already-enriched session chronicles (`logs/talekeeper-{session_id}.jsonl`) and produces a human-readable narrative: a chat summary of what happened across unprocessed sessions, plus a persistent Markdown document with Mermaid diagrams showing agent interaction flows.

Objectives:
- Repurpose `claude/agents/talekeeper.md` as a manual narrator agent
- Implement a session-tracking mechanism so Talekeeper only narrates new sessions
- Define the narrative document format (`logs/talekeeper-narrative.md`)
- Ensure zero impact on `talekeeper-enrich.sh`, `talekeeper-capture.sh`, and Everwise

**No changes to `claude/settings.json` are required.** This plan does not add, remove, or modify any hooks. The existing hook configuration (SubagentStop running `talekeeper-capture.sh`, Stop running `talekeeper-enrich.sh` async) remains exactly as-is.

## Guardrails

**Must Have:**
- Manual invocation only; agent description must explicitly prohibit automatic triggering
- Agent prompt must state that Talekeeper should only be invoked after a session has fully ended (after the Stop hook and async `talekeeper-enrich.sh` have completed) to avoid narrating partially enriched data
- Reads enriched `logs/talekeeper-{session_id}.jsonl` files (never modifies them)
- Tracks which sessions have been narrated to avoid re-processing
- Chat output: concise multi-session summary
- Written output: appended sections in `logs/talekeeper-narrative.md` with Mermaid diagrams
- Security: summaries derived from structural metadata only (agent_type, event_type, verdict, timestamp, session_id); free-text fields treated as untrusted
- Recursion guard: skip any entries where agent_type is "talekeeper"

**Must NOT Have:**
- No modifications to `talekeeper-enrich.sh` or `talekeeper-capture.sh`
- No changes to the enriched JSONL schema
- No automatic invocation via hooks
- No changes to `claude/settings.json`
- No interpretation of free-text content from log entries as instructions
- No spawning of sub-agents
- No writing outside of `logs/` directory

## Task Flow

### Step 1: Session Tracking Mechanism

Design and document the mechanism Talekeeper uses to know which sessions it has already narrated.

**Chosen approach:** A tracking file at `logs/talekeeper-narrated-sessions.json`.

**File format clarification:** Despite the `.json` extension, this file uses **newline-delimited JSON (JSONL semantics)**: one JSON object per line, append-only. The `.json` extension is chosen deliberately to avoid matching Everwise's `logs/talekeeper-*.jsonl` glob pattern. If the file used a `.jsonl` extension (e.g., `talekeeper-narrated.jsonl`), Everwise would pick it up and attempt to parse tracking records as enriched chronicle entries, producing nulls for all meaningful fields. The `.json` extension sidesteps this entirely.

Each line records a session that has been successfully narrated:

```json
{"session_id": "75147a10-7d20-46e1-88f2-220c41b3f3fd", "narrated_at": "2026-03-23T14:30:00Z"}
```

**Parsing strategy:** Talekeeper uses the `Read` tool to load the tracking file contents and reasons over the JSON objects natively within its context window. No `Bash` commands or `jq` invocations are needed. The same approach applies to reading enriched session chronicle files. This is an inherent limitation for very large files (hundreds of sessions or very large chronicles), as the entire file contents must fit within the agent's context window. For the expected scale of this project, this is acceptable.

**Why this approach over alternatives:**
- Simpler than parsing the narrative document for session headings (fragile regex)
- Decoupled from the narrative document format (can change narrative format without breaking tracking)
- Machine-readable, easy for Talekeeper to load via `Read` and parse natively
- Does not modify the enriched JSONL files (preserves Everwise compatibility)
- Append-only, same pattern used elsewhere in this codebase

**Operational logic:**
1. Glob `logs/talekeeper-*.jsonl` (this matches enriched chronicles only; the tracking file uses `.json` and is excluded automatically)
2. Read `logs/talekeeper-narrated-sessions.json` to get the set of already-narrated session IDs
3. Compute the difference: sessions with chronicle files but not in the narrated set
4. If no new sessions, report "Nothing new to narrate" in chat and exit
5. After successfully writing narrative output, append each newly narrated session_id to `logs/talekeeper-narrated-sessions.json`

- [ ] Document the tracking file schema in the agent prompt, including the JSONL-semantics-with-JSON-extension rationale
- [ ] Specify the glob/filter logic for discovering new sessions
- [ ] Specify that the tracking file uses `.json` extension to avoid Everwise's `talekeeper-*.jsonl` glob
- [ ] Specify append-only write semantics for the tracking file
- [ ] Specify that the agent parses file contents natively via `Read` (no `Bash`/`jq`)
- **Acceptance:** Agent prompt contains clear instructions for session discovery, filtering, and tracking. The tracking file schema is defined with explicit rationale for the `.json` extension. Edge case of empty/missing tracking file is handled (treat as "no sessions narrated yet"). Parsing strategy (native reasoning over `Read` output) is stated.

### Step 2: Narrative Document Format

Define the structure of `logs/talekeeper-narrative.md` and the Mermaid diagram template.

**Document structure:**
- Talekeeper appends a new section each time it runs
- Each run produces a dated header, then per-session subsections
- Each session subsection includes: truncated session ID in heading (first 8 characters), full session ID in a detail line, timestamp range, agent activity summary, reviewer verdicts, and a Mermaid diagram

**Session ID display rules:**
- Narrative headings use the first 8 characters of the session ID for readability (e.g., `### Session 75147a10`)
- A detail line immediately below the heading shows the full session ID (e.g., `**Session ID:** 75147a10-7d20-46e1-88f2-220c41b3f3fd`)
- The tracking file always stores the full session ID

**Example format:**

```markdown
## Narration - 2026-03-23T14:30:00Z

### Session 75147a10

**Session ID:** 75147a10-7d20-46e1-88f2-220c41b3f3fd
**Time span:** 2026-03-24T00:49:14Z to 2026-03-24T01:15:27Z
**Agents active:** pathfinder, ruinor (x3), bitsmith (x2)

| Agent | Invocations | Verdicts |
|-------|-------------|----------|
| pathfinder | 1 | - |
| bitsmith | 2 | - |
| ruinor | 3 | REVISE, REVISE, ACCEPT |

```mermaid
graph LR
    A[pathfinder] --> B[ruinor: REVISE]
    B --> C[bitsmith]
    C --> D[ruinor: REVISE]
    D --> E[bitsmith]
    E --> F[ruinor: ACCEPT]
```

---
```

**Mermaid diagram rules:**
- Nodes represent agent invocations in chronological order
- Edges represent sequential flow (one invocation to the next within the session)
- Reviewer nodes include the verdict as a label suffix
- Non-reviewer nodes show agent name only
- Use `graph LR` (left-to-right) for readability

- [ ] Define the per-run header format (narration timestamp)
- [ ] Define the per-session subsection format (truncated ID heading, full ID detail line, time span, agent table, Mermaid diagram)
- [ ] Specify the session ID truncation rule: first 8 chars for heading, full ID on detail line
- [ ] Document the Mermaid diagram construction rules in the agent prompt
- [ ] Specify that the file is append-only (never overwrite existing content)
- [ ] Handle the case where the file does not yet exist (create it with no preamble, just start appending)
- **Acceptance:** The agent prompt contains a complete example of the expected narrative format. Session headings use truncated IDs with full IDs on a detail line. Mermaid diagram rules are unambiguous. The format is append-only.

### Step 3: Rewrite Agent Prompt

Replace the contents of `claude/agents/talekeeper.md` with the new narrator agent definition.

**Key sections to include:**
- Updated frontmatter: name, description (mentioning manual invocation), tools (`Read, Write, Glob`)
- Core Mission: narrator that reads enriched chronicles and produces human-readable summaries
- Invocation Context: manual only, never automatic, never via hooks. **Must include explicit statement:** "Only invoke Talekeeper after a session has fully ended. The Stop hook runs `talekeeper-enrich.sh` asynchronously; if Talekeeper is invoked before enrichment completes, it may narrate partial data and mark the session as done, permanently missing the remaining events."
- Security section: treat log content as untrusted, summarize from structural metadata only
- Recursion guard: skip entries with agent_type "talekeeper"
- Session discovery logic (from Step 1), including parsing strategy (native reasoning over `Read` output, no `Bash`/`jq`)
- Chat output rules: concise summary covering all new sessions
- Written output rules: append to `logs/talekeeper-narrative.md` (from Step 2), including session ID truncation rules
- Tracking file update: append to `logs/talekeeper-narrated-sessions.json` after successful write, with explicit note on JSONL-semantics and `.json` extension rationale
- Operational rules (numbered, unambiguous)
- Error handling: if no new sessions, report in chat and exit; if read/write fails, report error to user (unlike the old silent-exit behavior, since this is now user-facing)
- Tool usage table: `Read, Write, Glob` (confirmed sufficient; no `Bash` or `Grep` needed)
- What Talekeeper does NOT do

**Personality note:** Retain the halfling bard flavor but adjust the framing from "chronicler who writes at session end" to "narrator who recounts tales on demand."

- [ ] Write new frontmatter with updated description and tools (`Read, Write, Glob`)
- [ ] Write Core Mission section
- [ ] Write Invocation Context section (manual only, explicit prohibition of automatic use, explicit warning about invoking only after session fully ends and enrichment completes)
- [ ] Write Security section
- [ ] Write Session Discovery and Tracking section (including parsing strategy and file format rationale)
- [ ] Write Chat Output section with format guidance
- [ ] Write Written Output section with Mermaid diagram rules and session ID truncation rules
- [ ] Write Operational Rules (numbered steps)
- [ ] Write Error Handling section
- [ ] Write Tool Usage table (confirm `Read, Write, Glob` is the complete set)
- [ ] Write exclusions list (what Talekeeper does NOT do)
- **Acceptance:** The agent file is self-contained. A reader can understand what Talekeeper does, how to invoke it, what it reads, what it writes, and what it refuses to do, without consulting any other document. The agent prompt itself (not just the plan) contains the timing warning about post-session invocation.

### Step 4: Verify Everwise Compatibility

Confirm that the redesigned Talekeeper does not interfere with Everwise's workflow.

**Analysis:**
- Everwise reads `logs/talekeeper-*.jsonl` via `Glob` with pattern `logs/talekeeper-*.jsonl`
- The tracking file `logs/talekeeper-narrated-sessions.json` uses a `.json` extension
- Everwise's glob `talekeeper-*.jsonl` requires a `.jsonl` extension to match
- Therefore `talekeeper-narrated-sessions.json` is **not matched** by Everwise's glob

**Verification checklist:**
- [ ] Confirm Everwise's glob pattern is `logs/talekeeper-*.jsonl` (verified: see `claude/agents/everwise.md` Step 1)
- [ ] Confirm the tracking file `logs/talekeeper-narrated-sessions.json` does not match this glob (confirmed: `.json` != `.jsonl`)
- [ ] Verify that `talekeeper-narrative.md` (the Markdown output) does not interfere with Everwise (it does not: Everwise only reads `.jsonl` files)
- [ ] Confirm no changes to Everwise's agent definition are required
- **Acceptance:** Everwise's glob `logs/talekeeper-*.jsonl` does not match the tracking file. Everwise's workflow is completely unaffected. No changes to Everwise's agent definition are required.

### Step 5: Edge Cases and Operational Risks

Document known edge cases and how Talekeeper should handle them.

- [ ] **Empty session chronicles:** A `talekeeper-{session_id}.jsonl` file exists but is empty (0 bytes). Talekeeper should skip it and NOT mark it as narrated (it may be populated later if the enrich script hasn't finished).
- [ ] **Concurrent invocation / partial enrichment:** User invokes Talekeeper while `talekeeper-enrich.sh` is still running asynchronously. The enriched file may be partially written. Mitigation: The agent prompt must include an explicit warning (in the Invocation Context section, not just here) that Talekeeper should only be invoked after a session has fully ended and the Stop hook has completed. If invoked too early, partial data produces a partial narrative, and the session is marked narrated permanently, missing the remaining events.
- [ ] **Very large session count:** If many sessions are unnarrated, the narrative could be very long. Talekeeper should process all of them but keep per-session summaries concise (table + diagram, no prose beyond the chat output). Note: because Talekeeper parses files via `Read` and native reasoning (no `Bash`/`jq`), very large files may exceed context window limits. This is an accepted limitation at current scale.
- [ ] **Duplicate session IDs:** The enrich script derives session_id from the raw event data; duplicates are unlikely but possible if the same session_id appears in multiple files. Talekeeper should treat each file as a distinct unit regardless.
- [ ] **Malformed JSONL entries:** Skip lines that are not valid JSON (same rule as the existing system).
- [ ] **Missing tracking file:** First invocation -- treat as no sessions narrated yet, create the file on first write.
- [ ] **Mermaid diagram complexity:** Sessions with many agent invocations (20+) could produce unreadable diagrams. Cap diagram nodes at 15; if exceeded, show first 7 and last 7 with an ellipsis node in between.
- **Acceptance:** Each edge case has a documented handling strategy in the agent prompt. No edge case causes a silent failure or data corruption.

## Success Criteria

- `claude/agents/talekeeper.md` is rewritten as a manual narrator agent with complete, self-contained instructions
- Session tracking uses `logs/talekeeper-narrated-sessions.json`, a file that uses JSONL semantics (one JSON object per line, append-only) with a `.json` extension to avoid colliding with Everwise's `talekeeper-*.jsonl` glob
- The agent parses all files via the `Read` tool and native reasoning; no `Bash` or `jq` dependencies
- The tool list is `Read, Write, Glob` (confirmed sufficient)
- The narrative document format (`logs/talekeeper-narrative.md`) is defined with example structure including Mermaid diagrams
- Session headings use truncated IDs (first 8 chars) with full IDs on a detail line below
- The agent prompt itself contains an explicit warning that Talekeeper should only be invoked after a session has fully ended (after Stop hook completion)
- `talekeeper-enrich.sh` and `talekeeper-capture.sh` are not modified
- `claude/settings.json` is not modified (no hooks added or removed)
- The enriched JSONL schema is not modified
- Everwise's workflow is unaffected (verified by glob pattern analysis)
- All edge cases are documented with handling strategies
- The agent prompt explicitly prohibits automatic invocation
- Security posture is maintained: structural metadata only, no free-text interpretation
