---
name: open-pull-request
description: REQUIRED for all pull requests. Always use when opening PRs, creating merge requests, or executing gh pr create / glab mr create commands. Enforces conventional branch names and conventional-commit PR titles.
TRIGGER: user asks to open/create a PR or MR, mentions pushing and opening a PR, references gh/glab commands, or discusses pull request workflow.
DO NOT SKIP: applies to all PR creation regardless of repository or context.
---

# Open Pull Request (Conventional Branch + Conventional Title)

This skill extends the usual workflow (inspect state → branch → commit or amend → confirm all tracked work is committed → push → open PR) so **branch names** follow [Conventional Branch](https://conventional-branch.github.io/) and **PR titles** follow the same rules as [Conventional Commits](https://www.conventionalcommits.org/)—aligned with the `commit-message-guide` skill for commits.

## IMPORTANT: When This Skill Applies

This skill is **mandatory** for:
- Any request to open, create, or draft a pull request or merge request
- Commands like `gh pr create`, `glab mr create`, or GitLab/GitHub UI PR creation
- Workflows involving "push and open PR" or "create PR from branch"
- Branch naming when the branch will be used for a PR

**Do not** create PRs through other means or skip this workflow.

## Non-Negotiable Requirements

Every PR must:
1. Use conventional branch naming (`<type>/<description>`)
2. Have a conventional commit title (`<type>(<scope>): <subject>`)
3. Be opened as `--draft` (unless explicitly requested otherwise)
4. Be assigned to `@me` (the user)
5. Have all changes committed before push

## Workflow

1. **Check existing PR status**: Before starting work, check if the current branch already has an open or merged PR associated with it.
   - **GitHub**: `gh pr list --head $(git branch --show-current)` to check for open PRs, and `gh pr list --head $(git branch --show-current) --state merged` for merged PRs.
   - **GitLab**: `glab mr list --source-branch $(git branch --show-current)` for open MRs, and `glab mr list --source-branch $(git branch --show-current) --state merged` for merged MRs.
   - **If a PR/MR exists** (open or merged): This branch has already been used. **Do not** add new commits to it. Instead:
     - Stash any uncommitted changes: `git stash`
     - Switch to the main branch: `git checkout main` (or `master`/`develop` as appropriate)
     - Fetch latest changes: `git pull origin main` (or appropriate remote/branch)
     - Proceed to step 2 to create a new branch for the new work
   - **If no PR/MR exists**: Continue to step 2.

2. **Inspect state**: `git status`, `git branch --show-current`, confirm remote and default branch.

3. **Branch** (if needed): If on `main`/`master`/`develop` or the user wants a new branch, create one using the naming rules below. If already on a correctly named branch (with no existing PR per step 1), keep it.

4. **Commit**: Stage changes, then record history using the **commit-message-guide** for message text. Prefer **few commits** on the branch—see **Commit history** below. Every change that belongs in the PR must end up **committed** on this branch; uncommitted work will not appear on the PR.

5. **Pre-push (required)**: Do **not** push to upstream until **every change Git already tracks** (and every new file that should be in the PR) is committed. Run `git status`; if you see unstaged changes, staged changes waiting for a commit, or deletions not yet committed, resolve via amend, fixup, or a new commit (per **Commit history**) until there is nothing left to commit for work that should ship. Untracked files stay out until you intentionally `git add` and commit them.

6. **Sync with main**: Fetch remote refs, guard against a dirty working tree, and rebase the branch onto the latest `refs/remotes/origin/main` before pushing. Run each command as a standalone Bash call — do not chain with `&&` or `;`. Pipes are permitted only for data transformation.

   **6a. Fetch remote refs**

   Run: `git fetch origin`

   This updates remote-tracking refs without modifying the working tree.

   **6b. Guard against a dirty working tree**

   Run: `git status --porcelain`

   If the output is non-empty, stop and tell the user: "Working tree is dirty. Commit or stash your changes before syncing." (At this point in the workflow, changes should already be committed per step 5 — this is a safety net.)

   **6c. Rebase onto `refs/remotes/origin/main`**

   `refs/remotes/origin/main` is used instead of the `origin/main` shorthand to avoid resolution ambiguity when a local branch named `main` exists.

   **6c.1** — Run: `git rebase refs/remotes/origin/main`

   - If the rebase exits with **zero** → proceed to step 7 (Push).
   - If the rebase exits **non-zero** → continue to 6c.2.

   **6c.2** — Run: `git diff --name-only --diff-filter=U`

   - If the output is **empty** (no conflicted files — this is a different rebase error): run `git rebase --abort` as a standalone call, stop, and tell the user: "Rebase failed for a reason other than merge conflicts. The rebase has been aborted. Check `git status` for details."
   - If the output lists **more than 10 conflicted files**: run `git rebase --abort` as a standalone call, stop, and tell the user: "Too many conflicted files ({N}) for automated resolution. The rebase has been aborted. Resolve conflicts manually."
   - If the output lists between **1 and 10 conflicted files** (inclusive) → continue to 6c.3.

   **6c.3 — Resolve conflicts**

   A "round" is defined as one attempt to resolve conflicts for the **current commit** being rebased. The 3-round limit is **per-commit**: each time `git rebase --continue` succeeds and moves on to the next commit (which then stops again with new conflicts), the round counter resets to 0. A round only increments when the same commit fails to be resolved and `git rebase --continue` exits non-zero again.

   For each conflicted file listed:

   1. Read the file contents and understand the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
   2. Write a resolved version that **preserves the PR's original changes as the primary intent**. In a rebase, the PR's commits are being replayed onto main — so the PR's logic, behaviour, and scope must be kept intact. The resolution should do the minimum necessary to make the PR's changes apply cleanly against what has changed in main. Do not expand the PR's scope, introduce new behaviour, or favour main's version of a line unless the PR's version is genuinely incompatible. If in doubt, keep the PR's change and adjust only what is structurally required by the conflict.
   3. After writing the resolved file, scan it for remaining conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`). If any remain, re-read and re-resolve.
      - If markers still persist in the same file after a second attempt, run `git rebase --abort` as a standalone call and stop: "Unable to resolve all conflict markers in `{file}`. The rebase has been aborted. Resolve conflicts manually."
   4. Stage each resolved file (confirmed marker-free) with a separate standalone call: `git add {file}`

   **6c.4** — After all conflicted files are staged, run: `GIT_EDITOR=true git rebase --continue`

   (The `GIT_EDITOR=true` env var skips the editor prompt for the commit message.)

   - If `git rebase --continue` reports that the resulting commit is **empty**: run `git rebase --skip` as a standalone call (to skip the now-empty commit) and treat this as a successful continue — proceed to step 7 (Push).
   - If `git rebase --continue` exits with **zero** → print "Conflicts resolved. Rebase completed successfully." and proceed to step 7 (Push).
   - If `git rebase --continue` exits **non-zero** → run `git diff --name-only --diff-filter=U` as a standalone call.
     - If the output is **empty** (no conflicted files): run `git rebase --abort` as a standalone call and stop: "Rebase failed during `--continue` for a reason other than merge conflicts. The rebase has been aborted."
     - If there are still conflicted files and **fewer than 3 rounds** have been attempted for this commit → return to 6c.3 (incrementing the per-commit round counter).
     - If **3 rounds** have been attempted for this commit without success → run `git rebase --abort` as a standalone call and stop: "Unable to fully resolve rebase conflicts after 3 attempts. The rebase has been aborted. Resolve manually by running `git rebase refs/remotes/origin/main`, fixing each conflict, and running `git rebase --continue`."

   **6d. Re-validate if conflicts were resolved**

   If any conflicts were resolved during sub-steps 6c.3–6c.4 (i.e., the rebase did not complete cleanly in 6c.1), re-run the `validate-before-pr` skill before proceeding to step 7 (Push). Conflict resolution can modify file contents in ways that introduce lint or formatting violations that the earlier validation already cleared.

   If `validate-before-pr` fails on re-run, stop — do not push or open a PR. Report the failures and request fixes.

7. **Push**: `git push -u origin <branch>` (or your remote/branch convention) to upstream. If you **amended or rebased** commits that were **already pushed**, use `git push --force-with-lease` instead of a plain push. The PR compares the default branch to this branch, so **all commits you pushed** are what the PR contains.

8. **Open PR (always draft, assign to the user)**:
   - **GitHub**: `gh pr create --draft --assignee @me --title "..." --body "..."`
     Use `@me` so the PR is **assigned to the person opening it** (the user’s GitHub account). Adjust only if the repo uses a different assignee rule.
   - **GitLab**: `glab mr create --draft --assignee @me` (or your login) with the same title/body rules; use the web UI only if you mirror draft + assignee there.

Never omit `--draft` unless the user explicitly asks for a ready-for-review PR.

## Commit history (keep the count small)

Prefer to **update existing commits** instead of stacking more, so the PR stays easy to review.

- **`git commit --amend`**: Use when the new work **belongs with the latest commit** (same intent, same type/scope, follow-up edits, typo fixes, small adjustments). Amend updates that commit in place; adjust the message if the title line no longer fits.
- **New commit**: Add only when the change is **logically separate** or has a **different scope** (`type`/`scope` in the subject) than any commit already on the branch—so history stays one commit per coherent slice of work, not one commit per save.
- **`git commit --fixup=<commit>`** (and later **`git rebase -i --autosquash <upstream>`**): Use to attach tweaks to an **earlier** commit on the branch without rewriting the message by hand—Git lines up fixups to squash into the right parent. Typical flow: make fixup commits, then rebase onto the branch base with autosquash so fixups fold in.

After rewriting history that was already on the remote, push with **`--force-with-lease`** so you do not overwrite others’ work blindly.

## PR title (must match Conventional Commits)

Use the **same format as** `commit-message-guide` **first line**:

```
<type>(<scope>): <subject>
```

- **Types**: `feat`, `fix`, `refactor`, `perf`, `style`, `test`, `docs`, `build`, `ci`, `chore`
- **Scope**: optional; module or area (`api`, `auth`, `ui`, …)
- **Subject**: imperative, lowercase after the colon, no trailing period, ~50 chars ideal (72 max)

**Default**: Set the PR title to the **subject line of the primary commit** on the branch (the one that best describes the whole change). With a lean history (amend/fixup), this is often a **single** commit; if several commits remain, pick one title that summarizes the branch without contradicting them, or tighten history first.

Examples:

- `feat(auth): add oauth callback handler`
- `fix(api): handle empty pagination cursor`
- `chore(deps): bump eslint to 9.x`

Avoid: vague titles (`Updates`, `Fix stuff`), past tense (`Added login`), or titles that only list filenames.

## Branch names (Conventional Branch)

Structure:

```
<type-prefix>/<description>
```

**Prefixes** (pick one synonym where alternatives exist and stay consistent with the repo):

| Purpose | Prefix |
|--------|--------|
| New functionality | `feat/` or `feature/` |
| Bug fix | `fix/` or `bugfix/` |
| Urgent production fix | `hotfix/` |
| Release prep | `release/` (e.g. `release/v1.2.0`) |
| Maintenance, deps, docs-only, tooling | `chore/` |

**Description segment** (after `/`):

- Lowercase `a-z`, digits `0-9`, **hyphens** `-` between words
- For release branches, **dots** are allowed in version segments (e.g. `release/v1.2.0`)
- No underscores, spaces, or consecutive/leading/trailing hyphens or dots
- Optional ticket id: `feat/jira-123-add-export`

**Mapping from commit type → branch prefix** (when creating a branch from intent):

| Commit / work type | Typical branch prefix |
|--------------------|-------------------------|
| `feat` | `feat/` or `feature/` |
| `fix` | `fix/` or `bugfix/` (use `hotfix/` if urgent) |
| `perf` | `feat/` or `fix/` depending on whether it reads as enhancement vs correction |
| `docs`, `build`, `ci`, `chore`, `style`, `test` | `chore/` |
| `refactor` | `chore/` unless the change is user-visible, then `feat/` |

Examples:

- `feat/user-profile-settings`
- `fix/null-guard-in-parser`
- `chore/update-playwright`
- `release/v2.0.0`

Optional **team prefix** (only if the repository already uses it): `username/feat/foo` or `team/fix/bar`. Do not invent a prefix unless the project standard requires it.

## PR description

Keep it short (2–5 sentences), **impact-first**: problem solved, user or system benefit, notable risks or rollout notes. Do not mirror the file list; that is visible in the PR UI. Match the tone of `commit-message-guide` bodies: explain *why* when the title is not enough; omit noise (test pass claims, AI attribution, line counts).

## Examples (end-to-end)

After push, open with draft + assignee, e.g. `gh pr create --draft --assignee @me --title "feat(reports): add csv export for quarterly view" --body "..."`.

**Feature**

- Branch: `feat/export-csv`
- Commit / PR title: `feat(reports): add csv export for quarterly view`

**Bugfix**

- Branch: `fix/chart-tooltip-position`
- Commit / PR title: `fix(ui): correct tooltip placement near viewport edge`

**Chore**

- Branch: `chore/bump-axios`
- Commit / PR title: `chore(deps): bump axios to 1.7.x`

## Pre-flight checklist

- [ ] **GitHub account and commit author**: Verified per the account probe in `claude/references/github-auth-probe.md` (extract `{owner}/{repo}`, probe with `gh api`, switch accounts if needed, verify commit author email)
- [ ] **Branch has no existing PR**: Verified that the current branch has no open or merged PR—if one exists, switched to main, fetched latest, and created a new branch
- [ ] **Before push**: all tracked changes (and intended new files) are **committed**—`git status` shows nothing that still needs committing for work going into the PR
- [ ] **Synced with main**: Fetched origin, rebased onto `refs/remotes/origin/main`; if conflicts were resolved, `validate-before-pr` was re-run and passed
- [ ] History is **compact**: prefer `--amend` / `--fixup` + autosquash; new commits only when scope or topic differs
- [ ] Branch matches `<prefix>/<description>` and Conventional Branch character rules
- [ ] PR title is a conventional commit subject line (and matches the main commit when single-commit)
- [ ] PR body adds context, not a file inventory
- [ ] PR is opened as a **draft** and **assigned to the user** (`@me` or equivalent)
- [ ] No AI/tool attribution in title or body

## Relationship to other skills

- **Commits**: Follow **commit-message-guide** for message bodies and footers. It also documents **WIP** and **fixup!** subject lines—pair fixup commits with `git rebase -i --autosquash` to merge them into the target commit.
- **Sync with main**: Step 6 fetches remote refs and rebases the branch onto `refs/remotes/origin/main` with automated conflict resolution before pushing. The rebase logic is inlined from `sync-pr` semantics — no separate `sync-branch-to-main` skill exists. The `/sync-pr` command performs the same rebase logic independently for post-PR-creation syncing. If conflicts were resolved during the rebase, `validate-before-pr` is re-run before proceeding to push.
- **MCP / automation**: Skills named like “open-pull-request” on catalogs (e.g. [MCP Market](https://mcpmarket.com/tools/skills/open-pull-request)) usually wrap the same steps; this document defines **naming** and **titles** so any tool or CLI you use stays consistent.
