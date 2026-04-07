---
description: Rebase the current PR branch onto main and force-push to keep the PR up to date
---

You are rebasing the current PR branch onto the latest `main` and force-pushing to keep the PR
in sync. Follow every step below in order. Run each command as a standalone call — do not chain
commands with `&&`, `;`, or `|`.

**Note for DM:** Steps that perform write operations (file edits, destructive git commands) must
be delegated to Bitsmith per the DM delegation policy. Those steps are marked below.

## Step 1 — Verify GitHub authentication

Run: `gh auth status`

If the command exits with a non-zero status or prints an error, abort immediately and tell the
user: "GitHub authentication is required. Run `gh auth login` and try again."

## Step 2 — Detect current branch

Run: `git branch --show-current`

Store the result as `<branch>`. You will use it in later steps.

## Step 3 — Guard against protected branches

If `<branch>` is `main`, `master`, or `develop`, abort immediately and tell the user:
"Cannot sync a protected branch. Check out your PR branch and run `/sync-pr` again."

## Step 4 — Check for an open PR

Run: `gh pr list --head <branch> --state open --json number,title --limit 1`

If the JSON array is empty, warn the user: "No open PR found for branch `<branch>`." Then ask:
"Do you want to continue anyway? (yes/no)"

If the user answers anything other than `yes`, abort without making any changes.

If a PR is found, print its number and title as confirmation before continuing.

## Step 5 — Fetch remote refs

Run: `git fetch origin`

This updates remote-tracking refs without modifying the working tree.

## Step 6 — Guard against a dirty working tree

Run: `git status --porcelain`

If the output is non-empty, abort immediately and tell the user: "Working tree is dirty. Commit
or stash your changes before syncing."

## Step 7 — Rebase onto refs/remotes/origin/main [write operation — delegate to Bitsmith]

Delegate to Bitsmith to run: `git rebase refs/remotes/origin/main`

(`refs/remotes/origin/main` is used instead of the `origin/main` shorthand to avoid resolution ambiguity when a local branch named `main` exists.)

(Per DM delegation policy, write operations must not be executed directly by the DM.)

If the rebase exits with a non-zero status (indicating conflicts or another failure), instruct
Bitsmith to run the following as a separate standalone call: `git rebase --abort`

Then abort the entire command and tell the user: "Rebase conflicts detected. The rebase has been
aborted. Resolve conflicts manually by running `git rebase refs/remotes/origin/main`, fixing each conflict, and
running `git rebase --continue`."

## Step 8 — Force-push and report success [write operation — delegate to Bitsmith]

Delegate to Bitsmith to run: `git push --force-with-lease origin <branch>`

(Per DM delegation policy, write operations must not be executed directly by the DM.)

If the push fails (e.g., lease rejected because the remote has new commits), report the error and
abort: "Force-push failed. The remote has changes not present locally. Run `git fetch origin` and
retry `/sync-pr`."

If the push succeeds, print: "Branch `<branch>` rebased on `main` and force-pushed. PR is up to date."
