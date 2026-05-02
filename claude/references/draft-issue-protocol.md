# Draft Issue Protocol

This reference is paged in by any command that needs to file a GitHub issue using the `action-item.md` template structure. Callers (currently `/draft-issue` and `/feature --file-issue`) invoke this protocol after capturing session variables and completing any command-specific pre-protocol steps. The protocol is caller-neutral: it does not encode which command invoked it, does not inject closing keywords into the issue body, and does not impose any post-protocol pipeline behaviour. Callers are responsible for any downstream pipeline steps that follow successful issue creation (e.g., injecting `Closes #N` into task descriptions, invoking the Worktree Creation Subroutine).

<!-- markdownlint-disable MD024 -->
## Draft Issue Protocol
<!-- markdownlint-enable MD024 -->

### Pre-flight: gh auth status check

Before entering Phase B clarification, DM must run `gh auth status` via the Bash tool. If `gh auth status` exits non-zero (gh not installed, or not authenticated), surface the exact stderr to the user along with this message: *"This command requires the `gh` CLI to be installed and authenticated against the target repository. Run `gh auth login` and re-invoke the command."* Then end the session — do not proceed to Phase B. If `gh auth status` exits zero, proceed to Phase B.

### Phase A: Classification override

Phase A normally classifies the user's question by topic (security, performance, complexity, etc.) and selects 0-3 research agents. For this protocol, override Phase A classification: select **no research agents**. DM handles Phase B clarification directly using the same DM-direct path used for the 'Simple conversational / general' row of the Phase A classification table (`dungeonmaster.md § Phase A — Question Classification § 'Simple conversational / general' row`). No agent delegation occurs in Phase B.

### Phase B: DM-direct clarification

DM reads the caller's description (the user's `$ARGUMENTS` after any flag stripping the caller has performed) and decides whether the description is detailed enough to draft the issue body fields (objective, scope, ruled-out alternatives, assumptions, acceptance criteria) without asking the user anything further.

- If the description is sufficient, skip directly to Phase C with no additional Q&A.
- If the description leaves load-bearing gaps (e.g., the goal is unclear, the scope is undefined, success criteria are missing), ask the user **one to three concise clarifying questions** in a single message. Do not run a multi-round interview loop — the goal is to fill in just enough context to draft a useful first-pass issue body. (Issues are routinely refined after filing; this protocol does not aim for perfection on the first draft.)
- Treat the user's reply as additional context for Phase C synthesis (no further rounds).

### Phase C: Issue body synthesis

Synthesise the issue body using the `action-item.md` template structure (see `.github/ISSUE_TEMPLATE/action-item.md` for the canonical source). Render every section header exactly as shown below, including markdown casing and bolded sub-headings:

```
## Summary

{one-to-two sentence rephrasing of the objective}

## Advisory context

**Discussion summary**

{one-to-three sentence summary of what was established during the user's request and any DM clarification rounds — what the user wants, why, and at what scope}

**Ruled-out alternatives**

{bullet list of explicitly rejected approaches the user mentioned or DM identified during clarification, prefixed by "- "; if none were established, write "- None established during intake."}

**Assumptions carried forward**

{bullet list of constraints and preferences that should be treated as settled by the implementer, one bullet per item; if none were stated, write "- None stated."}

**User's original request ($ARGUMENTS), verbatim:** {the user's $ARGUMENTS text, verbatim — included so the implementer sees the user's original prose}

## Acceptance criteria

- [ ] {bullet derived from the user's success criteria or DM's synthesis}
- [ ] {next bullet ...}

## Open questions

- {bullet for any unresolved question DM did not ask, otherwise omit this section entirely}
```

Use the field name `User's original request ($ARGUMENTS), verbatim:` exactly as shown — this is the canonical field name. If at least one acceptance criterion was established, render each as a `- [ ]` checkbox (matching `action-item.md`'s convention). **If no acceptance criteria were established, emit a single placeholder bullet: `- [ ] Acceptance criteria to be determined during planning.`** If no open questions were identified, omit the `## Open questions` header from the issue body entirely (do not emit an empty header).

The issue body must reference these section names: Summary, Advisory context, Discussion summary, Ruled-out alternatives, Assumptions carried forward, Acceptance criteria — using the exact headers shown above.

### Title derivation

The issue title must be derived from the user's objective by truncating to a single line (≤ 80 characters). If the objective is longer, reduce to a noun-phrase summary. The title MUST NOT contain a trailing period and MUST NOT include the prefix `feat:` or any other conventional-commit prefix (issue titles are not commit messages).

### Label selection

Select labels to apply to the issue as follows:

- The `enhancement` label is always applied (it exists in most repos as a GitHub default).
- Conditionally apply each `review:*` label by inspecting the user's description AND the Phase B clarification answers for signal keywords:
  - `review:security` — apply when the description or clarification mentions: auth, authentication, authorization, password, token, credential, secret, encryption, CSRF, XSS, SQL injection, sandbox escape, privilege, permission boundary.
  - `review:performance` — apply when the description or clarification mentions: latency, throughput, hot path, N+1, query optimisation, memory pressure, caching, indexing, batch, bulk, concurrency.
  - `review:complexity` — apply when the description or clarification mentions: refactor, restructure, simplify, abstraction, design pattern, architecture, layering, multi-step pipeline.
  - `review:facts` — apply when the description or clarification makes load-bearing claims about external systems, third-party APIs, library behaviour, version-specific features, or anything where citation accuracy matters.
- If unsure, omit the label. Reviewers can be added later by editing the issue. Over-labelling routes work to specialists unnecessarily; under-labelling is recoverable.

### User confirmation before delegation

After Phase C produces the rendered title, body, and label list, DM presents the proposed action to the user inline — without invoking Bitsmith yet. The presentation shows: (1) the derived title (≤ 80 characters), (2) the full rendered issue body, (3) the list of labels that will be applied. DM then asks the user a one-line confirmation: *"Ready to file this issue? Reply to proceed, adjust, or cancel."* On affirmative reply, DM proceeds to the Bitsmith delegation below. On rejection, the session ends — no Bitsmith delegation, no `gh` invocation. On adjustment, DM applies the requested changes and re-presents. Allow up to three adjustment rounds. If the user requests further adjustments beyond three rounds, suggest they accept the current draft and refine the issue after it is created.

### Bitsmith delegation: "Create GitHub Issue Task"

After the user confirms, DM delegates to Bitsmith using the Agent tool. This delegation is modelled on the `--save-report` post-synthesis step at `dungeonmaster.md § '--save-report' post-synthesis step`. DM populates `{literal session timestamp string}`, `{derived title}`, the labels list, and `{full Phase C rendered body, verbatim}` from the values produced in earlier steps. `SESSION_TS` is passed as a literal string (the value DM captured in Phase 0), not as a shell variable — Bitsmith substitutes the literal `SESSION_TS` value when constructing the paths it passes to the Write tool. The title is passed via a temp file (not inline in the Bash command) to prevent shell interpretation of special characters. Bitsmith's normal Bash and Write tools handle this; the execute allowlist does not apply because this is an ordinary Bitsmith delegation, not an execute dispatch.

The delegation prompt template DM sends to Bitsmith is:

```
## Create GitHub Issue Task

Create a GitHub issue using the gh CLI via the draft-issue-create.sh script. This is a small
file write plus a single script invocation. No code changes, no tests, no review needed.

**Inputs:**
- SESSION_TS: {literal session timestamp string, e.g., 20260425-150000}
- Issue title: {derived title}
- Labels: enhancement[, review:security][, review:performance][, review:complexity][, review:facts]
- Title file path: ${TMPDIR:-/tmp}/draft-issue-title-${SESSION_TS}.txt
- Body file path: ${TMPDIR:-/tmp}/draft-issue-body-${SESSION_TS}.md
  (substitute the literal SESSION_TS value above when expanding both paths; do NOT rely on shell
  variable persistence across tool calls — pass the fully-expanded paths to the Write tool.)

**Steps:**

1. Write two files using the Write tool (two separate Write tool calls):

   a. Title file: write the derived issue title (single line, no trailing newline needed) to
      the fully-expanded title file path. The title is: {derived title}

   b. Body file: write the issue body content (between the markers below) to the fully-expanded
      body file path. Resolve $TMPDIR to /tmp if it is not set in your shell environment.

---begin issue body---
{full Phase C rendered body, verbatim}
---end issue body---

2. Run the creation script via the Bash tool, including each `--label review:*` only when the
   corresponding label was selected in Phase C. The title is read from the title file — no shell
   escaping of the title is needed:

   `~/.claude/scripts/draft-issue-create.sh --title-file "<expanded title file path>" --body-file "<expanded body file path>" --label enhancement [--label review:security] [--label review:performance] [--label review:complexity] [--label review:facts]`

   The script handles label creation (for any missing review:* labels), `gh issue create`,
   and the enhancement-missing retry internally.

3. On success (script exits 0): stdout is the issue URL; any label warnings appear on stderr.
   Relay the URL and any warnings to DM.

   On failure (non-zero exit): the title and body files have NOT been deleted (user may inspect them).
   Relay the exact stderr, the exit code, and the body file path to DM.

This is a one-shot delegation: no escalation loop, no retry. Return the result to DM as a
structured response.
```

### URL echo

After Bitsmith returns successfully, DM echoes a one-line confirmation to the user: `Issue created: <url>`. If Bitsmith reported permission-denied warnings for any labels, DM appends them on the following lines. If Bitsmith reported a `gh issue create` failure, DM surfaces the exact stderr and exit code to the user along with the body file path.

### Caller-neutrality note

This protocol does not inject a `Closes #N` line into the issue body. A `Closes #N` line in an issue body is meaningless because an issue cannot reference its own number — that keyword belongs in the PR that later implements the issue. Callers are responsible for any pipeline behaviour that follows successful issue creation, including injecting `Closes #N` into downstream task descriptions if applicable (e.g., `/feature --file-issue` injects `Closes #N` into the constructive task description it sends to Pathfinder after the protocol completes).
