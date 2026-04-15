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
