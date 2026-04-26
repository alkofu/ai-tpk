---
description: Fetch a GitHub issue (via gh CLI, github.com only) and route it as a feature request — enters the constructive planning pipeline. Requires the gh CLI to be installed and authenticated.
---

INTENT: constructive

$ARGUMENTS

**Routing note for DM:** This message was submitted via the `/feature-issue` command. `$ARGUMENTS` contains a GitHub issue reference — either a bare issue number (e.g. `42`) or a `https://github.com/<owner>/<repo>/issues/<n>` URL (github.com only; GitHub Enterprise is not supported).

Before invoking `gh`, perform the following checks:

1. **Empty-arguments guard:** If `$ARGUMENTS` is empty or whitespace-only, ask the user for an issue number or URL. Do not invoke `gh`.

2. **Argument shape validation:** Trim whitespace and strip any trailing slash, query string (`?...`), or fragment (`#...`). Confirm the result is (a) a positive integer or (b) a `https://github.com/<owner>/<repo>/issues/<n>` URL. On parse failure, ask the user to re-supply. Do not invoke `gh`.

3. **Cross-repo URL guard:** If the argument is a full URL, compare the `<owner>/<repo>` segment against the worktree's `origin` remote. If they do not match, stop and ask the user to confirm intent before continuing.

Once all guards pass, invoke `gh issue view <argument> --json title,body,labels,number,url,comments` using the Bash tool. Use this exact flag set.

**On gh failure:** If `gh` fails, surface the exact error message and ask the user to either fix the problem and retry, or provide the feature description manually.

**On empty issue body:** If the returned `body` field is empty or whitespace-only, proceed with a header + closing-keyword line task description and surface a brief note to the user (e.g., "Issue #N has no body — proceeding with title and closing keyword only").

**Constructing the task description:** Build a one-line header — `Issue #<number> (<url>) [<label1>, <label2>, ...]: <title>` (omit `[...]` if labels is empty) — followed by a blank line, then the line `Closes #<number>`, followed by a blank line, then the issue body verbatim (if non-empty). The `Closes #<number>` line is a GitHub closing keyword: when this task description (or a derivative such as a commit message or PR body) appears on a merged PR, GitHub auto-closes the linked issue.

If the `comments` array returned by `gh` is non-empty, append a blank line and a `## Comments` section after the issue body. Render each comment in array order as a sub-section: `### Comment by @<login> — <createdAt> ([link](<url>))` on one line, then a blank line, then the comment `body` verbatim, then a blank line. Use the comment's `author.login`, `createdAt`, and `url` fields for the heading and the `body` field for the content. If the `comments` array is empty, omit the `## Comments` section entirely (do not emit an empty header or a placeholder).

**Mapping `review:*` labels to DM review-flag tokens (embedded in task description body):** After the task description is constructed, inspect the `labels` array returned by `gh issue view`. For each `review:*` label present, **embed the matching DM review-flag token as a literal text token in the task description body** so DM's standard message-body flag scan picks it up. DM scans the entire message body for review-flag tokens (the same text-scan model used for `--docs` and `--explore-options` — see `dungeonmaster.md` line 383). No special wrapper block is required.

| Label                | DM review-flag token   |
|----------------------|------------------------|
| review:security      | --review-security      |
| review:performance   | --review-performance   |
| review:complexity    | --review-complexity    |
| review:facts         | --verify-facts         |

Note the asymmetry: `review:facts` maps to `--verify-facts` (not `--review-facts`) because that is DM's existing flag name (see `dungeonmaster.md` § Specialist Review Triggering, which lists `--verify-facts` as the Truthhammer trigger flag).

Embed the mapped review-flag tokens as a single line at the **end of the constructed task description body**, on a line by itself, preceded by a blank line. Format: `Review flags: --review-security --verify-facts` (literal prefix `Review flags:` followed by space-separated tokens). Example: a label set of `[bug, review:security, review:facts]` produces a final line `Review flags: --review-security --verify-facts` appended after the issue body (and the `## Comments` section, if present). Preserve the order shown in the mapping table when multiple flags apply (security, performance, complexity, facts). If no `review:*` labels are present, do NOT emit the `Review flags:` line at all (absence is the negative signal).

Deduplication: if the user's `$ARGUMENTS` already contains one of these tokens (e.g., they ran `/feature-issue --review-security 42`), do not emit it a second time on the `Review flags:` line. DM's scan is set-based — duplicate tokens are not harmful, but the constructed body should still avoid them for clarity.

Labels that do not match the `review:*` pattern (e.g., `bug`, `enhancement`, `good first issue`) are still surfaced in the header of the constructed task description (per the existing behaviour on line 25), but do not produce review-flag tokens.

**Routing:** The `INTENT: constructive` line above is an explicit routing signal. Per the Intent Override Block in Phase 1, skip the Investigative Gate entirely and proceed to the Intake Gate (which still evaluates whether Askmaw is needed or Pathfinder can be invoked directly), using the constructed task description as the input. Strip this routing note and the `INTENT:` line — downstream agents see only the constructed task description.

**`--docs` flag (optional).** If you pass `--docs` anywhere in your message (e.g., `/feature-issue --docs 42`), DM detects the flag using the same text-scan path as `--explore-options` and emits `DOCS_HINT: true` in its Pathfinder delegation. Pathfinder will then skip its Section 3 (Interview) and Section 4 (Scope Confirmation) steps and proceed directly to plan generation. The Section 5 plan-confirmation step still applies, and all downstream review gates (Phase 2 Ruinor plan review, Phase 4 Ruinor implementation review) run unchanged. Use `--docs` only for self-evidently documentation-only tasks; if the task is ambiguous, omit the flag and let Pathfinder run the full interview.

Phase 0 (session-variable capture) and the Phase 1 Worktree Creation Subroutine both apply: Phase 0 captures session variables, and because `INTENT: constructive` is set, the Intent Override branch invokes the Worktree Creation Subroutine before proceeding to the Intake Gate. All other Phase 1 gates (Intake, Explore-Options, etc.) apply normally. Workflow flags (e.g., `--explore-options`) are unaffected by this override and continue to apply as documented.
