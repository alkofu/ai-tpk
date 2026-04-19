---
name: validate-before-pr
description: REQUIRED before opening any pull request. Always invoke when about to open a PR, create a merge request, push for review, or run pre-PR checks. Runs lint and format checks as a gate before PR creation.
TRIGGER: user asks to open a PR or merge request, asks to push for review, mentions pre-PR validation, or calls the open-pull-request skill.
DO NOT SKIP: applies to all PR creation regardless of repository or context.
---

# Validate Before PR

This skill is a mandatory gate that runs lint and format checks before any pull request is opened. It must be invoked before the `open-pull-request` skill. If either check fails, the PR must not be opened until the failures are resolved.

## IMPORTANT: When This Skill Applies

This skill is **mandatory** for:
- Any request to open, create, or draft a pull request or merge request
- Any workflow that leads to invoking the `open-pull-request` skill
- Requests to "push for review" or "push and open a PR"
- Pre-PR validation checks requested explicitly

**Do not** open a PR through any means without running this skill first.

## Steps

Each check must be run as a **separate, standalone Bash call**. Do not chain commands with `&&` or `;` — this is required by the bash-style rule.

### Step 0 — Detect stack

Run the following as a standalone Bash call (no args — uses the current directory):

```
~/.claude/scripts/detect-stack.sh
```

The script emits a single-line JSON object to stdout:

```json
{"stack": "...", "lint_cmd": "...", "format_check_cmd": "...", "format_warning": "..."}
```

Branch on `.stack`:

- If `.stack == "unknown"`: print the value of `.format_warning` (which will be "No recognized lint/format toolchain was found. Skipping validation."), then jump directly to Step 3. Note in the handoff that pre-PR checks were not run.
- Otherwise: store `.lint_cmd` as `<lint_cmd>` and `.format_check_cmd` as `<format_check_cmd>` for use in Steps 1–2. If `.format_warning` is non-empty, print it now (this surfaces the Makefile `fmt`-only warning to the user). Proceed to Step 1.

### Step 1 — Run lint

Run the following as a standalone Bash call, using the `<lint_cmd>` value captured in Step 0:

```
<lint_cmd>
```

- If lint **passes** (exit code 0): proceed to Step 2.
- If lint **fails** (non-zero exit): stop immediately. Do not proceed to format check or PR creation. Report the full lint output to the user and request that the errors be fixed before retrying.

### Step 2 — Run format check

If `<format_check_cmd>` is empty (e.g., a Makefile repo with only a `fmt` target that modifies files), skip this step with the note: "No format check is configured for this stack." Proceed directly to Step 3.

Otherwise, run the following as a standalone Bash call, using the `<format_check_cmd>` value captured in Step 0:

```
<format_check_cmd>
```

- If format check **passes** (exit code 0): proceed to Step 3.
- If format check **fails** (non-zero exit): stop immediately. Do not open the PR. Report the full output to the user and request that the formatting issues be fixed before retrying.

### Step 3 — Proceed to open-pull-request

Only after **both** Step 1 and Step 2 pass (or after Step 0 short-circuits to here on `stack == "unknown"`, or after Step 2 is skipped due to empty `<format_check_cmd>`) may you proceed to the `open-pull-request` skill to create the pull request.

## Fail-Fast Behavior

- Stop on the first failure. Do not run Step 2 if Step 1 failed.
- Report which check failed and include its full output so the user can act on it.
- Do not attempt to open the PR until all checks pass.

## Relationship to Other Skills

- **open-pull-request**: This skill gates entry to `open-pull-request`. It must always be invoked first. After both lint and format:check pass, hand off to `open-pull-request` to complete the PR workflow.
- **commit-message-guide**: Commits must follow conventional commit format. This skill does not replace that requirement — it adds a validation layer on top of it.
