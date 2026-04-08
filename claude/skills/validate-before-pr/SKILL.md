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

## Stack Detection

Before running the checks below, detect which toolchain the repository uses. Check in this order and use the **first match**:

1. **`package.json` exists** (Node/npm): Use `npm run lint` and `npm run format:check` (Steps 1-2 below as written).
2. **`Makefile` exists with `lint` target**: Use `make lint` for lint. For format check: look for a `make fmt-check`, `make format-check`, or `make check-format` target (exits non-zero on violations without modifying files). If the Makefile only has a `fmt` target that modifies files, skip the format check for this project and warn the user: "Makefile `fmt` target detected but it modifies files — skipping format check. Add a `fmt-check` target to enable it." (substitute lint command in Step 1).
3. **`pyproject.toml` exists**: Use `ruff check .` for lint and `ruff format --check .` for format (substitute in Steps 1-2).
4. **`setup.py` or `setup.cfg` exists** (legacy Python): Use `flake8 .` for lint and `black --check .` for format (substitute in Steps 1-2).
5. **`go.mod` exists** (Go): Use `golangci-lint run` for lint and `gofmt -l .` for format check (substitute in Steps 1-2; format check passes if `gofmt -l .` produces no output).
6. **`Cargo.toml` exists** (Rust): Use `cargo clippy` for lint and `cargo fmt --check` for format check (substitute in Steps 1-2).
7. **No match**: Warn the user that no recognized lint/format toolchain was found. Skip validation and proceed to `open-pull-request` with a note that pre-PR checks were not run.

The npm commands in Steps 1-2 below are the default. When stack detection selects a different toolchain, substitute the corresponding commands but follow the same pass/fail logic.

## Steps

Each check must be run as a **separate, standalone Bash call**. Do not chain commands with `&&` or `;` — this is required by the bash-style rule.

### Step 1 — Run lint (npm default: `npm run lint`)

Run the following as a standalone Bash call:

```
npm run lint
```

- If lint **passes** (exit code 0): proceed to Step 2.
- If lint **fails** (non-zero exit): stop immediately. Do not proceed to format check or PR creation. Report the full lint output to the user and request that the errors be fixed before retrying.

### Step 2 — Run format check (npm default: `npm run format:check`)

Run the following as a standalone Bash call:

```
npm run format:check
```

- If format check **passes** (exit code 0): proceed to Step 3.
- If format check **fails** (non-zero exit): stop immediately. Do not open the PR. Report the full output to the user. Suggest running `npm run format` to auto-fix formatting issues, then re-running `npm run format:check` to confirm.

### Step 3 — Proceed to open-pull-request

Only after **both** Step 1 and Step 2 pass may you proceed to the `open-pull-request` skill to create the pull request.

## Fail-Fast Behavior

- Stop on the first failure. Do not run Step 2 if Step 1 failed.
- Report which check failed and include its full output so the user can act on it.
- Do not attempt to open the PR until all checks pass.

## Relationship to Other Skills

- **open-pull-request**: This skill gates entry to `open-pull-request`. It must always be invoked first. After both lint and format:check pass, hand off to `open-pull-request` to complete the PR workflow.
- **commit-message-guide**: Commits must follow conventional commit format. This skill does not replace that requirement — it adds a validation layer on top of it.
