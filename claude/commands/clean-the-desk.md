---
description: Delete local branches whose PRs have been merged, and remove their associated worktrees
---

You are cleaning up stale local branches and their associated worktrees. Follow every step below
in order. Run each command as a standalone call — do not chain commands with `&&`, `;`, or `|`.

**Note for DM:** Steps that perform write operations (file edits, destructive git commands) must
be delegated to Bitsmith per the DM delegation policy. Those steps are marked below.

**Known limitation:** `--limit 1000` captures at most the 1000 most-recently merged PRs.
Branches from PRs merged long ago may not appear in the list and will not be cleaned up.

## Step 1 — Verify GitHub authentication

Run: `gh auth status`

If the command exits with a non-zero status or prints an error, abort immediately and tell the
user: "GitHub authentication is required. Run `gh auth login` and try again."

## Step 2 — Fetch remote-tracking refs

Run: `git fetch origin`

This updates remote-tracking refs without modifying the working tree.

## Step 3 — Collect merged PR branch names

Run: `gh pr list --state merged --json headRefName --limit 1000`

Parse the JSON response. Extract the `headRefName` value from each object into a list of merged
branch names. These are already short names (e.g., `feat/my-feature`) — no stripping needed.

## Step 4 — Collect local branch names

Run: `git branch --format='%(refname:short)'`

This produces one short branch name per line.

## Step 5 — Collect worktree path-to-branch mapping

Run: `git worktree list --porcelain`

Parse the output to build a map from worktree path to branch name. Each worktree entry begins
with a `worktree` line (the path) followed later by a `branch` line. Strip the `refs/heads/`
prefix from the branch value. This map is used in Step 7 to find worktrees associated with
stale branches.

## Step 6 — Identify stale branches

A branch is stale if it meets ALL of the following:
- It exists in the local branch list (Step 4)
- Its name appears in the merged PR branch list (Step 3)
- Its name is NOT `main` or `master`

## Step 7 — Find associated worktrees

Using the porcelain output from Step 5, map each stale branch to its worktree path (if any).
A worktree entry has a `worktree` line (the path) followed later by a `branch` line. Collect
every worktree path whose branch matches a stale branch.

## Step 8 — Display summary and ask for confirmation

Print a clear summary:
- List each worktree path that will be removed (if any)
- List each branch that will be deleted (if any)
- If both lists are empty, tell the user "Nothing to clean up." and stop.

Ask the user: "Proceed with deletion? (yes/no)"

If the user answers anything other than `yes`, abort without making any changes.

## Step 9 — Remove worktrees [write operation — delegate to Bitsmith]

For each worktree path identified in Step 7, delegate to Bitsmith to run:
`git worktree remove --force {path}`

(Per DM delegation policy, write operations must not be executed directly by the DM.)

Report each removal as it completes.

## Step 10 — Delete stale branches [write operation — delegate to Bitsmith]

For each stale branch, delegate to Bitsmith to run:
`git branch -D {branch}`

(Per DM delegation policy, write operations must not be executed directly by the DM.)

If the command fails (e.g., because the branch is still checked out somewhere), treat it as a
skip — do not treat it as a fatal error. Note the branch as skipped.

## Step 11 — Report final summary

Print a final summary with three sections:
- **Worktrees removed:** list of paths (or "none")
- **Branches deleted:** list of branch names (or "none")
- **Skipped:** list of branches that could not be deleted, with a brief reason (or "none")
