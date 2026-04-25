# Installation Guide

This guide covers the installation lifecycle for ai-tpk: cloning, running install.sh, setting up a development environment, updating, recovering or cleaning backups, and cleaning up agent-produced artifacts. For configuration details, see [docs/HOOKS.md](/docs/HOOKS.md), [docs/MCP.md](/docs/MCP.md), [docs/TPK.md](/docs/TPK.md), [docs/SKILLS.md](/docs/SKILLS.md), and [docs/SLASH_COMMANDS.md](/docs/SLASH_COMMANDS.md).

## Prerequisites

Node.js >= 18.18.0 is required to run `install.sh`. The installer is implemented in TypeScript and pre-built to a standalone bundle (`dist/installer.js`) via esbuild.

## Quick Install

Clone the repository:
```bash
git clone git@github.com:alkofu/ai-tpk.git
cd ai-tpk
```

Run the installation script:

```bash
./install.sh
```

The installer accepts an optional `--target-agent <name>` flag to select which agent to install for. The only currently supported value is `claude`, which is also the default.

The installer copies the whitelisted paths (`CLAUDE.md`, `settings.json`, `skills/`, `agents/`, `commands/`, `hooks/`, `references/`, `scripts/`) from `claude/` into `~/.claude/` and, when present, into `~/.cursor/`. Anything else in the repo or on disk under those destinations is left untouched except where those paths are replaced (after a timestamped backup).

The `.claude/` directory is never synced by the installer — it remains project-local.

**GitHub MCP setup:** To enable multi-account GitHub MCP servers, create `~/.config/tpk/github-pats.json` before (or after) running `install.sh` and set its mode to `0600`. See [docs/MCP.md § Server Roster](/docs/MCP.md#server-roster) for the file format, key naming rules, and operational details.

## Development Setup

To contribute to this repository, you'll need to set up the development environment:

```bash
# Clone the repository
git clone git@github.com:alkofu/ai-tpk.git
cd ai-tpk

# Install dependencies (requires pnpm)
pnpm install

# Build the installer bundle and test it
pnpm run build
pnpm run setup
```

**Note:** The `pnpm run build` command bundles the installer via esbuild into `dist/installer.js`. The `pnpm run setup` command executes the pre-built bundle, ensuring your development environment uses the same code path as end-users. This keeps installer behavior consistent during development.

After setup, you can test changes locally. The pre-push hook (Lefthook) will automatically run linting and format checks before you push commits.

**Note:** The installer automatically backs up any existing configurations with a timestamp before overwriting them.

The installation logic is implemented in TypeScript under `src/installer/`. See the source files there for implementation details.

The `install.sh` shim in the repo root runs the pre-built esbuild bundle (`dist/installer.js`) and verifies Node.js >= 18.18.0 is available.

### Running Tests

The installer includes a comprehensive test suite using `node:test`:

```bash
pnpm test
```

This runs all test files colocated with source under `src/installer/` and `src/launcher/` (files matching `*.test.ts`) with isolated temporary directories. For more details, see the `*.test.ts` files beside their respective source modules.

### Code Quality: Linting and Formatting

The project uses **oxlint** (TypeScript linter) and **oxfmt** (code formatter) to maintain consistent code quality. An `.editorconfig` file at the repo root configures indent style, line endings, charset, trailing whitespace, and final newlines for editors that support it.

**pnpm scripts:**

- `pnpm run lint` — Run oxlint to check for TypeScript errors and code quality issues
- `pnpm run format` — Apply oxfmt formatting to all TypeScript files in `src/`
- `pnpm run format:check` — Check formatting without modifying files (used in CI)

**Developer workflow:**

Before committing code, run `pnpm run format` to auto-format your changes. This keeps the codebase consistent and prevents formatting failures in CI.

**Pre-Push Hook:**

Lefthook runs lint and format checks on every push when JS/TS files have changed. If either check fails, the push is blocked. Run `pnpm run format` to auto-fix formatting issues. Hook configuration lives in `lefthook.yml`.

### Development Workflow

When making changes to this repository:

1. **Setup** — Follow the Development Setup section above to install dependencies and build the bundle
2. **Make changes** — Edit TypeScript files in `src/installer/` or `src/launcher/`, or configuration files in `claude/`
3. **Build and reinstall** — Run `pnpm run build` to rebuild the installer bundle, then `./install.sh` to deploy to `~/.claude/`, then `./clean-backups.sh` to remove stale backups. The `/build-and-install` repo-scope slash command automates all three steps in sequence.
4. **Test** — Run `pnpm test` to execute the test suite
5. **Lint and format** — Run `pnpm run format` to auto-fix formatting, then `pnpm run lint` to verify code quality
6. **Commit and push** — The pre-push hook (Lefthook) automatically runs linting and format checks; they must pass before pushing

## Updating

```bash
cd ai-tpk
git pull
./install.sh
```

Re-running the installer after `git pull` copies the latest configurations into place. Any files already present are backed up with a timestamp before being replaced.

## Recovering Backups

The installer automatically creates timestamped backups (e.g., `settings.json.backup.20260407_143022`) before overwriting any existing files. To browse and restore a backup interactively:

```bash
./recover.sh
```

The script scans `~/.claude` and `~/.cursor` for machine-generated backups, lists them newest-first with their original paths and human-readable timestamps, and prompts you to select one by number. If the original path currently exists, it is itself backed up before the selected backup is moved into place.

## Cleaning Up Old Backups

Over time the installer may accumulate multiple timestamped backups for the same file. `clean-backups.sh` removes all but the most recent backup for each original path, keeping your `~/.claude` and `~/.cursor` directories tidy.

```bash
./clean-backups.sh
```

The script scans the same directories as `recover.sh` (`~/.claude` and `~/.cursor`), groups backups by their original file path, and displays the list of files it will delete before proceeding immediately. Original paths that have only one backup are left untouched.

## Cleaning Up Agent Artifacts

Agent-produced files (Pathfinder plans, Everwise lessons) accumulate in `~/.ai-tpk/` over time. Two mechanisms are available for cleanup:

### /merged Command — Post-Merge Plan Cleanup

When you run `/merged` after a PR is merged, the command silently auto-deletes plan files from `~/.ai-tpk/plans/{repo-slug}/` that belong to the current session (matched by session timestamp prefix). No prompt is shown for these files.

If the session timestamp is unavailable (e.g. `/merged` was run in a new session without worktree context), no plan files are touched and no prompt is shown.

Files from other sessions are never mentioned or deleted by `/merged`. Use `/clean-ai-tpk-artifacts` for cross-session cleanup.

This is useful for removing planning artifacts after a feature is shipped without any interruption to the cleanup flow.

### /clean-ai-tpk-artifacts Command — Age-Based Cleanup

For periodic housekeeping across all repositories, use the age-based cleanup command:

```bash
/clean-ai-tpk-artifacts          # Delete artifacts older than 14 days (default)
/clean-ai-tpk-artifacts 30       # Delete artifacts older than 30 days
/clean-ai-tpk-artifacts 7 --all  # Delete 7-day-old artifacts from ALL repos
```

**Scope behavior:**
- **Default (no `--all`):** Searches `~/.ai-tpk/plans/{current-repo-slug}/` for old plans, and `~/.ai-tpk/lessons/` for old lessons. Plans are scoped to the current repository; lesson files are always searched globally (lessons are not repo-scoped).
- **With `--all` flag:** Searches all repositories' plan directories under `~/.ai-tpk/plans/` and `~/.ai-tpk/lessons/`. Displays a warning that files from other repositories may be included.

The command lists files to be deleted and asks for confirmation before proceeding.
