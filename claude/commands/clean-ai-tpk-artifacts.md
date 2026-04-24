---
description: Delete plan and lesson files older than N days from ~/.ai-tpk/ for the current repo (default: 14 days). Use --all to clean across all repos.
---

You are cleaning up stale artifact files from `~/.ai-tpk/`. Follow every step below in order.
All Bash commands must follow `~/.claude/references/bash-style.md`.

**Note for DM:** Steps that perform write operations (file deletions) must be delegated to
Bitsmith per the DM delegation policy. Those steps are marked below.

## Step 1 — Parse parameters

Read the user's message for:
- An optional age in days (e.g., `/clean-ai-tpk-artifacts 30`). Default: **14 days** if not specified.
- An optional `--all` flag (e.g., `/clean-ai-tpk-artifacts --all` or `/clean-ai-tpk-artifacts 30 --all`).

Store the age as `<days>` and the flag as `<all-repos>` (true/false).

## Step 2 — Derive current repo slug

Run: `git rev-parse --show-toplevel`

Take the basename of the result. Store it as `<repo-slug>`.

## Step 3 — Determine search scope

**If `<all-repos>` is false (default):**
- Plan search path: `~/.ai-tpk/plans/<repo-slug>/`
- Print: `"Searching for artifacts older than <days> days in: ~/.ai-tpk/plans/<repo-slug>/ and ~/.ai-tpk/lessons/"`

**If `<all-repos>` is true:**
- Plan search path: `~/.ai-tpk/plans/` (all repos)
- Print a warning: `"⚠️  --all flag active: searching across ALL repositories. Files from other repos may be included."`

In both cases, lesson files are always searched in `~/.ai-tpk/lessons/` (lessons are not repo-scoped).

## Step 4 — Find stale files

**If the plan search path does not exist:** skip the plan file search and treat it as zero plan files found.

Otherwise, run:
`find <plan-search-path> -type f -name "*.md" -mtime +<days>`

**If `~/.ai-tpk/lessons/` does not exist:** skip the lesson file search and treat it as zero lesson files found.

Otherwise, run:
`find ~/.ai-tpk/lessons -type f -name "*.jsonl" -mtime +<days>`

## Step 5 — Display results

Combine the results from Step 4 (plan files + lesson files). If no files are found, print:
`"No artifacts older than <days> days found."` and stop.

If files are found, display them grouped by directory:

```
The following <count> artifact file(s) are older than <days> days:

~/.ai-tpk/plans/<repo-slug>/
  - 20260315-143022-add-auth.md
  - 20260315-143022-add-auth-open-questions.md

~/.ai-tpk/lessons/
  - candidates.jsonl
```

## Step 6 — Confirm deletion

Ask the user:
`"Delete these <count> artifact file(s)? (yes/no)"`

If the user answers `no` or anything other than `yes`, print: `"Aborted. No files deleted."` and stop.

## Step 7 — Delete files [write operation — delegate to Bitsmith]

Delegate to Bitsmith to delete each file using `rm` (one `rm` call per file, run as separate
commands — do not chain). After all deletions, report:
`"Deleted <count> artifact file(s)."`
