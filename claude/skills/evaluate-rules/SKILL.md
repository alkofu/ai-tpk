---
name: evaluate-rules
description: >
  Grade AI-agent instruction files — CLAUDE.md, AGENTS.md, .claude/rules/*.md, agent definitions (agents/*.md), skills (SKILL.md), and reference files — against a rule-writing rubric, and report pass/warn/fail per criterion with quoted evidence and concrete rewrites. Use when the user asks to evaluate, audit, review, grade, lint, or tighten a CLAUDE.md, a rules file, an agent prompt, or a skill, or asks whether an instruction "should be a rule", "is in the right place", or "is too long". Read-only: reports findings and edits nothing unless the user asks afterwards.
---

# Evaluate Rules

Grade instruction files that an AI agent loads, and say what to cut, move, or rewrite. Every line in these files costs context on every load and competes for the model's attention, so the rubric rewards fewer, sharper, correctly placed instructions.

This skill is read-only. It produces an in-session report and writes no files. If the user then asks for fixes, apply them as a separate step.

## Step 1 — Pick targets and classify them

If the user names files or directories, use those. Otherwise discover candidates from the current working directory: `CLAUDE.md` and `AGENTS.md` at any depth, `.claude/rules/**/*.md`, `.cursorrules`, `agents/*.md`, `**/SKILL.md`, and `references/**/*.md`. Exclude `node_modules/`, `.git/`, build output, and other worktrees nested under the current directory (such as `.claude/worktrees/` or `.worktrees/`). If discovery finds more than ten files, list them and ask the user which to grade.

Classify each file by where it is loaded from, not where its source sits. If the repo installs or syncs files elsewhere (an install script, a symlink, a plugin manifest), classify the file by its installed location and note the mapping in the report header — for example, a `claude/CLAUDE.md` copied to `~/.claude/CLAUDE.md` is `always-on`. Ask the user when the destination is unclear. The type decides which criteria apply and which size budget is used.

| Type | Matches | Loaded |
|------|---------|--------|
| `always-on` | root `CLAUDE.md`, `AGENTS.md`, `~/.claude/CLAUDE.md`, `.claude/rules/*.md` without `paths:` frontmatter | Every session, survives `/compact` |
| `scoped` | nested `CLAUDE.md`, `.claude/rules/*.md` with `paths:` frontmatter | When work touches that subtree or glob |
| `agent` | `agents/*.md` with agent frontmatter | Every time that agent runs, as its system prompt |
| `skill` | `SKILL.md` | Description always; body when the skill triggers |
| `reference` | a supporting file read on demand by an agent or skill | Only when a pointer tells the model to read it |

## Step 2 — Measure

For each file, get the line and byte counts with `wc -lc <file>`; estimate tokens as bytes / 4. Read the whole file with the Read tool before grading it.

## Step 3 — Grade

Walk the four dimensions below in order. Grade every criterion that applies to the file's type as:

- `pass` — clearly satisfied.
- `warn` — partly satisfied, or a judgment call that could go either way. Prefer `warn` over `fail` for judgment criteria.
- `fail` — clearly violated. Use it freely for the mechanical criteria B5, D1, D4, and D5; every other criterion is a judgment call, so reserve `fail` there for unambiguous cases.
- `n/a` — the criterion does not apply to this file's type or content.

For every `warn` and `fail`: quote the offending line(s) verbatim with a line number, say in one or two sentences what is wrong, and give a concrete rewrite or action (the replacement text, the destination file, or the hook to write). A finding without a concrete fix is not finished.

Statement-level criteria (dimensions A and C) apply to each instruction in the file. Report the worst instances, grouping repeats of the same problem into one finding that lists their line numbers. When one problem trips several criteria, file it once under the best-fit ID and list the others in the same row; do not count it more than once. Text that is description rather than instruction (a line telling the model what it already knows) goes under D3.

Cross-file criteria (B3, B4, B5, C6) look beyond the target. Bound that search to the files the target points to, plus one grep for the target's distinctive phrases across the instruction files in the same repo (or the same `~/.claude/` tree for user-scope files).

### A. Should this be an instruction at all?

| ID | Check | Applies to |
|----|-------|------------|
| A1 | The instruction changes behavior the model would otherwise get wrong, or states a fact it cannot discover from the code. Generic virtues ("write clean code", "be thorough", "follow best practices") fail. | all |
| A2 | It is not mechanically checkable. If a regex, shell command, or test could decide compliance — banned commands, file patterns, required flags — it belongs in a hook or permission rule, which actually enforces it. Absolute "never/always" rules with nothing enforcing them are the strongest hook candidates. | all |
| A3 | A linter, formatter, or type checker could not enforce it (import order, quote style, naming case, unused vars). | all |
| A4 | It is not a multi-step procedure or bulky reference needed only for some tasks. Those belong in a skill or reference loaded on demand. | always-on, scoped, agent |
| A5 | It does not restate what the repo already says: config files, `package.json` scripts, lockfiles, or a pattern the code shows consistently. | all |
| A6 | It addresses a real, current problem. A stated reason, incident, or concrete example passes; hypothetical future-proofing ("in case we ever…") warns. | all |

### B. Is it in the right place?

| ID | Check | Applies to |
|----|-------|------------|
| B1 | Finish the sentence "This applies when ___". "Always, in this repo" belongs in an always-on file; a directory or glob belongs in a nested `CLAUDE.md` or a `paths:`-scoped rule; a task type belongs in a skill; "for me, in every repo" belongs in user scope (`~/.claude/CLAUDE.md`); "only when this agent runs" belongs in that agent's file. Fail when the answer contradicts the file's type. | all |
| B2 | Guardrails that must hold everywhere and survive `/compact` sit in an always-on file, not in a nested or scoped one. | scoped |
| B3 | The same instruction is not stated in two files. Grep sibling instruction files for distinctive phrases; when duplicated, name the single file that should own it and replace the others with a pointer. | all |
| B4 | Content shared by several agents or skills lives in one reference or skill they point to, not copied into each. | agent, skill |
| B5 | Pointers resolve from where the file is read. Every path, skill, agent, or command it names exists, and a file installed outside its source repo does not point back into that repo. When the file says an agent or skill uses something, that caller can actually load it: the skill is preloaded via `skills:` frontmatter, or the caller has the tool or path to read it. | all |

### C. Is each instruction well written?

| ID | Check | Applies to |
|----|-------|------------|
| C1 | Behavioral rules are firm, with no hedging. "Try to", "consider", "where possible", and "generally" on a rule the author actually requires warn; keep hedges only where judgment is genuinely wanted. | all |
| C2 | Every prohibition that could leave the agent stuck names the alternative: "Don't X; do Y instead." | all |
| C3 | Facts and procedures are stated positively — "Use pnpm", or the steps in order — not as a list of things to avoid. | all |
| C4 | Instructions are concrete: they name files, commands, thresholds, and examples, not adjectives ("keep functions small" → "split functions over 50 lines"). | all |
| C5 | Non-obvious rules carry a short reason. A model applies the reason to cases the rule did not list. | all |
| C6 | The instruction does not contradict the codebase or another instruction file. When it deliberately contradicts existing code, it says so and names the migration; otherwise the code wins in practice. | all |
| C7 | Emphasis is rare. When MUST, NEVER, CRITICAL, or ALL CAPS appear on many lines, none of them stands out; warn and suggest keeping emphasis for the few rules that matter most. | all |
| C8 | Text describes the current state. Time-relative wording ("recently added", "the new flow", "we used to") and change history belong in commits, not instructions. | all |

### D. Is the file in good shape?

| ID | Check | Applies to |
|----|-------|------------|
| D1 | Size fits the budget: `always-on` ≤ 200 lines and ~3,500 tokens; `scoped` ≤ 200 lines; `agent` body ≤ 400 lines; `skill` `SKILL.md` ≤ 500 lines, with detail moved into files it points to. Up to 25% over warns; beyond that fails. `reference` has no budget, but warn when it duplicates the file that loads it. Always-on files stack — user `~/.claude/CLAUDE.md`, project `CLAUDE.md`, and unscoped rules all load together — so when grading several, also report their combined size against the same budget. | all |
| D2 | Long worked examples, templates, and code samples are not inline in always-loaded text; they live in a reference or skill file and are pointed to. | always-on, scoped, agent |
| D3 | No filler: preambles ("You are a helpful…" with no role content), restated obvious facts, empty or generic sections, or text that reads as unedited AI output. | all |
| D4 | The file name names a topic (`security.md`, `testing.md`), not a catch-all (`misc.md`, `general.md`, `notes.md`). | always-on and scoped files under `.claude/rules/` |
| D5 | Frontmatter is valid. Skills: `name` matches the directory, and `description` says what the skill does and when to trigger it, with the concrete phrases a user would type — or, for a methodology skill loaded mainly by agents or other skills, names those callers. Agents: `name` and `description` are present, the description says when to invoke the agent, and the tool list is no broader than the body needs. Scoped rules: `paths:` globs match real files. | agent, skill, scoped |
| D6 | Splits follow a clean topical seam, and each part makes sense read alone. A file cut arbitrarily ("part 2") warns. | files split across several parts |

## Step 4 — Report

Print the report in the session. For each file:

```markdown
### <path> — <type> [→ <installed path>] · <lines> lines · ~<tokens> tokens
<pass> pass · <warn> warn · <fail> fail · <n/a> n/a

| ID | Grade | Where | Issue | Fix |
|----|-------|-------|-------|-----|
| A2 | fail | L14: "Never use `--no-verify`" | Mechanically checkable and enforced by nothing | Add a PreToolUse hook that blocks `git … --no-verify`; delete the line |
| B3 (+A5) | warn | L30-32; also `agents/planner.md` L88 | Same exclusion list in two files, already drifting | Keep it in `agents/planner.md`; replace L30-32 with a pointer |

Passed: A1, A3, B1, …
```

List only `warn` and `fail` rows in the table, `fail` first. Put passes on a single `Passed:` line, and leave out `n/a` IDs.

After the per-file sections, add `## Top fixes` with at most five changes across all files, ranked by how much context or confusion each removes. Prefer deletions and moves over rewording.

End by offering to apply chosen fixes. Do not edit any file until the user picks which fixes to apply.
