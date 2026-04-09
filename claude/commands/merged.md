---
description: Clean up the worktree and local branch for a PR that has been merged, then land on a fresh main
---

You are cleaning up after a merged pull request. This command discovers which worktree and
branch to remove, then performs the cleanup (prompting only when multiple candidates are
found). Follow every step below
in order. Run each command as a standalone call — do not chain commands with `&&`, `;`, or `|`.

**Note for DM:** Steps that perform write operations (destructive git commands) must be
delegated to Bitsmith per the DM delegation policy. Those steps are marked below.

## Step 0 — Check session context

Before running any discovery logic, check whether `WORKTREE_PATH` and `WORKTREE_BRANCH` are
both present in the current session context (i.e., you already know them from the active
worktree session).

**If both are set:**
Print: `"Using session context: <WORKTREE_PATH> (<WORKTREE_BRANCH>)"`
Set `<worktree-path>` to `WORKTREE_PATH` and `<branch>` to `WORKTREE_BRANCH`. Proceed through
Steps 1 and 2 (to identify `<main-path>` and verify the worktree exists), then skip directly
to Step 6.

**If not both set:**
Proceed to Step 1 (full discovery flow).

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

**If arriving from Step 0 (session-context path):** Verify that `<worktree-path>` appears
as a worktree path in the porcelain output. If it does not, tell the user: "Session context
worktree not found in `git worktree list` output. Aborting." and stop. If it does, proceed
to Step 6.

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

## Step 4 — Check for remote-gone signal

Run: `git fetch --prune`

This is a non-destructive network operation that updates remote tracking refs and prunes
refs for branches deleted on the remote. It modifies local tracking refs but not local
branches or the working tree. No Bitsmith delegation is required.

If `git fetch --prune` fails (e.g., network error, authentication failure), warn the user
that remote-gone detection is unavailable and fall through to Step 5 (the manual picker).

Run: `git branch -vv`

Parse the output for lines whose tracking-ref information contains `: gone]` — for example,
a line like `  fix/my-branch  abc1234 [origin/fix/my-branch: gone] commit message` indicates
that `origin/fix/my-branch` was deleted on the remote.

Cross-reference the gone branches with the candidate list from Step 3. A candidate matches
if its branch name equals the local branch name shown in a gone line. Candidates with
`(detached HEAD)` as their branch cannot match and are ignored in this cross-reference.

**If exactly one candidate has a `[gone]` upstream:**
Auto-select it. Print: `"Identified merged branch via remote deletion: <branch> at <path>. Proceeding with cleanup."`
Store the candidate's path as `<worktree-path>` and branch as `<branch>`, then proceed to Step 6.

**If zero or multiple candidates have `[gone]` upstream:**
Fall through to Step 5 (the manual picker).

## Step 5 — Branch on candidate count

**If zero candidates:**
Tell the user: "No worktrees found to clean up." Stop here — do not continue to later steps.

**If exactly one candidate:**
Print the candidate's path and branch name.
Store the candidate's path as `<worktree-path>` and branch as `<branch>`.

**If multiple candidates:**
Print a numbered list of all candidates (path and branch for each). Ask the user:
"Multiple worktrees found. Which one was merged? Enter the number, or 'none' to abort."

If the user answers `none` or provides an invalid selection, abort without making any changes.

Store the selected candidate's path as `<worktree-path>` and branch as `<branch>`.

## Step 6 — Change to the main repo directory

Before any destructive operations, change the working directory to `<main-path>` (from
Step 2). This is critical: if the current shell is inside `<worktree-path>`, removing that
worktree will destroy the cwd and cause all subsequent commands to fail.

All remaining steps (7 through 10) must execute with `<main-path>` as the working directory.

## Step 7 — Remove the worktree [write operation — delegate to Bitsmith]

Delegate to Bitsmith to run (from `<main-path>`): `git worktree remove --force <worktree-path>`

The `--force` flag is used because the PR is already merged — any uncommitted local changes
in the worktree are expendable.

(Per DM delegation policy, write operations must not be executed directly by the DM.)

If the command fails, report the error to the user and abort. Do not continue to later steps.

## Step 8 — Delete the local branch [write operation — delegate to Bitsmith]

**If `<branch>` is `(detached HEAD)`:** Skip this step entirely. There is no branch to delete.
Print: "Skipping branch deletion — worktree was in detached HEAD state."

**Otherwise:** Delegate to Bitsmith to run (from `<main-path>`): `git branch -D <branch>`

(Per DM delegation policy, write operations must not be executed directly by the DM.)

If the command fails (e.g., the branch was already deleted or does not exist locally), report
the failure as a warning but do not abort — continue to Step 9.

## Step 9 — Checkout main [write operation — delegate to Bitsmith]

Delegate to Bitsmith to run (from `<main-path>`): `git checkout main`

(Per DM delegation policy, write operations must not be executed directly by the DM.)

If this fails, report the error and abort.

## Step 10 — Pull latest from origin [write operation — delegate to Bitsmith]

Delegate to Bitsmith to run (from `<main-path>`): `git pull origin main`

(Per DM delegation policy, write operations must not be executed directly by the DM.)

If this fails, report the error but do not treat it as fatal — the local checkout is already
on `main`.

## Step 11 — Report final summary

Print a summary:
- **Worktree removed:** `<worktree-path>`
- **Branch deleted:** `<branch>` (or "skipped — detached HEAD" or "skipped — see warning above" if Step 8 was skipped or failed)
- **Current branch:** main (up to date)
