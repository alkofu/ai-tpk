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

6. **Push**: `git push -u origin <branch>` (or your remote/branch convention) to upstream. If you **amended or rebased** commits that were **already pushed**, use `git push --force-with-lease` instead of a plain push. The PR compares the default branch to this branch, so **all commits you pushed** are what the PR contains.

7. **Open PR (always draft, assign to the user)**:
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

- [ ] **Branch has no existing PR**: Verified that the current branch has no open or merged PR—if one exists, switched to main, fetched latest, and created a new branch
- [ ] **Before push**: all tracked changes (and intended new files) are **committed**—`git status` shows nothing that still needs committing for work going into the PR
- [ ] History is **compact**: prefer `--amend` / `--fixup` + autosquash; new commits only when scope or topic differs
- [ ] Branch matches `<prefix>/<description>` and Conventional Branch character rules
- [ ] PR title is a conventional commit subject line (and matches the main commit when single-commit)
- [ ] PR body adds context, not a file inventory
- [ ] PR is opened as a **draft** and **assigned to the user** (`@me` or equivalent)
- [ ] No AI/tool attribution in title or body

## Relationship to other skills

- **Commits**: Follow **commit-message-guide** for message bodies and footers. It also documents **WIP** and **fixup!** subject lines—pair fixup commits with `git rebase -i --autosquash` to merge them into the target commit.
- **MCP / automation**: Skills named like “open-pull-request” on catalogs (e.g. [MCP Market](https://mcpmarket.com/tools/skills/open-pull-request)) usually wrap the same steps; this document defines **naming** and **titles** so any tool or CLI you use stays consistent.
