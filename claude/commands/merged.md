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
Step 1 (to identify `<main-path>` and verify the worktree exists), then skip directly
to Step 2.

**If not both set:**
Proceed to Step 1 (full discovery flow).

## Step 1 — Discover candidates

Run `~/.claude/scripts/merged-discover.sh` as a single Bash call. The script:
- Runs `git fetch --prune` and records success/failure.
- Captures `git worktree list --porcelain` and parses it in pure bash.
- Identifies the main worktree path (the first block in the porcelain output — **not**
  `git rev-parse --show-toplevel`, which returns the wrong value from inside a worktree).
- Builds the list of non-prunable worktrees whose paths start with `<main-path>/`.
- Detects gone-upstream branches using `git for-each-ref` plumbing internally (not
  `git branch -vv` — that format is undocumented and unstable).
- Computes `candidates`: the subset of worktree branches whose upstream is gone.
- Emits a single-line JSON object to stdout:

```json
{
  "main_path": "<absolute-path>",
  "fetch_ok": true,
  "worktrees": [
    { "path": "<absolute-path>", "branch": "<branch-name>" }
  ],
  "gone_branches": ["<branch-name>"],
  "candidates": ["<branch-name>"]
}
```

Extract `<main-path>` from `.main_path`.

**If arriving from Step 0 (session-context path):** Verify that `WORKTREE_PATH` appears
in the discovery output's `worktrees[*].path` list. If it does not, tell the user:
"Session context worktree not found in `git worktree list` output. Aborting." and stop.
If it does, proceed to Step 2.

**If `.fetch_ok` is `false`:** Warn the user that remote-gone detection is unavailable.
Then proceed with the branching rules below using whatever `candidates` the script produced
(which may be empty if the fetch failed).

**Branching on candidates and worktrees:**

- **If `.candidates | length == 1`:** Auto-select that branch. Find its worktree path by
  looking up the matching entry in `.worktrees[*]` where `.branch == candidates[0]`.
  Print: `"Identified merged branch via remote deletion: <branch> at <path>. Proceeding with cleanup."`
  Store as `<worktree-path>` and `<branch>`. Proceed to Step 2.

- **If `.candidates | length == 0` and `.worktrees | length == 0`:**
  Print: "No worktrees found to clean up." Stop here — do not continue to later steps.

- **If `.candidates | length == 0` and `.worktrees | length >= 1`:**
  Present the full `.worktrees` array as a numbered list (path and branch for each).
  Ask the user: "Multiple worktrees found. Which one was merged? Enter the number, or 'none' to abort."
  If the user answers `none` or provides an invalid selection, abort without making any changes.
  Store the selected candidate's path as `<worktree-path>` and branch as `<branch>`.

- **If `.candidates | length > 1`:**
  Present those candidates as a numbered list (branch name for each; look up the path
  from `.worktrees`).
  Ask the user: "Multiple worktrees found. Which one was merged? Enter the number, or 'none' to abort."
  If the user answers `none` or provides an invalid selection, abort without making any changes.
  Store the selected candidate's path as `<worktree-path>` and branch as `<branch>`.

## Step 2 — Change to the main repo directory

Before any destructive operations, change the working directory to `<main-path>` (from
Step 1). This is critical: if the current shell is inside `<worktree-path>`, removing that
worktree will destroy the cwd and cause all subsequent commands to fail.

All remaining steps (3 through 6) must execute with `<main-path>` as the working directory.

## Step 3 — Remove the worktree [write operation — delegate to Bitsmith]

Delegate to Bitsmith to run (from `<main-path>`): `git worktree remove --force <worktree-path>`

The `--force` flag is used because the PR is already merged — any uncommitted local changes
in the worktree are expendable.

(Per DM delegation policy, write operations must not be executed directly by the DM.)

If the command fails, report the error to the user and abort. Do not continue to later steps.

## Step 4 — Delete the local branch [write operation — delegate to Bitsmith]

**If `<branch>` is `(detached HEAD)`:** Skip this step entirely. There is no branch to delete.
Print: "Skipping branch deletion — worktree was in detached HEAD state."

**Otherwise:** Delegate to Bitsmith to run (from `<main-path>`): `git branch -D <branch>`

(Per DM delegation policy, write operations must not be executed directly by the DM.)

If the command fails (e.g., the branch was already deleted or does not exist locally), report
the failure as a warning but do not abort — continue to Step 5.

## Step 5 — Checkout main [write operation — delegate to Bitsmith]

Delegate to Bitsmith to run (from `<main-path>`): `git checkout main`

(Per DM delegation policy, write operations must not be executed directly by the DM.)

If this fails, report the error and abort.

## Step 6 — Pull latest from origin [write operation — delegate to Bitsmith]

Delegate to Bitsmith to run (from `<main-path>`): `git pull origin main`

(Per DM delegation policy, write operations must not be executed directly by the DM.)

If this fails, report the error but do not treat it as fatal — the local checkout is already
on `main`.

## Step 6a — Auto-clean session plan files

Check whether `SESSION_TS` is present in your conversation memory.

**If SESSION_TS is not available** (e.g., `/merged` was run in a new session without
worktree context): Skip this step silently. Do not list, prompt about, or delete any
plan files. Do not run `git rev-parse`, `ls`, or any other command. Proceed to Step 7.

**If SESSION_TS is available:**

Derive the current repo slug by running: `git rev-parse --show-toplevel`
Take the basename of the result. Store it as `<repo-slug>`.

List files matching the session timestamp in the plan directory:
`ls -1 ~/.ai-tpk/plans/<repo-slug>/{SESSION_TS}-* 2>/dev/null`

If no files match (command produces no output or the directory does not exist), skip
this step silently and proceed to Step 7.

If matching files exist, delegate to Bitsmith to delete each file using `rm` (one call
per file, not chained). Do not prompt the user. Do not mention or touch any files that
do not match `{SESSION_TS}-*`.

Store the list of deleted file names for use in Step 7's summary.

(Per DM delegation policy, file deletions must be delegated to Bitsmith.)

## Step 7 — Report final summary

Format the summary using Template D (Post-Merge Cleanup) from `claude/references/completion-templates.md`.

Populate the fields as follows:
- **PR** and **Merge method:** Include these lines only when `MERGED_PR_NUMBER` is present in session context (i.e., `/merged` was chained from `/merge-pr`). Omit both lines when `/merged` is run standalone.
- **Worktree removed:** `<worktree-path>`, or "N/A" if no worktree was found.
- **Branch deleted:** `<branch>`, or "skipped (detached HEAD)" if Step 4 was skipped, or "skipped (see warning)" if Step 4 failed.
- **Current branch:** main (up to date)
- **Plan files cleaned:** the list of deleted file names from Step 6a, or "none" if Step 6a found no files, or "skipped (no SESSION_TS)" if Step 6a was skipped entirely.
- **Token usage:** Derive the current repo slug as in Step 6a. Then run (single Bash call):

  ```
  ls -t ~/.ai-tpk/logs/<repo-slug>/talekeeper-*.jsonl 2>/dev/null | head -n1 | xargs -I{} jq -rs '[.[] | select(has("input_tokens"))] | reduce .[] as $r ({input:0,output:0,cw:0,cr:0}; .input += ($r.input_tokens // 0) | .output += ($r.output_tokens // 0) | .cw += ($r.cache_creation_input_tokens // 0) | .cr += ($r.cache_read_input_tokens // 0)) | "\(.input/1000 | floor)k in / \(.output/1000 | floor)k out / \(.cw/1000 | floor)k cache-write / \(.cr/1000 | floor)k cache-read"' {}
  ```

  The pipeline (a) lists chronicle files for the repo by modification time, (b) selects the most recent, (c) feeds it to `jq -rs` which slurps all newline-delimited JSON records into a single array, filters to records that have an `input_tokens` key (token record fields are flat top-level keys — not nested under a `usage` object), reduces the four token fields, and formats the totals. If no chronicle file is found or `jq` exits non-zero, the pipeline produces empty output — report "unavailable".
