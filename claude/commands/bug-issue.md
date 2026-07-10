---
description: Fetch a GitHub issue (via gh CLI, github.com only) and route it as a bug — investigates via Tracebloom. Requires the gh CLI to be installed and authenticated.
---

INTENT: investigative

$ARGUMENTS

**Routing note for DM:** This message was submitted via the `/bug-issue` command. `$ARGUMENTS` contains a GitHub issue reference — either a bare issue number (e.g. `42`) or a `https://github.com/<owner>/<repo>/issues/<n>` URL (github.com only; GitHub Enterprise is not supported).

Before invoking `gh`, perform the following checks:

1. **Empty-arguments guard:** If `$ARGUMENTS` is empty or whitespace-only, ask the user for an issue number or URL. Do not invoke `gh`.

2. **Argument shape validation:** Trim whitespace and strip any trailing slash, query string (`?...`), or fragment (`#...`). Confirm the result is (a) a positive integer or (b) a `https://github.com/<owner>/<repo>/issues/<n>` URL. On parse failure, ask the user to re-supply. Do not invoke `gh`.

3. **Cross-repo URL guard:** If the argument is a full URL, compare the `<owner>/<repo>` segment against the worktree's `origin` remote. If they do not match, stop and ask the user to confirm intent before continuing.

Once all guards pass, invoke `gh issue view <argument> --json title,body,labels,number,url,comments,state` using the Bash tool. Use this exact flag set.

**On gh failure:** If `gh` fails, surface the exact error message and ask the user to either fix the problem and retry, or provide the bug description manually.

**On empty issue body:** If the returned `body` field is empty or whitespace-only, proceed with a header + closing-keyword line task description and surface a brief note to the user (e.g., "Issue #N has no body — proceeding with title and closing keyword only").

**Constructing the task description:** Build a one-line header — `Issue #<number> (<url>) [<label1>, <label2>, ...]: <title>` (omit `[...]` if labels is empty) — followed by a blank line, then the line `Fixes #<number>`, followed by a blank line, then the issue body verbatim (if non-empty). The `Fixes #<number>` line is a GitHub closing keyword: when this task description (or a derivative such as a commit message or PR body) appears on a merged PR, GitHub auto-closes the linked issue.

If the `comments` array returned by `gh` is non-empty, append a blank line and a `## Comments` section after the issue body. Render each comment in array order as a sub-section: `### Comment by @<login> — <createdAt> ([link](<url>))` on one line, then a blank line, then the comment `body` verbatim, then a blank line. Use the comment's `author.login`, `createdAt`, and `url` fields for the heading and the `body` field for the content. If the `comments` array is empty, omit the `## Comments` section entirely (do not emit an empty header or a placeholder).

**Issue evaluation:** Before firing the Investigative Gate, evaluate this issue across three dimensions. Use the `state` field already fetched and run at most 5 Read/Grep checks total, chosen strategically.

**1. Staleness** — Scan the issue body for file paths, symbol names, and error/pattern excerpts. Verify those elements still exist in the codebase and the described bug still holds. Also scan `git log --oneline -n 50` for an obvious fix commit.

**2. Fact-check** — Verify factual claims in the issue body: code snippets against actual code, error messages against what the code produces, file paths against the filesystem, behavioral descriptions against code flow. Flag any meaningful discrepancy.

**3. Concerns** — Assess whether the issue's root cause analysis or proposed solution is sound. Surface only meaningful disagreements: incorrect root cause, proposed fix addressing the wrong problem, or obvious missing constraints.

Proceed silently to the Routing step if and only if **all three** of the following hold:
- `state == "OPEN"` and codebase evidence clearly confirms the described bug still holds and no obvious fix commit is visible in `git log --oneline -n 50`
- No factual errors found
- No meaningful concerns about root cause or approach

In every other case, surface the findings and wait for an explicit response:

> **Issue #\<number\> requires your attention.**
>
> **Staleness:** \<one-sentence finding\> *(omit this line if no staleness signals)*
> **Fact-check:** \<one sentence per discrepancy\> *(omit this line if facts check out)*
> **Concerns:** \<one sentence per concern\> *(omit this line if no meaningful concerns)*
>
> Reply "proceed" to continue anyway, or "abort" to stop.

On any clearly affirmative reply, continue to the Routing step (Tracebloom investigates). On any clearly negative reply, end the session immediately — do not invoke the Worktree Creation Subroutine or fire the Investigative Gate. On an ambiguous reply, ask once for clarification; treat a second ambiguous reply as abort.

**Routing:** The `INTENT: investigative` line above is an explicit routing signal. Per the Intent Override Block in Phase 1, skip heuristic classification and fire the Investigative Gate (Tracebloom) directly, using the constructed task description as the input. Strip this routing note and the `INTENT:` line — downstream agents see only the constructed task description.

Phase 0 (session-variable capture) applies as documented. **`/bug-issue` deviates from the general investigative doctrine** in `dungeonmaster.md` lines 272 and 283 (which says `INTENT: investigative` defers the Worktree Creation Subroutine until after Tracebloom investigates within the gate's fix-bound routing branches): `/bug-issue` instead invokes the Worktree Creation Subroutine **before** firing the Investigative Gate. This deviation is intentional and user-confirmed: the issue number is known at command invocation time (parsed from `$ARGUMENTS`), so DM can create the worktree, populate the sidecar with `ISSUE_NUM` via the existing `SESSION_ISSUE_NUM` → `ISSUE_NUM_VALUE` path, and then fire the Investigative Gate with Tracebloom's working directory set to the new worktree. All other Phase 1 gates apply normally. Workflow flags (e.g., `--explore-options`) are unaffected by this deviation and continue to apply as documented. **Ordering constraint:** The issue evaluation above must run before the Worktree Creation Subroutine is invoked. If the user aborts at the issue evaluation, end the session immediately — the Worktree Creation Subroutine is never invoked and Tracebloom is not fired.
