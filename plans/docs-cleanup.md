# Feature: Agent Markdown Cleanup — Lean Operational Prompts

## Context and Objectives

Background: Claude reads `claude/agents/*.md` files as operational prompts at runtime. Several agent files contain fantasy/flavor prose (D&D-themed introductions, personality notes, philosophical quotes) that serves human readers but adds noise for Claude's operational parsing. The human-readable content belongs in `docs/AGENTS.md`, which already serves as the narrative reference for all agents.

Objectives:
- Strip non-operational flavor text from agent prompt files to reduce token overhead
- Preserve all behavioral rules, constraints, and operational instructions
- Relocate missing flavor content (Talekeeper, Everwise) to `docs/AGENTS.md`
- Slim `docs/CONFIGURATION.md` by removing duplicated agent/skills lists

## Guardrails

**Must Have:**
- Every removal is flavor-only; no operational instructions lost
- Talekeeper and Everwise flavor text added to their profiles in `docs/AGENTS.md` before deletion from agent files
- Behavioral rules in Bitsmith's "Failure Patterns to Avoid" kept intact (only prose trimming)

**Must NOT Have:**
- Changes to orchestrator.md, pathfinder.md, ruinor.md, riskmancer.md, or quill.md (already lean)
- Re-adding Bitsmith flavor to docs/AGENTS.md (already present there)
- Deletion of docs/CONFIGURATION.md (it has unique hook documentation)
- No changes to any file outside of the five target agent files (`bitsmith.md`, `talekeeper.md`, `everwise.md`, `windwarden.md`, `knotcutter.md`), `docs/AGENTS.md`, and `docs/CONFIGURATION.md`

## Task Flow

### Step 1: Trim bitsmith.md

- [ ] Remove lines 11-19: the D&D smithing intro paragraph ("Every task is an ingot of raw ore...")
- [ ] Remove lines 167-181: "The Smith's Creed" section (7 motivational quotes, zero operational content)
- [ ] In the "Failure Patterns to Avoid" section (lines 183-204): keep the behavioral rules and section headers. Remove only the metaphor/analogy sentences from each failure pattern paragraph, keeping the opening behavioral statement of each subsection intact. Do not rewrite or paraphrase — only delete the analogy sentences.
- [ ] No relocation needed — Bitsmith's smithing metaphors already exist in `docs/AGENTS.md`
- **Acceptance:** bitsmith.md contains only operational instructions, constraints, and behavioral rules. No prose paragraphs with smithing metaphors remain. File is noticeably shorter.

### Step 2: Trim talekeeper.md

- [ ] Remove lines 9-11: "A halfling bard who emerges from the shadows..." intro paragraph (3 lines of pure flavor)
- [ ] Verify the remaining content is operational (session narration instructions, formatting rules, trigger conditions)
- **Acceptance:** talekeeper.md opens directly with operational context or role definition, no character description. File loses exactly the 3-line halfling bard paragraph.

### Step 3: Trim everwise.md

- [ ] Remove lines 10-14: "A gnomish woman of extraordinary precision..." intro paragraph and the block quote "The party that does not study its own mistakes..."
- [ ] Remove lines 213-219: "Personality Note" section and closing quote
- [ ] Verify the remaining content is operational (learning loop instructions, pattern extraction rules, file formats)
- **Acceptance:** everwise.md has no character description paragraph, no personality note, no closing philosophical quote. All learning-loop operational instructions remain intact.

### Step 4: Trim windwarden.md

- [ ] Remove the flavor prefix "Swift as the wind, sharp as an arrow." from line 28 in the Core Mission section. Keep the operational mission statement that follows.
- [ ] Remove lines 245-249: the "Philosophy" section including the quote and ranger metaphor
- [ ] Verify remaining content is operational (PR review instructions, check criteria, output formats)
- **Acceptance:** windwarden.md Core Mission starts with operational text. No Philosophy section at end of file. All review criteria and behavioral rules intact.

### Step 5: Trim knotcutter.md (optional, lower priority)

- [ ] In the "Collaboration Style" section, keep only the "Be ruthless about" bullets (lines 170-174). Remove the "Treat removals as" bullets (lines 176-180) and the closing aphorism (line 186).
- **Acceptance:** knotcutter.md Collaboration Style section contains only actionable behavioral directives. No motivational framing or closing aphorisms.

### Step 6: Update docs/AGENTS.md with relocated flavor text

- [ ] Locate the Talekeeper profile section in `docs/AGENTS.md`
- [ ] Add the halfling bard intro paragraph ("A halfling bard who emerges from the shadows...") to the Talekeeper profile, matching the style of other agent profiles (e.g., Bitsmith's existing flavor text)
- [ ] Locate the Everwise profile section in `docs/AGENTS.md`
- [ ] Add the gnomish woman intro paragraph ("A gnomish woman of extraordinary precision...") and the block quote to the Everwise profile
- [ ] Add the "Personality Note" content and closing quote from everwise.md to the Everwise profile
- [ ] Do NOT add Windwarden or Knotcutter flavor text — it has no particular narrative value worth preserving
- **Acceptance:** docs/AGENTS.md Talekeeper profile includes the halfling bard paragraph. Everwise profile includes the gnomish woman paragraph, personality note, and closing quote. No other profiles changed.

### Step 7: Slim docs/CONFIGURATION.md

- [ ] Replace the agent list section with a one-line pointer: "See [docs/AGENTS.md](AGENTS.md) for the full agent roster and descriptions."
- [ ] Replace the skills list section with a one-line pointer: "See the project README for the current skills list."
- [ ] Replace the review workflow note with a one-line pointer to the relevant ADR (if it is just a pointer already, remove the redundant section entirely)
- [ ] Keep all hook technical documentation intact (SubagentStop hook behavior, Stop hook gate logic, halt_pipeline, timeout values, filtering logic) — this is the file's unique value
- **Acceptance:** docs/CONFIGURATION.md is under 75 lines. Hook documentation is unchanged. Agent list, skills list, and review workflow sections are replaced with pointers.

## Success Criteria

- All five agent files (bitsmith, talekeeper, everwise, windwarden, knotcutter) are shorter with zero loss of operational instructions
- docs/AGENTS.md has complete narrative profiles for Talekeeper and Everwise (flavor text relocated)
- docs/CONFIGURATION.md retains hook documentation but sheds duplicated reference lists
- No changes to orchestrator.md, pathfinder.md, ruinor.md, riskmancer.md, or quill.md
- A quick read of each trimmed agent file reveals only instructions Claude should follow — no character backstories, philosophical quotes, or motivational prose
