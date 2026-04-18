---
description: Rebase the current PR branch onto main and force-push to keep the PR up to date
---

You are rebasing the current PR branch onto the latest `main` and force-pushing to keep the PR
in sync. Follow every step below in order. Run each command as a standalone call — do not chain
commands with `&&`, `;`, or `|`.

**Note for DM:** Steps that perform write operations (file edits, destructive git commands) must
be delegated to Bitsmith per the DM delegation policy. Those steps are marked below.

## Step 1 — Run preflight checks

Run: `bash ~/.claude/scripts/git-preflight.sh sync-pr`

This script verifies GitHub authentication, detects the current branch, and guards against
protected branches (`main`, `master`, `develop`). On success it prints the detected branch
name to stdout.

If the script exits non-zero, propagate its stderr message to the user verbatim and abort.
Do not proceed.

On success, capture the printed branch name as `<branch>` for use in later steps.

## Step 2 — Check for an open PR

Run: `gh pr list --head <branch> --state open --json number,title --limit 1`

If the JSON array is empty, warn the user: "No open PR found for branch `<branch>`." Then ask:
"Do you want to continue anyway? (yes/no)"

If the user answers anything other than `yes`, abort without making any changes.

If a PR is found, print its number and title as confirmation before continuing.

## Step 3 — Fetch remote refs

Run: `git fetch origin`

This updates remote-tracking refs without modifying the working tree.

## Step 4 — Guard against a dirty working tree

Run: `git status --porcelain`

If the output is non-empty, abort immediately and tell the user: "Working tree is dirty. Commit
or stash your changes before syncing."

## Step 5 — Rebase onto refs/remotes/origin/main [write operation — delegate to Bitsmith]

Delegate Steps 5.1 and 5.2 to Bitsmith as a single task. Bitsmith runs the rebase and, if
conflicts occur, inline-executes `/resolve-conflicts`. Bitsmith reports back only the final
outcome (success or abort).

(`refs/remotes/origin/main` is used instead of the `origin/main` shorthand to avoid resolution ambiguity when a local branch named `main` exists.)

(Per DM delegation policy, write operations must not be executed directly by the DM.)

**Step 5.1** — Run: `git rebase refs/remotes/origin/main`

- If the rebase exits with **zero** → proceed directly to Step 6.
- If the rebase exits **non-zero** → continue to Step 5.2.

**Step 5.2** — Inline-execute the `/resolve-conflicts` protocol within the current session.
Do not spawn a separate slash command session — inline execution preserves session context
and keeps error handling within `/sync-pr`'s flow.
(This follows the same inline-execution pattern used in `/merge-pr` Step 3, which
inline-executes `/sync-pr`.)

If `/resolve-conflicts` aborts (any abort condition within its protocol), `/sync-pr` also
aborts — propagate the error message to the user without modification. Do not proceed to
Step 6.

If `/resolve-conflicts` completes successfully, proceed to Step 6.

## Step 6 — Force-push and report success [write operation — delegate to Bitsmith]

Delegate to Bitsmith to run: `git push --force-with-lease origin <branch>`

(Per DM delegation policy, write operations must not be executed directly by the DM.)

If the push fails (e.g., lease rejected because the remote has new commits), report the error and
abort: "Force-push failed. The remote has changes not present locally. Run `git fetch origin` and
retry `/sync-pr`."

If the push succeeds, print: "Branch `<branch>` rebased on `main` and force-pushed. PR is up to date."
