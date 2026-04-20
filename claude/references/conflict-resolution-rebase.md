# Conflict-Resolution Rebase — Shared Reference

This file defines the canonical procedure for resolving merge conflicts during a
`git rebase` that has stopped due to conflicts. It is the authoritative source for
this algorithm. Consumers (skills, commands) reference this file and supply their
own context mapping.

**Term definitions used throughout this file:**

- **Incoming branch** — the branch whose commits are being replayed (i.e., the branch
  you are rebasing).
- **Upstream** — the branch the rebase is replaying the incoming branch's commits onto.

Consumers map their own context to these terms. For example, in the `open-pull-request`
skill, "incoming branch" is the PR's branch and "upstream" is `main`. In the standalone
`/resolve-conflicts` command, "incoming branch" is whatever branch is currently being
rebased and "upstream" is whatever branch the rebase is replaying onto.

---

## Detect Conflicted Files

Run: `git diff --name-only --diff-filter=U`

Evaluate the output:

- If the output is **empty** (no conflicted files — the rebase is paused for another
  reason): run `git rebase --abort` as a standalone call and abort, telling the user:
  "Rebase failed for a reason other than merge conflicts. The rebase has been aborted.
  Check `git status` for details."
- If the output lists **more than 10 conflicted files**: run `git rebase --abort` as a
  standalone call and abort, telling the user: "Too many conflicted files ({N}) for
  automated resolution. The rebase has been aborted. Resolve conflicts manually."
- If the output lists between **1 and 10 conflicted files** (inclusive): proceed to
  "Resolve Conflicts (Per Round)" below.

---

## Resolve Conflicts (Per Round)

A **round** is one attempt to resolve conflicts for the **current commit** being rebased.
The 3-round limit is **per-commit**. The round counter resets to 0 in two cases:

1. When `git rebase --continue` succeeds and the rebase moves on to the next commit
   (which then stops again with new conflicts).
2. When a commit is skipped via `git rebase --skip` (the empty-commit case), since the
   next commit begins a fresh resolution attempt.

A round only increments when the same commit fails to resolve and
`git rebase --continue` exits non-zero again.

For each conflicted file listed:

1. Read the file contents and understand the conflict markers (`<<<<<<<`, `=======`,
   `>>>>>>>`).
2. Write a resolved version that **preserves the incoming branch's changes as the primary
   intent**. In a rebase, the incoming branch's commits are being replayed onto the
   upstream — so the incoming branch's logic, behaviour, and scope must be kept intact.
   The resolution should do the minimum necessary to make the incoming branch's changes
   apply cleanly against what has changed upstream. Do not expand scope, introduce new
   behaviour, or favour the upstream version of a line unless the incoming version is
   genuinely incompatible. If in doubt, keep the incoming branch's change and adjust only
   what is structurally required by the conflict.
3. After writing the resolved file, scan it for remaining conflict markers (`<<<<<<<`,
   `=======`, `>>>>>>>`). If any remain, re-read and re-resolve.
   - If markers still persist in the same file after a second attempt: run
     `git rebase --abort` as a standalone call and abort, telling the user: "Unable to
     resolve all conflict markers in `{file}`. The rebase has been aborted. Resolve
     conflicts manually."
4. Stage each resolved file (confirmed marker-free) with a separate standalone call:
   `git add {file}`

After all conflicted files are staged, proceed to "Continue the Rebase" below.

---

## Continue the Rebase

Run: `GIT_EDITOR=true git rebase --continue`

(The `GIT_EDITOR=true` env var skips the editor prompt for the commit message.)

Handle three exit conditions:

### Empty commit reported

Run `git rebase --skip` as a standalone call (to skip the now-empty commit). Then check
whether the rebase is still in progress:

Run: `git rev-parse --git-dir`

Store the result as `<git-dir>`.

Run: `test -d <git-dir>/rebase-merge`

- If the directory **does not exist** (exit non-zero) → the rebase is complete. The
  consumer's wrapper decides what to do next (print a success message and exit, or
  proceed to the next wrapper step).
- If the directory **still exists** (exit zero) → the rebase has more commits to replay.
  Reset the per-commit round counter to 0. Run
  `git diff --name-only --diff-filter=U` as a standalone call to check for conflicts in
  the next commit:
  - If conflicted files are listed → return to "Resolve Conflicts (Per Round)" for the
    next commit.
  - If no conflicted files are listed → run `GIT_EDITOR=true git rebase --continue`
    again as a standalone call, applying the same three exit-condition handling defined in
    this section.

### Exit code zero (non-empty commit, success)

Check whether the rebase is still in progress:

Run: `git rev-parse --git-dir`

Store the result as `<git-dir>`.

Run: `test -d <git-dir>/rebase-merge`

- If the directory **does not exist** (exit non-zero) → the rebase is complete. The
  consumer decides what to do next.
- If the directory **still exists** (exit zero) → the rebase has more commits to replay.
  Reset the per-commit round counter to 0. Run
  `git diff --name-only --diff-filter=U` as a standalone call to check for conflicts in
  the next commit:
  - If conflicted files are listed → return to "Resolve Conflicts (Per Round)" for the
    next commit.
  - If no conflicted files are listed → run `GIT_EDITOR=true git rebase --continue`
    again as a standalone call, applying the same three exit-condition handling defined in
    this section.

### Exit code non-zero

Run: `git diff --name-only --diff-filter=U`

- If the output is **empty** (no conflicted files): run `git rebase --abort` as a
  standalone call and abort, telling the user: "Rebase failed during `--continue` for a
  reason other than merge conflicts. The rebase has been aborted. Check `git status` for
  details."
- If conflicted files are listed and **fewer than 3 rounds** have been attempted for this
  commit → return to "Resolve Conflicts (Per Round)", incrementing the per-commit round
  counter.
- If **3 rounds** have been attempted for this commit without success → run
  `git rebase --abort` as a standalone call and abort, telling the user: "Unable to fully
  resolve the rebase conflicts after 3 attempts on the same commit. The rebase has been
  aborted. Resolve conflicts manually."

---

## Consumer Responsibilities

Consumers of this reference are responsible for:

1. **Pre-conditions.** The standalone `/resolve-conflicts` command guards that a rebase is
   already in progress before entering this algorithm. The `open-pull-request` skill
   invokes `git rebase` itself in its preceding sub-step (6c.1), so the rebase is always
   in progress when this reference is entered.
2. **Terminal actions.** At the algorithm's terminal success points (the rebase is
   complete), the consumer decides what to do next — for example: print a success message
   and exit (standalone command), re-run `validate-before-pr` and then push (SKILL), or
   return control to a calling command (inline invocation from `/sync-pr`).
3. **Abort propagation.** When this algorithm reports an abort, the consumer propagates
   the abort message to the user and stops — it does not proceed to any subsequent step.

All Bash commands in this reference follow the repo bash-style rules: no `&&` or `;`
chaining, no process substitution, no `$(...)` command substitution in commit commands.
Pipes are permitted only for data transformation per `claude/references/bash-style.md`.
The `<git-dir>` notation is a documentation placeholder — store the actual value returned
by `git rev-parse --git-dir` and use it in the subsequent `test -d` call.
