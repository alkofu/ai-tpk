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

Delegate Steps 7.1 through 7.4 to Bitsmith as a single task. Bitsmith owns the conflict
resolution loop and reports back only the final outcome (success or abort).

(`refs/remotes/origin/main` is used instead of the `origin/main` shorthand to avoid resolution ambiguity when a local branch named `main` exists.)

(Per DM delegation policy, write operations must not be executed directly by the DM.)

**Step 7.1** — Run: `git rebase refs/remotes/origin/main`

- If the rebase exits with **zero** → proceed directly to Step 8.
- If the rebase exits **non-zero** → continue to Step 7.2.

**Step 7.2** — Run: `git diff --name-only --diff-filter=U`

- If the output is **empty** (no conflicted files — this is a different rebase error), run
  `git rebase --abort` as a separate standalone call and abort the entire command, telling the
  user: "Rebase failed for a reason other than merge conflicts. The rebase has been aborted.
  Check `git status` for details."
- If the output lists **more than 10 conflicted files**, run `git rebase --abort` as a separate
  standalone call and abort the entire command, telling the user: "Too many conflicted files ({N})
  for automated resolution. The rebase has been aborted. Resolve conflicts manually."
- If the output lists between 1 and 10 conflicted files (inclusive) → continue to Step 7.3.

**Step 7.3 — Resolve conflicts**

A "round" is defined as one attempt to resolve conflicts for the **current commit** being rebased.
The 3-round limit is **per-commit**: each time `git rebase --continue` succeeds and moves on to
the next commit (which then stops again with new conflicts), the round counter resets to 0. A
round only increments when the same commit fails to be resolved and `git rebase --continue` exits
non-zero again.

For each conflicted file listed:

1. Read the file contents and understand the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
2. Write a resolved version that **preserves the PR's original changes as the primary intent**.
   In a rebase, the PR's commits are being replayed onto main — so the PR's logic, behaviour,
   and scope must be kept intact. The resolution should do the minimum necessary to make the
   PR's changes apply cleanly against what has changed in main. Do not expand the PR's scope,
   introduce new behaviour, or favour main's version of a line unless the PR's version is
   genuinely incompatible. If in doubt, keep the PR's change and adjust only what is
   structurally required by the conflict.
3. After writing the resolved file, scan it for remaining conflict markers (`<<<<<<<`, `=======`,
   `>>>>>>>`). If any remain, re-read and re-resolve.
   - If markers still persist in the same file after a second attempt, run `git rebase --abort`
     as a separate standalone call and abort the entire command, telling the user: "Bitsmith was
     unable to resolve all conflict markers in `<file>`. The rebase has been aborted. Resolve
     conflicts manually."
4. Stage each resolved file (confirmed marker-free) with a separate standalone call:
   `git add <file>`

**Step 7.4** — After all conflicted files are staged, run:
`GIT_EDITOR=true git rebase --continue`

(The `GIT_EDITOR=true` env var skips the editor prompt for the commit message.)

- If `git rebase --continue` reports that the resulting commit is **empty**, run `git rebase --skip`
  as a separate standalone call (to skip the now-empty commit) and treat this as a successful
  continue — proceed to Step 8.
- If `git rebase --continue` exits with **zero** → print "Conflicts resolved by Bitsmith. Rebase
  completed successfully." and proceed to Step 8.
- If `git rebase --continue` exits **non-zero** → run `git diff --name-only --diff-filter=U` as
  a separate standalone call.
  - If the output is **empty** (no conflicted files), run `git rebase --abort` as a separate
    standalone call and abort the entire command, telling the user: "Rebase failed during
    `--continue` for a reason other than merge conflicts. The rebase has been aborted. Check
    `git status` for details."
  - If there are still conflicted files and fewer than 3 rounds have been attempted for this
    commit → return to Step 7.3 for another resolution round (incrementing the per-commit
    round counter).
  - If 3 rounds have been attempted for this commit without success → run `git rebase --abort`
    as a separate standalone call and abort the entire command, telling the user: "Bitsmith was
    unable to fully resolve the rebase conflicts after 3 attempts on the same commit. The rebase
    has been aborted. Resolve conflicts manually by running `git rebase refs/remotes/origin/main`,
    fixing each conflict, and running `git rebase --continue`."

## Step 8 — Force-push and report success [write operation — delegate to Bitsmith]

Delegate to Bitsmith to run: `git push --force-with-lease origin <branch>`

(Per DM delegation policy, write operations must not be executed directly by the DM.)

If the push fails (e.g., lease rejected because the remote has new commits), report the error and
abort: "Force-push failed. The remote has changes not present locally. Run `git fetch origin` and
retry `/sync-pr`."

If the push succeeds, print: "Branch `<branch>` rebased on `main` and force-pushed. PR is up to date."
