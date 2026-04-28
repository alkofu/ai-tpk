---
description: Open a pull request following the open-pull-request skill workflow
---

First, invoke the `validate-before-pr` skill. Run its lint and format checks. Only if both checks pass, proceed to the next step. If either check fails, stop and report the failure -- do not open the PR.

Follow the `open-pull-request` skill exactly — conventional branch naming, conventional PR title,
draft mode, assigned to @me, pre-flight checklist. Do not use any shortcut or simplified workflow.

## Completion Report

On successful PR creation, format the completion summary using Template C (Operational PR) from `claude/references/completion-templates.md`.

Populate the fields as follows:
- **PR** number, title: from the `gh pr create` output.
- **URL:** from the `gh pr create` output.
- **Branch:** the current branch pointing to `main`.
- **Status:** "draft" if the PR was opened in draft mode; "ready" if opened as ready for review.
- **Checks:** report whether `validate-before-pr` passed or failed.
- **Worktree** and **Token usage:** use the Common Fields format defined in `completion-templates.md`.
- **Next action:** a contextual suggestion, e.g., "Run /merge-pr when CI passes."

This section is reached only on success. If `validate-before-pr` fails or `gh pr create` fails, the existing error-reporting behavior applies — no completion report is produced.

## Sidecar update (PR_NUM)

On successful PR creation (after `gh pr create` returns the PR number), update the session-context sidecar to include the PR number. The sidecar is keyed by worktree-slug (not by `${CLAUDE_SESSION_ID}`, which is unavailable in hook bash contexts). This command is the sole writer of `PR_NUM`.

Use `jq` with `--argjson` (NOT `--arg`) to merge the new field as a JSON integer, preserving existing fields. Atomic `tmp-then-mv` write:

```bash
WORKTREE_SLUG=$(basename "$(git rev-parse --show-toplevel)")
SIDECAR="$HOME/.ai-tpk/session-context/by-worktree/${WORKTREE_SLUG}.json"
if [ -f "$SIDECAR" ] && [ -n "${PR_NUM:-}" ]; then
  TMP="${SIDECAR}.tmp.$$"
  jq --argjson pr "$PR_NUM" '. + {PR_NUM: $pr}' "$SIDECAR" > "$TMP" && mv "$TMP" "$SIDECAR" || rm -f "$TMP"
fi
```

Notes:
- `--argjson` (not `--arg`) is mandatory — `PR_NUM` must be a JSON integer per the sidecar schema. Using `--arg` would write a quoted string, failing consumer schema validation.
- This update is fire-and-forget — failures (missing jq, missing sidecar, write error) do not abort `/open-pr`.
- If the sidecar does not exist (pre-feature session or missing subroutine write), this block is a silent no-op — `/open-pr` does NOT create a sidecar by itself.
- The next Stop hook run picks up `PR_NUM` from the sidecar and includes it in the OSC 6800 emit.
