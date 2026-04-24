---
description: Run the local Ruinor + specialist review pipeline against a GitHub PR (review-only; no comments are posted)
---

You are running the local review pipeline against a GitHub pull request. Follow every step below
in order. Run each command as a standalone call — do not chain commands with `&&`, `;`, or `|`.

**Conventions:**
- This command does NOT post anything to GitHub. v1 is review-only; posting is deferred to a future `/review-pr-post` command.
- **Cross-repo scope (v1):** `/review-pr` only supports PRs in the current repository (identified by `git rev-parse --show-toplevel` from the invoking session). Cross-repo usage is deferred.
- **DM direct vs Bitsmith:** Read-only `gh` and `git` calls (e.g., `gh pr view`, `gh pr diff`, `git rev-parse`) are executed by DM directly, matching the convention in `/sync-pr` Step 2 and `/address-pr-comments`. Only operations explicitly marked `[write operation — delegate to Bitsmith]` are routed through Bitsmith.
- **Review scratch space:** The temp worktree created by this command is ephemeral. Its contract is that any local edits inside it are review scratch space, not user work — cleanup unconditionally force-removes the worktree at the end of the command, regardless of dirty state. Do not edit files in the temp worktree expecting changes to persist.
- **Constitution handling:** DM's existing Project Constitution Injection automatically prepends the constitution from the invoking repo's tree into every Ruinor delegation. `/review-pr` reviews the PR against the invoking session's repo standards, not the PR's own tree. This command does NOT manually inject the constitution and does NOT read the constitution from the temp worktree's tree.

## Step 1 — Parse `$ARGUMENTS` (single-pass)

Split `$ARGUMENTS` into whitespace-separated tokens. This is the only place `$ARGUMENTS` is parsed.

**Extract flag tokens first:** Any token beginning with `--` is a flag. Validate each flag against
the canonical set:
- `--review-security`
- `--review-performance`
- `--review-complexity`
- `--verify-facts`
- `--review-all`

Any unrecognized `--`-prefixed token is an error — surface a clear "unknown flag" message to the
user listing the canonical set above, then abort. Do not proceed.

**Extract the PR identifier:** The first non-flag token is the PR number or URL. If more than one
non-flag token is present, surface a "too many positional arguments" error and abort.

Accept either:
- A numeric PR number (e.g., `123`)
- A full PR URL (e.g., `https://github.com/owner/repo/pull/123`) — extract the trailing integer from the `/pull/<number>` segment

Validate that the extracted value is a positive integer. If not, abort with a clear message.

If no non-flag token is present, ask the user: "Which PR number or URL should I review?" Abort if
no answer is provided.

Capture as `<pr-number>` (positive integer) and `<flag-specialists>` (the set of validated
specialist flags from explicit user input). Both are consumed downstream — Step 1 is the only
place `$ARGUMENTS` is parsed.

## Step 2 — Validate the PR exists and capture metadata [DM direct, read-only]

Run as a standalone Bash call:

```
gh pr view <pr-number> --json number,title,state,headRefName,baseRefName,url,body
```

On non-zero exit, surface the stderr to the user verbatim and abort. Do not proceed.

Capture from the JSON output:
- `<pr-title>` — the PR title
- `<pr-state>` — the PR state (e.g., `OPEN`, `MERGED`, `CLOSED`)
- `<head-ref>` — the head branch name
- `<base-ref>` — the base branch name
- `<pr-url>` — the PR URL
- `<pr-body>` — the PR description body

If `<pr-state>` is `MERGED` or `CLOSED`, warn the user:
"PR #`<pr-number>` is `<pr-state>`. The review will reflect the PR's HEAD as it stood at last
push, which may not match the base branch anymore."
Then ask: "Proceed anyway? (yes/no)"
If the user answers anything other than `yes`, abort without making any changes.

## Step 3 — Capture session timestamp and define namespaced paths [DM direct, read-only]

Generate `<session-ts>` in the format `YYYYMMDD-HHMMSS` using the current local date and time.
Use the identical format as `/address-pr-comments` Step 1 to prevent format drift across commands.

Define:
- `<temp-branch>` = `review-pr/<pr-number>-<session-ts>`

Run as a standalone Bash call to capture the repo root:
```
git rev-parse --show-toplevel
```
Capture the output as `<repo-root>`.

Define:
- `<temp-worktree-path>` = `<repo-root>/.worktrees/review-pr-<pr-number>-<session-ts>`

Note: `<temp-branch>` uses a `/` separator (git branch convention:
`review-pr/<pr-number>-<session-ts>`) while `<temp-worktree-path>` uses `-` to keep the path
segment flat (`review-pr-<pr-number>-<session-ts>`). This matches the convention in the Worktree
Creation Subroutine in `~/.claude/agents/dungeonmaster.md`.

**Important:** This path is intentionally session-namespaced (embedding both `<pr-number>` and
`<session-ts>`) so that two concurrent `/review-pr` invocations against the same PR cannot collide
— per Project Constitution Principle 1. This temp worktree is conceptually distinct from any active
session worktree. Do NOT overwrite `WORKTREE_PATH` or `WORKTREE_BRANCH` in conversation memory —
those belong to the enclosing session worktree and must remain untouched.

Note: `<session-ts>` has second-level resolution, matching the existing `/address-pr-comments`
convention. Two `/review-pr` invocations against the same PR within the same wall-clock second
would collide; this is an acknowledged limitation consistent with the existing project timestamp
pattern.

## Step 4 — [write operation — delegate to Bitsmith] Create temp worktree and fetch PR HEAD

Delegate to Bitsmith as a single task. Bitsmith runs each of the following as a standalone call —
no `&&`, `;`, or `|` chaining anywhere. All git sub-commands use explicit `-C` flags so each call
is cwd-independent, conforming to `~/.claude/references/bash-style.md`.

**Why not `gh pr checkout`:** `gh pr checkout` has no `-C`/`--cwd` flag (so cwd cannot be set
without forbidden `cd ... &&` chaining), and it registers fork remotes in the enclosing repo's git
config that persist after worktree cleanup. The explicit fetch+checkout approach avoids both issues.

**Path Mismatch Guard note (include in Bitsmith delegation):** The operations in this step create
the temp worktree at `<temp-worktree-path>` and manage git worktree admin state under
`<repo-root>/.git/worktrees/`. Both targets are outside any active `WORKING_DIRECTORY` by design
— `/review-pr` is explicitly intended to operate outside the active session worktree. DM must
include this authorization note in the Bitsmith delegation prompt verbatim: "These operations
target paths outside `WORKING_DIRECTORY` by design, as authorized by the `/review-pr` command
workflow. The temp worktree path is `<temp-worktree-path>`. This delegation is an authorized Path
Mismatch Guard exception equivalent to the `~/.ai-tpk/plans/` exception pattern — proceed with all
sub-commands."

Sub-commands (each a separate Bash call):

1. `mkdir -p <repo-root>/.worktrees`

2. `git -C <repo-root> worktree add --detach <temp-worktree-path> HEAD`
   — Creates a detached worktree at the current HEAD of the invoking repo. No branch is created
   yet; this avoids a contradictory create-then-reset sequence. The `-C <repo-root>` flag ensures
   the command runs against the invoking repo regardless of Bitsmith's inherited cwd.

3. `git -C <repo-root> fetch origin pull/<pr-number>/head:<temp-branch>`
   — Fetches the PR HEAD from the origin remote into a new local ref `<temp-branch>`. The
   `-C <repo-root>` flag ensures the fetch writes into the invoking repo's shared `.git/`
   (the same `.git/` the worktree shares) regardless of cwd. This avoids fork-remote pollution
   entirely — the ref is created under the existing `origin` remote regardless of whether the PR
   is from a fork.

4. `git -C <temp-worktree-path> checkout <temp-branch>`
   — Switches the detached worktree onto the newly-fetched `<temp-branch>`. The `-C` flag avoids
   any cwd manipulation, satisfying `~/.claude/references/bash-style.md`.

On failure of any sub-command, Bitsmith reports back with the captured stderr. The command then
proceeds to Step 9 (Cleanup) and aborts with the error surfaced to the user. Cleanup is
best-effort — partial state (worktree but no branch; or worktree + branch but unchecked-out) is
handled by Step 9's `git worktree prune` and best-effort `git branch -D`.

## Step 5 — Determine which files changed [DM direct, read-only]

Run as a standalone Bash call:

```
gh pr diff <pr-number> --name-only
```

Capture the output as `<changed-files>` (a list of relative file paths).

If the list is empty:
1. Print: "PR #`<pr-number>` has no file changes — nothing to review."
2. Proceed to Step 9 (Cleanup).
3. After cleanup completes, print a minimal Step 10 summary:
   - **PR header:** `PR #<pr-number> — <pr-title>` and `<pr-url>`
   - **Files reviewed:** "(none — PR has no file changes)"
   - **Ruinor's verdict and findings:** "not invoked — no files to review"
   - **Specialist verdicts and findings:** "not invoked"
   - **Aggregate verdict:** ACCEPT (no files to review means no issues found)
   - **Footer:** "Review complete. No comments were posted to GitHub. To post comments, use the
     GitHub web UI or wait for a future /review-pr-post command."

## Step 6 — Consume the flag set captured in Step 1

The set of explicitly-requested specialists `<flag-specialists>` was already populated by Step 1's
single-pass parse. Step 6 does NOT re-parse `$ARGUMENTS`.

`--review-all` expands to all four specialist agents: Riskmancer, Windwarden, Knotcutter,
Truthhammer.

These flags do NOT skip Ruinor — Ruinor is always invoked (Step 7). The flags only control which
specialists are added on top of the mandatory Ruinor baseline.

## Step 7 — Invoke Ruinor (mandatory baseline)

Delegate to Ruinor with:
- **(a) Worktree-absolute file paths:** Rewrite each path in `<changed-files>` to be absolute
  under `<temp-worktree-path>` (e.g., `<temp-worktree-path>/src/foo.ts`). Pass these paths
  directly. Rationale: Ruinor does not receive a `WORKING_DIRECTORY` block per DM's Phase 2 /
  Phase 4 delegation rules (`~/.claude/agents/dungeonmaster.md` line noting "Ruinor and other
  reviewer agents do not receive this block").
- **(b) PR context:** `PR #<pr-number> — <pr-title> — <pr-url>`, and a note that this is a PR
  review, not a plan review.
- **(c) Constitution:** DM's existing Project Constitution Injection automatically prepends the
  constitution from the invoking repo's tree. Accept this default behavior — `/review-pr` reviews
  the PR against the invoking session's repo standards, not the PR's own tree. Do NOT manually
  inject anything from `<temp-worktree-path>/.claude/constitution.md` and do NOT read that file.

Capture Ruinor's verdict, full findings body, and the value of its "Specialist Review Recommended"
field.

## Step 8 — Determine and invoke specialists

**Precedence (cite, do not redefine):** Apply the triggering logic defined in the "Specialist
Review Triggering" section of `~/.claude/agents/dungeonmaster.md` Phase 2 / Phase 4, and the
canonical keyword list in `~/.claude/references/specialist-triggering.md`:
- User flags (`<flag-specialists>`) are honored unconditionally.
- Ruinor's "Specialist Review Recommended" field is honored when no user flag selects a specialist.
- The keyword fallback in `~/.claude/references/specialist-triggering.md` fires only when neither
  user flags nor Ruinor recommendations have selected any specialist.

**Keyword-fallback input substrate (unique to `/review-pr`):** Because `/review-pr` has no plan
text or code-search substrate (it operates on an external PR, not on a plan-and-tree pair), use
**PR title + `<pr-body>` + the file paths in `<changed-files>`** as the keyword-fallback input. Diff
content is excluded intentionally — including diff hunks would change the heuristic's behavior
compared to its normal usage in plan review and could cause specialist over-triggering on
incidental matches. This input substrate is unique to `/review-pr`; other commands use plan text
and tree paths.

Compute the union: `<flag-specialists>` ∪ Ruinor's recommended specialists ∪ (keyword-fallback
specialists IFF both prior sets are empty).

If the union is non-empty, invoke each specialist in parallel, passing the same worktree-absolute
file paths and PR context as passed to Ruinor in Step 7. Capture each specialist's verdict and
full findings body.

If the union is empty, skip this step entirely.

## Step 9 — [write operation — delegate to Bitsmith] Cleanup

Cleanup runs unconditionally — on the success path, on early abort (Steps 1–4 failures), on
no-changes exit (Step 5), and on review failure paths. It always runs before the summary is
printed.

**Path Mismatch Guard note (include in Bitsmith delegation):** The cleanup operations target
`<temp-worktree-path>` and git worktree admin state outside any active `WORKING_DIRECTORY`. DM
must include this authorization in the Bitsmith delegation prompt: "These cleanup operations target
`<temp-worktree-path>`, authorized as a Path Mismatch Guard exception by the `/review-pr` command
workflow — proceed."

Delegate to Bitsmith to run each of the following as a standalone Bash call (no chaining):

1. `git worktree remove --force <temp-worktree-path>`
   — **Bitsmith MUST verify that `<temp-worktree-path>` begins with `<repo-root>/.worktrees/review-pr-` before executing. Refuse to act on any other path.** This is a path-prefix safety check against accidentally targeting a session worktree or the user's primary checkout. The `--force` flag is appropriate here because the worktree is ephemeral and the command's contract is that any local changes inside it are review scratch space, not user work.

2. `git branch -D <temp-branch>`
   — Best-effort; if the branch was not created (e.g., Step 4 failed before the fetch sub-command
   ran), surface the error and continue — do not abort.

3. `git worktree prune`
   — Idempotent cleanup of any orphaned worktree admin entries that may remain in `.git/worktrees/`
   if earlier sub-steps failed in any combination. Always run regardless of whether sub-steps 1 and
   2 succeeded.

**Ordering note:** `git worktree remove` runs before `git branch -D` because you cannot delete a
branch that is the active checkout of any worktree. After the worktree is removed, the branch is
no longer checked out anywhere and `git branch -D` will succeed.

All three sub-commands are best-effort. Sub-command 1 (`git worktree remove`) may fail if the
worktree was never fully created (e.g., Step 4 failed at sub-command 2 before the directory was
created) — proceed to sub-commands 2 and 3 in that case. Sub-command 2 (`git branch -D`) may fail
if the branch was never created — proceed to sub-command 3. Sub-command 3 (`git worktree prune`)
is always safe to run.

If any cleanup sub-command fails, surface the error to the user but do NOT block the review
summary from being printed. Subsequent sub-commands still run — they are independent and
idempotent.

## Step 10 — Consolidated summary

Print a single consolidated review report inline. Do NOT delegate further; do NOT enter Phase 4;
do NOT trigger DM's normal review-revise loop. The summary IS the outcome.

The report must include:

**PR header:**
```
PR #<pr-number> — <pr-title>
<pr-url>
```

**Files reviewed:** List all paths from `<changed-files>`.

**Ruinor's verdict and findings:** Print Ruinor's full response body — do not summarize.

**Specialist verdicts and findings:** For each specialist invoked in Step 8, print their full
response body — do not summarize. If no specialists were invoked, note "No specialists invoked."

**Aggregate verdict:** Compute the aggregate verdict using the following four-case precedence
table (this is an adaptation of DM's Phase 2 / Phase 4 routing rule for one-shot human-readable
display — not a verbatim citation of the routing rule, which decides the next pipeline phase):

1. **REJECT** — if any reviewer (Ruinor or any specialist) issued a `REJECT` verdict.
2. Else **REVISE** — if any reviewer issued a `REVISE` verdict with CRITICAL, MAJOR, or HIGH
   severity findings. (Truthhammer CRITICAL and HIGH count toward this threshold; Truthhammer
   MEDIUM and LOW do not.) Note: a `REVISE` verdict with only MINOR findings is downgraded to
   ACCEPT-WITH-RESERVATIONS in this aggregate — the severity gate is intentional and mirrors DM's
   "blocks progress" semantics from Phase 2 / Phase 4.
3. Else **ACCEPT-WITH-RESERVATIONS** — if any reviewer issued an `ACCEPT-WITH-RESERVATIONS`
   verdict (and no higher-precedence condition applies).
4. Else **ACCEPT** — all reviewers issued plain `ACCEPT`.

**Footer:**
"Review complete. No comments were posted to GitHub. To post comments, use the GitHub web UI or
wait for a future /review-pr-post command."
