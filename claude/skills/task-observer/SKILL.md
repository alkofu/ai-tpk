---
name: task-observer
description: >
  Capture lightweight observations about friction, surprises, or repeated mistakes during a
  Claude Code session, so they can be reviewed later and turned into skill improvements. Use
  whenever you notice a pattern worth remembering — confusing instructions in a skill, a
  workaround you had to invent, a step that should be automated, or behaviour that contradicted
  a skill's guidance. Always log when you correct yourself or the user corrects you on something
  a skill should have prevented.
---

# Task-Observer Skill

## Purpose

This skill captures small, structured observations during a session so that recurring friction
surfaces during a later review and can be turned into skill improvements. It does **not** modify
skills directly — that happens in the `/review-observations` workflow, with explicit user approval
on a literal diff.

## When to log

- You hit friction caused by an instruction in a skill that was unclear, contradictory, or missing.
- You worked around something a skill should have handled.
- You or the user noticed the same problem you noticed before.
- A skill's guidance contradicted what actually worked.
- You corrected yourself, or the user corrected you, on something a skill could have prevented.

## When NOT to log

- The same observation has already been written this session — do not write a near-duplicate.
- The friction was a one-off typo or a trivially recoverable mistake with no structural cause.
- The trigger is normal exploratory back-and-forth (clarifying questions, refinement, scope
  changes) rather than a structural skill issue.

## Confidentiality

**Layer 1 — Hard mechanical block (must run before every write).** Before writing the
observation, scan the proposed body. If it contains any of the following literal substrings,
abort the write and ask the user how to proceed: `AKIA`, `ASIA`, `Bearer` (followed by a
space), `-----BEGIN` (followed by a space), `ghp_`, `ghs_`, `gho_`, `xoxb-`, `xoxp-`, `xoxo-`,
`xoxa-`. Also abort
if the proposed body contains a line that appears to be quoted from a `.env*` file referenced
or read in the current session.

**Layer 2 — Judgement rule.** If you are uncertain whether something belongs in an observation
file — secrets, personal information, internal project details, customer data, internal
codenames — ask the user before writing it. The mechanical block above does not catch
everything; this rule is the catch-all.

**Known security limitations.** Layer 1's prefix list is non-exhaustive: Google API keys,
JWTs, and high-entropy blobs may pass through undetected. The audit log is not tamper-evident.
Concurrent `/review-observations` sessions are not locked. Audit observation files before
running `/review-observations` if this matters to you.

**Sync/backup note.** `~/.claude/observations/` is commonly included in Time Machine, Dropbox,
iCloud Drive, or Syncthing backups. Add it to your backup-exclude list if you care about this.

## Where to write

Write each observation to `~/.claude/observations/YYYY-MM-DD-HHMMSS-<pid>-<slug>.md`. The
wall-clock timestamp orders observations; the `<pid>` (the writer's process id) satisfies the
session-isolation invariant by ensuring two parallel sessions cannot collide even within the
same second.

Shell derivation:
- Timestamp: `date +%Y-%m-%d-%H%M%S`
- PID: `$$`
- Slug: a short kebab-case noun phrase you generate

**Slug constraint.** The slug must match `[a-z0-9-]{1,40}` — lowercase ASCII letters, digits,
and hyphens only. No slashes, no `..`, no spaces, no shell metacharacters. Sanitize before
writing if needed.

**Write protocol.** Write to `~/.claude/observations/.tmp-$$-<slug>` first, then `mv` to the
final filename. This guarantees readers never see a half-written file.

**Directory bootstrap.** If `~/.claude/observations/` does not yet exist, run
`mkdir -p ~/.claude/observations` before writing.

**Size cap.** Keep the observation body under ~2 KB. If you have more to say, you are choosing
the wrong granularity — split into multiple narrower observations or defer.

**Count cap.** Before writing, check `ls ~/.claude/observations/*.md 2>/dev/null | wc -l`. If
the count exceeds 50, do not write — instead tell the user: "There are over 50 pending
observations; run `/review-observations` to clear the backlog before logging more."

## Observation format

All five fields go in YAML frontmatter. No body sections. Example:

```markdown
---
timestamp: 2026-04-28T21:31:43Z
trigger: <one-line summary of what prompted the observation>
affected_skill: <skill name, or "none" if not skill-specific>
what_happened: <one short paragraph>
proposed_fix: <one short paragraph, or "unclear — flag for discussion">
---
```

Five fields total, all in frontmatter. This gives the slash command a single parsing approach.
Anything outside the frontmatter is ignored.

## Reviewing observations

When you're ready to turn observations into skill improvements, run `/review-observations`.
That command groups observations by affected skill, proposes concrete edits as literal unified
diffs, and waits for your approval before changing anything. Pending observations stay until
you run the command — there is no automatic notification, so run it weekly or after long
sessions.

## Optional reference

For recurring patterns observed across past reviews, see
`~/.claude/references/task-observer-guide.md` (advisory only).
