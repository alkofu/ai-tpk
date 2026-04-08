---
description: Clean up the worktree and local branch for a PR that has been merged, then land on a fresh main
---

You are cleaning up after a merged pull request. This command discovers which worktree and
branch to remove, confirms with the user, then performs the cleanup. Follow every step below
in order. Run each command as a standalone call — do not chain commands with `&&`, `;`, or `|`.

**Note for DM:** Steps that perform write operations (destructive git commands) must be
delegated to Bitsmith per the DM delegation policy. Those steps are marked below.

## Step 1 — Enumerate all worktrees

Run: `git worktree list --porcelain`

Parse the porcelain output. The output consists of blocks separated by blank lines. Each
block starts with a `worktree <path>` line, followed by a `HEAD <sha>` line, and then
either a `branch refs/heads/<name>` line or the word `detached`. Some blocks may also
contain a `prunable` line.

## Step 2 — Identify the main worktree

The **first block** in the porcelain output is always the main worktree, regardless of
which directory the command is invoked from. Extract its path as `<main-path>`.

Do **not** use `git rev-parse --show-toplevel` for this purpose — it returns the worktree
path when run from inside a worktree, which would produce incorrect results.

## Step 3 — Build the candidate list

From the remaining blocks (all blocks after the first), build a list of cleanup candidates
by applying these filters in order:

1. **Skip prunable entries.** If a block contains a `prunable` line, exclude it entirely.
   These are stale entries, often belonging to a different repository.

2. **Skip cross-repo worktrees.** If the worktree path does not start with `<main-path>/`,
   exclude it. This ensures only worktrees belonging to this repository are candidates.

3. **Parse branch name.** If the block has a `branch refs/heads/<name>` line, strip the
   `refs/heads/` prefix and store `<name>` as the branch. If the block has `detached`
   instead of a `branch` line, store the branch as `(detached HEAD)`.

Each candidate entry contains a path and a branch name (or `(detached HEAD)`).

## Step 4 — Branch on candidate count

**If zero candidates:**
Tell the user: "No worktrees found to clean up." Stop here — do not continue to later steps.

**If exactly one candidate:**
Print the candidate's path and branch name. Ask the user:
"This worktree looks like it belongs to your merged PR. Remove it? (yes/no)"

If the user answers anything other than `yes`, abort without making any changes.

**If multiple candidates:**
Print a numbered list of all candidates (path and branch for each). Ask the user:
"Multiple worktrees found. Which one was merged? Enter the number, or 'none' to abort."

If the user answers `none` or provides an invalid selection, abort without making any changes.

Store the selected candidate's path as `<worktree-path>` and branch as `<branch>`.

## Step 5 — Change to the main repo directory

Before any destructive operations, change the working directory to `<main-path>` (from
Step 2). This is critical: if the current shell is inside `<worktree-path>`, removing that
worktree will destroy the cwd and cause all subsequent commands to fail.

All remaining steps (6 through 9) must execute with `<main-path>` as the working directory.

## Step 6 — Remove the worktree [write operation — delegate to Bitsmith]

Delegate to Bitsmith to run (from `<main-path>`): `git worktree remove --force <worktree-path>`

The `--force` flag is used because the PR is already merged — any uncommitted local changes
in the worktree are expendable.

(Per DM delegation policy, write operations must not be executed directly by the DM.)

If the command fails, report the error to the user and abort. Do not continue to later steps.

## Step 7 — Delete the local branch [write operation — delegate to Bitsmith]

**If `<branch>` is `(detached HEAD)`:** Skip this step entirely. There is no branch to delete.
Print: "Skipping branch deletion — worktree was in detached HEAD state."

**Otherwise:** Delegate to Bitsmith to run (from `<main-path>`): `git branch -D <branch>`

(Per DM delegation policy, write operations must not be executed directly by the DM.)

If the command fails (e.g., the branch was already deleted or does not exist locally), report
the failure as a warning but do not abort — continue to Step 8.

## Step 8 — Checkout main [write operation — delegate to Bitsmith]

Delegate to Bitsmith to run (from `<main-path>`): `git checkout main`

(Per DM delegation policy, write operations must not be executed directly by the DM.)

If this fails, report the error and abort.

## Step 9 — Pull latest from origin [write operation — delegate to Bitsmith]

Delegate to Bitsmith to run (from `<main-path>`): `git pull origin main`

(Per DM delegation policy, write operations must not be executed directly by the DM.)

If this fails, report the error but do not treat it as fatal — the local checkout is already
on `main`.

## Step 10 — Report final summary

Print a summary:
- **Worktree removed:** `<worktree-path>`
- **Branch deleted:** `<branch>` (or "skipped — detached HEAD" or "skipped — see warning above" if Step 7 was skipped or failed)
- **Current branch:** main (up to date)
