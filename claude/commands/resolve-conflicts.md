---
description: Resolve merge conflicts during an in-progress rebase
---

You are resolving merge conflicts during a rebase that has stopped due to conflicts. This
command handles conflict detection, file-by-file resolution, staging, and `rebase --continue`
cycling. All Bash commands must follow `~/.claude/references/bash-style.md`.

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

## Step 2 — Resolve conflicts and complete the rebase

Apply the procedure in `claude/references/conflict-resolution-rebase.md`. In this command's
context, "incoming branch" is the branch currently being rebased and "upstream" is whatever
branch the rebase is replaying onto — these are not necessarily a PR branch and `main`. The
reference handles detection, resolution, the `git rebase --continue` cycle, all abort cases,
the per-commit 3-round limit, the empty-commit `--skip` handling including the post-`--skip`
rebase-still-in-progress check, and the inner cycling between commits.

When the reference reports the rebase is complete (no `<git-dir>/rebase-merge` directory after
the final `--continue` or `--skip`), print *"Conflicts resolved. Rebase completed
successfully."* and exit (or return control to the caller for the inline-from-`/sync-pr`
case). When the reference reports an abort, propagate the abort message to the user and exit.
