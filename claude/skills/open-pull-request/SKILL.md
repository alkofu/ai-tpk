---
name: open-pull-request
description: Open PRs with conventional branch names and conventional-commit titles. Use for pull/merge requests, gh pr create / glab, or naming branches and PR titles.
---

# Open Pull Request (Conventional Branch + Conventional Title)

This skill extends the usual workflow (inspect state → branch → commit or amend → confirm all tracked work is committed → push → open PR) so **branch names** follow [Conventional Branch](https://conventional-branch.github.io/) and **PR titles** follow the same rules as [Conventional Commits](https://www.conventionalcommits.org/)—aligned with the `commit-message-guide` skill for commits.

## Workflow

1. **Inspect state**: `git status`, `git branch --show-current`, confirm remote and default branch.
2. **Branch** (if needed): If on `main`/`master`/`develop` or the user wants a new branch, create one using the naming rules below. If already on a correctly named branch, keep it.
3. **Commit**: Stage changes, then record history using the **commit-message-guide** for message text. Prefer **few commits** on the branch—see **Commit history** below. Every change that belongs in the PR must end up **committed** on this branch; uncommitted work will not appear on the PR.
4. **Pre-push (required)**: Do **not** push to upstream until **every change Git already tracks** (and every new file that should be in the PR) is committed. Run `git status`; if you see unstaged changes, staged changes waiting for a commit, or deletions not yet committed, resolve via amend, fixup, or a new commit (per **Commit history**) until there is nothing left to commit for work that should ship. Untracked files stay out until you intentionally `git add` and commit them.
5. **Push**: `git push -u origin <branch>` (or your remote/branch convention) to upstream. If you **amended or rebased** commits that were **already pushed**, use `git push --force-with-lease` instead of a plain push. The PR compares the default branch to this branch, so **all commits you pushed** are what the PR contains.
6. **Open PR (always draft, assign to the user)**:
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
