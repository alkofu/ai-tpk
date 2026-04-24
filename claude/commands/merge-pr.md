---
description: Sync the current PR branch with main, wait for CI checks, squash-merge, and chain into /merged cleanup
---

You are squash-merging the current PR branch after ensuring it is in sync with `main` and all
required CI checks have passed. Follow every step below in order. All Bash commands must follow
`~/.claude/references/bash-style.md`.

**Note for DM:** Steps that perform write operations (destructive git commands, merge operations)
must be delegated to Bitsmith per the DM delegation policy. Those steps are marked below.

## Step 1 — Run preflight checks

Run: `bash ~/.claude/scripts/git-preflight.sh merge-pr`

This script verifies GitHub authentication, detects the current branch, and guards against
protected branches (`main`, `master`, `develop`). On success it prints the detected branch
name to stdout.

If the script exits non-zero, propagate its stderr message to the user verbatim and abort.
Do not proceed.

On success, capture the printed branch name as `<branch>` for use in later steps.

## Step 2 — Find the open PR

Run: `gh pr view --json number,title,mergeStateStatus`

If the command exits with a non-zero status (no PR found for this branch), abort immediately
and tell the user: "No open PR found for branch `<branch>`. Open a PR first with `/open-pr`."

If a PR is found, print its number and title as confirmation before continuing. Store the
parsed fields for use in later steps: `<pr-number>`, `<mergeStateStatus>`.

## Step 3 — Check sync status and sync if needed

Inspect `<mergeStateStatus>` from Step 2 and handle each value as follows:

- **`BEHIND` or `DIRTY`:** The branch needs to be rebased onto main before merging.
  Print: "Branch is behind main. Running /sync-pr to rebase."
  Inline-execute the `/sync-pr` protocol within the current session — do not spawn a
  separate slash command session, as inline execution preserves session context and
  keeps error handling within `/merge-pr`'s flow.
  If `/sync-pr` fails (rebase conflict it cannot resolve, force-push failure, or any other
  error), abort `/merge-pr` with the error reported by `/sync-pr`. Do not proceed.
  After `/sync-pr` succeeds, re-run: `gh pr view --json mergeStateStatus` to refresh
  the status. If the result is still not one of `CLEAN`, `UNSTABLE`, or `HAS_HOOKS`,
  abort with: "Branch is still not in a mergeable state after sync (status:
  `<mergeStateStatus>`). Investigate manually."

- **`DRAFT`:** Abort immediately. Tell the user: "This PR is a draft and cannot be merged.
  Mark it as ready for review first."

- **`BLOCKED`:** Abort immediately. Tell the user: "PR is blocked by branch protection rules
  (status: BLOCKED). Resolve the blocking conditions and try again."

- **`UNKNOWN` or any unrecognised value:** Warn but continue. Tell the user: "Merge state
  status is `<mergeStateStatus>` — proceeding with caution."

- **`CLEAN`, `UNSTABLE`, or `HAS_HOOKS`:** Proceed to Step 4. All three are mergeable
  states. `UNSTABLE` means some non-required checks are failing but the PR is still
  mergeable. `HAS_HOOKS` means the PR is mergeable with passing commit status and
  pre-receive hooks configured (GitHub Enterprise). Both are semantically equivalent to
  `CLEAN` for merge-readiness purposes.

## Step 4 — Wait for required CI checks to pass

Run: `gh pr checks <pr-number> --watch --fail-fast --required`

This command blocks until all required checks complete. `--fail-fast` exits as soon as any
required check fails to avoid unnecessary wait time. `--required` restricts watching to
required checks only — this is intentional, because `UNSTABLE` (non-required checks failing)
is treated as a proceed state in Step 3, so non-required check failures must not cause an
abort here.

Interpret the exit code:

- **Exit 0:** All required checks passed. Print: "All required CI checks passed." Proceed
  to Step 5.

- **Exit 1 (check failure):** At least one required check failed. Run:
  `gh pr checks <pr-number> --required --json name,state,bucket`
  Filter the result for entries where `bucket` is `fail`. Print each failed check's name
  and state. Abort with: "Required CI checks failed. Fix the failing checks and run
  `/merge-pr` again."

- **Exit 8 (watch interrupted or checks still pending):** Abort with: "CI check watch was
  interrupted or checks are still pending. Run `/merge-pr` again to resume watching."

- **Any other non-zero exit:** Abort with: "Unexpected error while checking CI status
  (exit code: `<code>`). Run `gh pr checks` manually to investigate."

## Step 5 — Squash-merge the PR [write operation — delegate to Bitsmith]

Delegate to Bitsmith to run: `gh pr merge <pr-number> --squash --delete-branch`

`--delete-branch` deletes the remote branch after merge. The local branch and worktree are
cleaned up by `/merged` in Step 6.

(Per DM delegation policy, write operations must not be executed directly by the DM.)

Interpret the result:

- **Exit 0 (success):** Print: "PR #`<pr-number>` squash-merged successfully." Proceed to
  Step 6.

- **Non-zero exit (failure):** Report the full error output to the user. Common failure
  modes include:
  - "Pull request is not mergeable" — branch protection or required reviews not met.
  - "GraphQL: ... was not merged" — merge conflict detected server-side.
  Abort with: "Merge failed. Resolve the issue above and run `/merge-pr` again."
  Do not proceed to Step 6.

## Step 6 — Chain into /merged cleanup

Print: "Merge complete. Proceeding to post-merge cleanup (/merged)."

**Worktree context propagation:** If `WORKTREE_PATH` and `WORKTREE_BRANCH` are both present
in the current session context (i.e., this `/merge-pr` invocation is running inside a
worktree session), both values are already available to `/merged`, which allows it to take
its Step 0 shortcut (session-context path) instead of running the full discovery flow
(Steps 1–5 of `/merged`). If no worktree session context is available (e.g., bare branch
checkout without a worktree), do not synthesize these values — let `/merged` run its normal
discovery flow.

**PR metadata propagation for Template D:** Before executing `/merged`, record the following
values in session memory so that `/merged` can populate Template D's conditional fields:
- `MERGED_PR_NUMBER` — the PR number from Step 2
- `MERGED_PR_TITLE` — the PR title from Step 2
- `MERGE_METHOD: squash`

When `/merged` runs, it checks for `MERGED_PR_NUMBER` in session memory. If present, it
includes the `PR` and `Merge method` lines in Template D using these values. If absent
(standalone `/merged` run), those lines are omitted entirely.

Execute `/merged`. The `/merged` command handles: worktree removal, local branch deletion,
checkout of main, pull latest, and session plan file cleanup. No additional cleanup is needed
in this command.

If `/merged` encounters errors, its own error handling will report them. Do not wrap
`/merged` in additional error handling — let its protocol govern its own abort conditions.
