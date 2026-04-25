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

**On empty issue body:** If the returned `body` field is empty or whitespace-only, proceed with a header-only task description and surface a brief note to the user (e.g., "Issue #N has no body — proceeding with title-only context").

**Constructing the task description:** Build a one-line header — `Issue #<number> (<url>) [<label1>, <label2>, ...]: <title>` (omit `[...]` if labels is empty) — followed by a blank line and the issue body verbatim (if non-empty).

If the `comments` array returned by `gh` is non-empty, append a blank line and a `## Comments` section after the issue body. Render each comment in array order as a sub-section: `### Comment by @<login> — <createdAt> ([link](<url>))` on one line, then a blank line, then the comment `body` verbatim, then a blank line. Use the comment's `author.login`, `createdAt`, and `url` fields for the heading and the `body` field for the content. If the `comments` array is empty, omit the `## Comments` section entirely (do not emit an empty header or a placeholder).

**Routing:** The `INTENT: constructive` line above is an explicit routing signal. Per the Intent Override Block in Phase 1, skip the Investigative Gate entirely and proceed to the Intake Gate (which still evaluates whether Askmaw is needed or Pathfinder can be invoked directly), using the constructed task description as the input. Strip this routing note and the `INTENT:` line — downstream agents see only the constructed task description.

**`--docs` flag (optional).** If you pass `--docs` anywhere in your message (e.g., `/feature-issue --docs 42`), DM detects the flag using the same text-scan path as `--explore-options` and emits `DOCS_HINT: true` in its Pathfinder delegation. Pathfinder will then skip its Section 3 (Interview) and Section 4 (Scope Confirmation) steps and proceed directly to plan generation. The Section 5 plan-confirmation step still applies, and all downstream review gates (Phase 2 Ruinor plan review, Phase 4 Ruinor implementation review) run unchanged. Use `--docs` only for self-evidently documentation-only tasks; if the task is ambiguous, omit the flag and let Pathfinder run the full interview.

Phase 0 (session-variable capture) and the Phase 1 Worktree Creation Subroutine both apply: Phase 0 captures session variables, and because `INTENT: constructive` is set, the Intent Override branch invokes the Worktree Creation Subroutine before proceeding to the Intake Gate. All other Phase 1 gates (Intake, Explore-Options, etc.) apply normally. Workflow flags (e.g., `--explore-options`) are unaffected by this override and continue to apply as documented.
