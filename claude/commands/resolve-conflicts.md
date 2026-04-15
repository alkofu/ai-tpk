---
description: Resolve merge conflicts during an in-progress rebase
---

You are resolving merge conflicts during a rebase that has stopped due to conflicts. This
command handles conflict detection, file-by-file resolution, staging, and `rebase --continue`
cycling. Run each command as a standalone call — do not chain commands with `&&`, `;`, or `|`.

**Note for DM:** This command performs write operations (file edits, git staging, rebase
continuation). When invoked standalone, delegate execution to Bitsmith per the DM delegation
policy. When inline-executed from `/sync-pr` (or another command that has already delegated to
Bitsmith), no additional delegation is needed — Bitsmith is already the executor.

## Step 1 — Guard: verify a rebase is in progress

Run: `git rev-parse --git-dir`

Store the result as `<git-dir>`. This returns the correct git directory path whether you are
in a regular repo or a worktree.

Run: `test -d <git-dir>/rebase-merge`

If the exit code is non-zero (the directory does not exist), abort immediately and tell the
user: "No rebase in progress. Start a rebase first, then run /resolve-conflicts when conflicts
appear."

## Step 2 — Detect conflicted files

Run: `git diff --name-only --diff-filter=U`

- If the output is **empty** (no conflicted files — the rebase is paused for another reason),
  run `git rebase --abort` as a separate standalone call and abort the entire command, telling
  the user: "Rebase is paused but no conflicted files were found. The rebase has been aborted.
  Check `git status` for details."
- If the output lists **more than 10 conflicted files**, run `git rebase --abort` as a separate
  standalone call and abort the entire command, telling the user: "Too many conflicted files ({N})
  for automated resolution. The rebase has been aborted. Resolve conflicts manually."
- If the output lists between **1 and 10 conflicted files** (inclusive) → proceed to Step 3.

## Step 3 — Resolve conflicts

A "round" is defined as one attempt to resolve conflicts for the **current commit** being
rebased. The 3-round limit is **per-commit**: each time `git rebase --continue` succeeds and
moves on to the next commit (which then stops again with new conflicts), the round counter
resets to 0. A round only increments when the same commit fails to be resolved and
`git rebase --continue` exits non-zero again. The round counter also resets to 0 when a commit
is skipped via `git rebase --skip` (empty-commit case), since the next commit begins a fresh
resolution attempt.

For each conflicted file listed:

1. Read the file contents and understand the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
2. Write a resolved version that **preserves the incoming branch's changes as the primary
   intent**. In a rebase, the incoming branch's commits are being replayed onto the upstream
   branch — so the incoming branch's logic, behaviour, and scope must be kept intact. The
   resolution should do the minimum necessary to make the incoming branch's changes apply cleanly
   against what has changed upstream. Do not expand scope, introduce new behaviour, or favour the
   upstream version of a line unless the incoming version is genuinely incompatible. If in doubt,
   keep the incoming branch's change and adjust only what is structurally required by the
   conflict.
3. After writing the resolved file, scan it for remaining conflict markers (`<<<<<<<`, `=======`,
   `>>>>>>>`). If any remain, re-read and re-resolve.
   - If markers still persist in the same file after a second attempt, run `git rebase --abort`
     as a separate standalone call and abort the entire command, telling the user: "Unable to
     resolve all conflict markers in `<file>`. The rebase has been aborted. Resolve conflicts
     manually."
4. Stage each resolved file (confirmed marker-free) with a separate standalone call:
   `git add <file>`

*Note: In PR rebase contexts (e.g., when invoked from `/sync-pr`), "incoming branch" refers to
the PR's branch and "upstream" refers to `main`.*

## Step 4 — Continue rebase

Run: `GIT_EDITOR=true git rebase --continue`

(The `GIT_EDITOR=true` env var skips the editor prompt for the commit message.)

- If `git rebase --continue` reports that the resulting commit is **empty**, run
  `git rebase --skip` as a separate standalone call (to skip the now-empty commit). Then check
  whether the rebase is still in progress:
  - Run: `git rev-parse --git-dir` to get the git directory path. Store the result as `<git-dir>`.
  - Run: `test -d <git-dir>/rebase-merge`
  - If the directory **does not exist** (exit non-zero) → the rebase is complete. Print
    "Conflicts resolved. Rebase completed successfully." and return control to the caller (or
    exit cleanly if invoked standalone).
  - If the directory **still exists** (exit zero) → the rebase is still in progress (more
    commits to replay). Reset the per-commit round counter to 0. Run
    `git diff --name-only --diff-filter=U` as a separate standalone call to check for conflicts
    in the next commit:
    - If conflicted files are listed → return to Step 3 for the next commit.
    - If no conflicted files are listed → proceed to run `GIT_EDITOR=true git rebase --continue`
      again (continuing with the normal Step 4 exit-code handling for the next commit).
- If `git rebase --continue` exits with **zero** → print "Conflicts resolved. Rebase completed
  successfully." and return control to the caller (or exit cleanly if invoked standalone).
- If `git rebase --continue` exits **non-zero** → run `git diff --name-only --diff-filter=U`
  as a separate standalone call.
  - If the output is **empty** (no conflicted files), run `git rebase --abort` as a separate
    standalone call and abort the entire command, telling the user: "Rebase failed during
    `--continue` for a reason other than merge conflicts. The rebase has been aborted. Check
    `git status` for details."
  - If there are still conflicted files and fewer than 3 rounds have been attempted for this
    commit → return to Step 3 for another resolution round (incrementing the per-commit round
    counter).
  - If 3 rounds have been attempted for this commit without success → run `git rebase --abort`
    as a separate standalone call and abort the entire command, telling the user: "Unable to
    fully resolve the rebase conflicts after 3 attempts on the same commit. The rebase has been
    aborted. Resolve conflicts manually by running your rebase command again, fixing each
    conflict, and running `git rebase --continue`."
