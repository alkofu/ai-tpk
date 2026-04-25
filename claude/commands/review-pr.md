---
description: Run the local Ruinor + specialist review pipeline against a GitHub PR (review-only; no comments are posted)
---

You are running the local review pipeline against a GitHub pull request. Follow every step below in
order. All Bash commands must follow `~/.claude/references/bash-style.md`.

**Conventions:**
- This command does NOT post anything to GitHub. v1 is review-only; posting is deferred to a future `/review-pr-post` command.
- **Cross-repo scope (v1):** `/review-pr` only supports PRs in the current repository (identified by `git rev-parse --show-toplevel` from the invoking session). Cross-repo usage is deferred.
- **DM direct vs Bitsmith:** Read-only `gh` and `git` calls are executed by DM directly. The two helper scripts (`pr-review-setup.sh`, `pr-review-cleanup.sh`) are also DM direct — no Bitsmith involvement at any point in worktree setup or cleanup.
- **Review scratch space:** The temp worktree is ephemeral — cleanup unconditionally force-removes it at the end of the command, regardless of dirty state. Do not edit files in the temp worktree expecting changes to persist.
- **Constitution handling:** DM's existing Project Constitution Injection automatically prepends the constitution from the invoking repo's tree into every Ruinor delegation. Do NOT manually inject the constitution and do NOT read the constitution from the temp worktree's tree.

## Step 1 — Parse `$ARGUMENTS` (single-pass)

Split `$ARGUMENTS` into whitespace-separated tokens. This is the only place `$ARGUMENTS` is parsed.

**Extract flag tokens first:** Any token beginning with `--` is a flag. Validate each flag against
the canonical set: `--review-security`, `--review-performance`, `--review-complexity`,
`--verify-facts`, `--review-all`. Any unrecognized `--`-prefixed token is an error — surface a
clear "unknown flag" message listing the canonical set above, then abort.

**Extract the PR identifier:** The first non-flag token is the PR number or URL. If more than one
non-flag token is present, surface a "too many positional arguments" error and abort.

Accept either a numeric PR number (e.g., `123`) or a full PR URL — extract the trailing integer
from the `/pull/<number>` segment. Validate that the extracted value is a positive integer; if not,
abort with a clear message. If no non-flag token is present, ask: "Which PR number or URL should I
review?" Abort if no answer is provided.

Capture as `<pr-number>` (positive integer) and `<flag-specialists>` (the validated specialist flags).

## Step 2 — Validate the PR exists and capture metadata [DM direct, read-only]

```
gh pr view <pr-number> --json number,title,state,headRefName,baseRefName,url,body
```

On non-zero exit, surface the stderr to the user verbatim and abort. Capture:
`<pr-title>`, `<pr-state>`, `<head-ref>`, `<base-ref>`, `<pr-url>`, `<pr-body>`.

If `<pr-state>` is `MERGED` or `CLOSED`, warn: "PR #`<pr-number>` is `<pr-state>`. The review will
reflect the PR's HEAD as it stood at last push, which may not match the base branch anymore." Ask:
"Proceed anyway? (yes/no)" — abort on anything other than `yes`.

## Step 3 — Setup: create temp worktree and list changed files [DM direct]

```
~/.claude/scripts/pr-review-setup.sh <pr-number>
```

The script creates a session-namespaced temp worktree per Project Constitution Principle 1 (two
concurrent invocations cannot collide). Do NOT overwrite `WORKTREE_PATH` or `WORKTREE_BRANCH` in
conversation memory — those belong to the enclosing session worktree.

Exit codes: 0 = success, 1 = git/safety error, 2 = arg error. On non-zero exit, surface stderr
verbatim and abort. The script self-cleans orphan worktrees on failure — do not invoke Step 6
(Cleanup) in this case.

Capture from JSON output: `<session-ts>`, `<repo-root>`, `<temp-branch>`, `<temp-worktree-path>`,
`<changed-files-relative>` (relative paths array), `<changed-files-absolute>` (worktree-absolute paths array).

If `<changed-files-relative>` is an empty array:
1. Print: "PR #`<pr-number>` has no file changes — nothing to review."
2. Proceed directly to Step 6 (Cleanup).
3. After cleanup, print the minimal summary:
   - **PR header:** `PR #<pr-number> — <pr-title>` and `<pr-url>`
   - **Files reviewed:** "(none — PR has no file changes)"
   - **Ruinor's verdict and findings:** "not invoked — no files to review"
   - **Specialist verdicts and findings:** "not invoked"
   - **Aggregate verdict:** ACCEPT
   - **Footer:** "Review complete. No comments were posted to GitHub. To post comments, use the GitHub web UI or wait for a future /review-pr-post command."

## Step 4 — Invoke Ruinor (mandatory baseline)

Delegate to Ruinor with:
- **(a) Worktree-absolute file paths:** Pass `<changed-files-absolute>` directly. Ruinor does not receive a `WORKING_DIRECTORY` block.
- **(b) PR context:** `PR #<pr-number> — <pr-title> — <pr-url>`, and a note that this is a PR review, not a plan review.
- **(c) Constitution:** Accept DM's existing Project Constitution Injection — do NOT manually inject anything from `<temp-worktree-path>/.claude/constitution.md` and do NOT read that file.

Capture Ruinor's verdict, full findings body, and "Specialist Review Recommended" field.

## Step 5 — Determine and invoke specialists

**Inputs already captured (do not re-parse `$ARGUMENTS`):** `<flag-specialists>` from Step 1; `<changed-files-absolute>` and `<pr-body>` from the setup script output (Step 3).

**Precedence (cite, do not redefine):** Apply the triggering logic from `~/.claude/agents/dungeonmaster.md` Phase 2 / Phase 4 and `~/.claude/references/specialist-triggering.md`:
- User flags (`<flag-specialists>`) are honored unconditionally.
- Ruinor's "Specialist Review Recommended" field is honored when no user flag selects a specialist.
- The keyword fallback fires only when neither user flags nor Ruinor recommendations have selected any specialist.

`--review-all` expands to all four specialist agents: Riskmancer, Windwarden, Knotcutter,
Truthhammer. These flags do NOT skip Ruinor — Ruinor is always invoked (Step 4).

**Keyword-fallback input substrate (unique to `/review-pr`):** Use PR title + `<pr-body>` + file
paths in `<changed-files-relative>`. Diff content is excluded intentionally.

Compute the union: `<flag-specialists>` ∪ Ruinor's recommended specialists ∪ (keyword-fallback
specialists IFF both prior sets are empty). If non-empty, invoke each specialist in parallel,
passing the same worktree-absolute file paths and PR context as passed to Ruinor in Step 4. Capture
each specialist's verdict and full findings body. If empty, skip this step entirely.

## Step 6 — Cleanup [DM direct]

```
~/.claude/scripts/pr-review-cleanup.sh <temp-worktree-path> <repo-root> <temp-branch>
```

Runs unconditionally — on the success path, on no-changes exit, and on review failure paths. Do NOT
invoke after a Step 3 failure — the setup script self-cleans on error. Always runs before the
summary is printed. The script exits 0 always; any sub-command failures are surfaced to its stderr
but never block the summary.

## Step 7 — Consolidated summary

Print a consolidated review report inline. Do NOT delegate further, enter Phase 4, or trigger
DM's normal review-revise loop. The summary IS the outcome.

**PR header:**

```
PR #<pr-number> — <pr-title>
<pr-url>
```

**Files reviewed:** List all paths from `<changed-files-relative>`.

**Ruinor's verdict and findings:** Print Ruinor's full response body — do not summarize.

**Specialist verdicts and findings:** For each specialist invoked in Step 5, print their full
response body — do not summarize. If no specialists were invoked, note "No specialists invoked."

**Aggregate verdict** (four-case precedence table):
1. **REJECT** — if any reviewer issued a `REJECT` verdict.
2. Else **REVISE** — if any reviewer issued a `REVISE` verdict with CRITICAL, MAJOR, or HIGH
   severity findings. (Truthhammer CRITICAL and HIGH count; MEDIUM and LOW do not.) A `REVISE`
   with only MINOR findings is downgraded to ACCEPT-WITH-RESERVATIONS.
3. Else **ACCEPT-WITH-RESERVATIONS** — if any reviewer issued an `ACCEPT-WITH-RESERVATIONS` verdict.
4. Else **ACCEPT** — all reviewers issued plain `ACCEPT`.

**Footer:** "Review complete. No comments were posted to GitHub. To post comments, use the GitHub
web UI or wait for a future /review-pr-post command."
