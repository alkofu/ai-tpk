---
description: Delete local branches whose PRs have been merged, and remove their associated worktrees
---

You are cleaning up stale local branches and their associated worktrees. Follow every step below
in order. Run each command as a standalone call — do not chain commands with `&&`, `;`, or `|`.

**Note for DM:** Steps that perform write operations (file edits, destructive git commands) must
be delegated to Bitsmith per the DM delegation policy. Those steps are marked below.

**Known limitation:** `--limit 1000` captures at most the 1000 most-recently merged PRs.
Branches from PRs merged long ago may not appear in the list and will not be cleaned up.

## Step 1 — Discover stale branches

Run `~/.claude/scripts/clean-the-desk-discover.sh` as a single Bash call.

Exit-code contract:
- **Exit 0** — discovery succeeded; parse stdout as JSON.
- **Non-zero exit** — abort immediately; the script has already printed an error message to stderr.

On success, stdout is a single-line JSON object with the following shape:

```json
{
  "branches_to_delete": ["feat/old-branch", "fix/another"],
  "worktrees_to_remove": [
    {"branch": "feat/old-branch", "path": "/abs/path/to/worktree"}
  ],
  "skipped_reasons": {
    "main": "protected",
    "feat/current": "current branch",
    "feat/closed-pr": "upstream gone (PR not in merged-list — possibly closed-without-merge)"
  }
}
```

- `.branches_to_delete` — local branches whose PR is confirmed merged and that are safe to delete.
- `.worktrees_to_remove` — worktrees that must be removed before the associated branch can be deleted. Every entry here has a matching entry in `.branches_to_delete`.
- `.skipped_reasons` — merged-list or gone-upstream branches that were excluded from cleanup, with the reason for each. Present this to the user in Step 2 if non-empty.

If both `.branches_to_delete` and `.worktrees_to_remove` are empty, print "Nothing to clean up."
and stop.

## Step 2 — Display summary and ask for confirmation

Print a clear summary derived from the JSON:
- List each worktree path that will be removed (from `.worktrees_to_remove[*].path`), if any.
- List each branch that will be deleted (from `.branches_to_delete`), if any.
- If `.skipped_reasons` is non-empty, surface it so the user understands why some branches were
  not included — for example: "Skipped: main (protected), feat/current (current branch)."

Ask the user: "Proceed with deletion? (yes/no)"

If the user answers anything other than `yes`, abort without making any changes.

## Step 3 — Remove worktrees [write operation — delegate to Bitsmith]

For each entry in `.worktrees_to_remove`, delegate to Bitsmith to run:
`git worktree remove --force {path}`

(Per DM delegation policy, write operations must not be executed directly by the DM.)

Report each removal as it completes.

## Step 4 — Delete stale branches [write operation — delegate to Bitsmith]

For each branch in `.branches_to_delete`, delegate to Bitsmith to run:
`git branch -D {branch}`

(Per DM delegation policy, write operations must not be executed directly by the DM.)

If the command fails (e.g., because the branch is still checked out somewhere), treat it as a
skip — do not treat it as a fatal error. Note the branch as skipped.

## Step 5 — Report final summary

Print a final summary with three sections:
- **Worktrees removed:** list of paths (or "none")
- **Branches deleted:** list of branch names (or "none")
- **Skipped:** list of branches that could not be deleted, with a brief reason (or "none")
