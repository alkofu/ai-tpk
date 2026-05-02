---
description: Request a new feature or enhancement — routes directly to the constructive planning pipeline. Pass --docs for documentation-only tasks to skip the requirements interview. Pass --file-issue to file a GitHub issue first, then plan against it.
---

INTENT: constructive

$ARGUMENTS

**Routing note for DM:** This message was submitted via the `/feature` command. The `INTENT: constructive` line above is an explicit routing signal. Per the Intent Override Block in Phase 1, skip the Investigative Gate entirely and proceed to the Intake Gate (which still evaluates whether Askmaw is needed or Pathfinder can be invoked directly). Strip the `INTENT: constructive` line before passing the task description to downstream agents.

**`--docs` flag (optional).** If you pass `--docs` anywhere in your message (e.g., `/feature --docs fix the typo in CONTRIBUTING.md`), DM detects the flag using the same text-scan path as `--explore-options` and emits `DOCS_HINT: true` in its Pathfinder delegation. Pathfinder will then skip its Section 3 (Interview) and Section 4 (Scope Confirmation) steps and proceed directly to plan generation. The Section 5 plan-confirmation step still applies, and all downstream review gates (Phase 2 Ruinor plan review, Phase 4 Ruinor implementation review) run unchanged. Use `--docs` only for self-evidently documentation-only tasks; if the task is ambiguous, omit the flag and let Pathfinder run the full interview.

**`--file-issue` flag (optional).** If you pass `--file-issue` anywhere in your message (e.g., `/feature --file-issue add a settings UI`), DM detects the flag using the same text-scan path used for `--docs` and `--explore-options`. When detected, DM strips the `--file-issue` flag from `$ARGUMENTS` (leaving the user's prose description as the protocol input) and pages in `claude/references/draft-issue-protocol.md`, executing it **before** invoking the Worktree Creation Subroutine. Phases A/B/C run, the user confirms the issue draft, and Bitsmith files the issue via the protocol's delegation. The protocol's pre-flight check (`gh auth status`) and empty-arguments-after-strip handling apply (if the description is empty after stripping `--file-issue`, ask the user to supply a description before proceeding to the protocol).

If Bitsmith reports a `gh issue create` failure (e.g., network error, repo permissions, label-creation error) after the user has confirmed the Phase C draft, the entire `/feature --file-issue` session ends — no worktree is created, no plan is generated, no Pathfinder is invoked. DM relays the same stderr / exit-code / body-file-path triple to the user that `/draft-issue` produces (per the protocol's `### URL echo` section). Worktree creation only proceeds on confirmed successful issue creation (Bitsmith returns the issue URL and exit code 0).

On successful issue creation, DM extracts the issue number from the URL Bitsmith returned and stores it in DM session context under `SESSION_ISSUE_NUM` (the exact name used by `/feature-issue`). When DM then runs the Worktree Creation Subroutine, the existing `ISSUE_NUM_VALUE` substitution path (step 4a of `worktree-creation-subroutine.md`) writes `ISSUE_NUM` into the sidecar with no subroutine-mechanic changes required.

Before passing the constructive task description downstream, `/feature` injects `Closes #N` into the task description (where N is the newly captured issue number). The injected task description follows this format: a one-line header summarizing the user's request, a blank line, the line `Closes #<number>`, a blank line, then the user's original prose. This injection is performed by `/feature`, not by the protocol, so the protocol remains caller-neutral.

If the user rejects the Phase C confirmation prompt, the entire `/feature` session ends — no Worktree Creation Subroutine, no Intake Gate, no Pathfinder, no plan. This matches `/draft-issue`'s rejection behaviour exactly.

`--file-issue` is a constructive-pipeline flag; it has no meaning in advisory or investigative sessions. `--file-issue` may be combined with other constructive-pipeline flags: when combined with `--docs`, the issue is filed first, then `DOCS_HINT: true` is emitted in the Pathfinder delegation as usual; when combined with `--explore-options`, the issue is filed first, then Pathfinder runs in scope-options mode as usual.

Phase 0 (session-variable capture) and the Phase 1 Worktree Creation Subroutine both apply: Phase 0 captures session variables, and because `INTENT: constructive` is set, the Intent Override branch invokes the Worktree Creation Subroutine before proceeding to the Intake Gate. When `--file-issue` is active, the shared draft-issue protocol fires *before* the Worktree Creation Subroutine; on successful issue creation `SESSION_ISSUE_NUM` is captured and the subroutine then proceeds normally. All other Phase 1 gates (Intake, Explore-Options, etc.) apply normally. Workflow flags (e.g., `--explore-options`) are unaffected by this override and continue to apply as documented.

If the task description above is empty (user provided no arguments), ask the user to describe the feature before proceeding.
