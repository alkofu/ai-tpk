# Slash Commands

This document lists all Claude Code slash commands installed by this repository and what each one does.

## Commands

Claude Code slash commands provide quick workflow shortcuts. Commands are installed alongside skills and agents into `~/.claude/commands/`.

| Command | Purpose |
|---------|---------|
| `/bug` | Report a bug or investigate unexpected behavior — routes directly to Tracebloom (Investigative Gate), bypassing heuristic task classification. |
| `/bug-issue <issue-ref>` | Like `/bug`, but fetches the task description from a GitHub issue first. Accepts a bare issue number (e.g. `42`) or a full github.com issue URL (GitHub Enterprise URLs are not supported). Requires the `gh` CLI to be installed and authenticated. The DM runs `gh issue view` and constructs the task description from the returned title, body, and labels before routing to Tracebloom. |
| `/feature` | Request a new feature or enhancement — routes directly to the constructive planning pipeline, bypassing the Investigative Gate. |
| `/feature-issue <issue-ref>` | Like `/feature`, but fetches the task description from a GitHub issue first. Accepts a bare issue number or full github.com issue URL (GitHub Enterprise URLs are not supported). Requires the `gh` CLI to be installed and authenticated. The DM runs `gh issue view` and constructs the task description from the returned title, body, and labels before entering the Intake Gate (Askmaw or Pathfinder). |
| `/ask` | Ask a question about the codebase, architecture, or approach — lightweight Q&A with no planning or implementation. Routes to the Advisory Workflow (Phases A-B-C) for read-only research and synthesis. |
| `/ops` | Runs an advisory query and saves the synthesis output as a Markdown report to `reports/` in the current repo. Thin alias for `/ask --save-report`. |
| `/open-pr` | Creates a pull request following the `open-pull-request` skill workflow: conventional branch naming, conventional title, draft mode, assigned to @me, and full pre-flight checklist. |
| `/sync-pr` | Rebases the current PR branch onto `refs/remotes/origin/main` and force-pushes with `--force-with-lease`, keeping open PRs in sync with main's latest changes without manual git gymnastics. |
| `/resolve-conflicts` | Resolves merge conflicts during an in-progress rebase — detects conflicted files, resolves them file-by-file, stages each result, and cycles `rebase --continue` until the rebase completes. Can be invoked standalone or inline from `/sync-pr`. |
| `/clean-the-desk` | Cleans up stale local branches (whose upstream PRs have been merged) and removes their associated git worktrees. Prompts for confirmation before any destructive action. |
| `/merged` | Cleans up after a merged PR: uses session context or remote-gone detection to auto-select the target branch, removes the worktree, deletes the local branch, checks out main, pulls the latest, and silently auto-deletes current-session plan files from `~/.ai-tpk/plans/{repo-slug}/`. Confirms all destructive actions with the user. |
| `/clean-ai-tpk-artifacts` | Deletes plan and lesson files older than N days (default 14) from `~/.ai-tpk/`. By default scoped to the current repository's plans; use `--all` flag to clean across all repositories. Prompts for confirmation before deletion. |
| `/merge-pr` | Syncs the current PR branch with main, waits for all required CI checks to pass, squash-merges the PR, deletes the remote branch, and automatically chains into `/merged` for post-merge cleanup. |
| `/address-pr-comments` | Reviews and replies to unresolved inline GitHub PR review comments — fetches threads via GraphQL, reads current file state, categorizes each comment (FIX, COMPROMISE, PUSH-BACK, ALREADY-ADDRESSED, ACKNOWLEDGE), proposes a reply for user approval, and posts approved replies via the REST API. Saves a session summary to `~/.ai-tpk/pr-review-comments/` with resume support across sessions. |
| `/set-aws-profile` | Selects an AWS profile for the CloudWatch MCP server by listing available profiles from `~/.aws/config` (preferred) or `~/.aws/credentials` (fallback), validating the user's selection, and storing it in `~/.claude/.current-aws-profile` (mode 0600). The profile is read at MCP startup. Requires Claude Code restart or MCP server reload to take effect. |
