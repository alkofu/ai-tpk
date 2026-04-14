---
description: Rebuild dist/installer.js, reinstall all project artifacts to ~/.claude/, and optionally clean stale backups
---

You are rebuilding and reinstalling all project artifacts. Follow every step below in order.
Run each command as a standalone call — do not chain commands with `&&`, `;`, or `|`.

## Step 1 — Resolve repo root

Run: `git rev-parse --show-toplevel`

Store the result as `<repo-root>`. Use this path as the base for all subsequent commands.
This guards against cwd being reset between Bash calls.

## Step 2 — Build

Run `pnpm build` from `<repo-root>`.

If the command exits with a non-zero status, report the error output and stop. Do not proceed
to the install step.

## Step 3 — Install

Run `./install.sh` from `<repo-root>`.

If the command exits with a non-zero status, report the error output and stop. Do not proceed
to the clean-backups step.

## Step 4 — Clean backups

Run `./clean-backups.sh` from `<repo-root>`.

If it exits non-zero, report the error output.
