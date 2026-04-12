# Parallel DungeonMaster Sessions via Git Worktrees

## Overview

The Dungeon Master orchestration agent now supports **parallel isolated sessions** via Git worktrees. This feature enables multiple simultaneous `claude --agent dungeonmaster` terminals to work on unrelated issues without git conflicts or interference.

Each DungeonMaster session automatically creates a dedicated git worktree on an isolated branch, ensuring clean separation of concerns and enabling truly parallel development workflows.

## Quick Start

### Running Parallel DungeonMaster Sessions

Start your first DungeonMaster session normally:

```bash
claude --agent dungeonmaster
# Prompt: "Add OAuth login"
```

The session automatically:
1. Creates an isolated git worktree at `.worktrees/dm-add-oauth-login/`
2. Creates a dedicated branch `dm/add-oauth-login`
3. Executes all planning, implementation, and reviews within that worktree
4. Logs the branch as ready at completion; run `/open-pr` to create a pull request or handle cleanup manually

In another terminal, start a second DungeonMaster session:

```bash
claude --agent dungeonmaster
# Prompt: "Fix database query performance on issue #42"
```

Both sessions operate independently:
- Session 1 works on branch `dm/add-oauth-login` in `.worktrees/dm-add-oauth-login/`
- Session 2 works on branch `dm/fix-db-perf-issue-42` in `.worktrees/dm-fix-db-perf-issue-42/`
- No git conflicts, no interference, completely isolated development

## How It Works

### Worktree Creation (Phase 0)

When you start a DungeonMaster session, it performs **Phase 0: Session Isolation** before any planning:

1. **Branch naming:** The task description is converted to a branch name following the pattern `dm/{slugified-task}`. Examples:
   - "Add OAuth login" → `dm/add-oauth-login`
   - "Fix database query performance" → `dm/fix-database-query-performance`
   - "Refactor auth module" → `dm/refactor-auth-module`

2. **Worktree creation:** A new git worktree is created at `.worktrees/{slug}/` on the dedicated branch

3. **Plans directory:** A local `plans/` directory is created within the worktree (gitignored, like the main repo's plans/)

4. **Session context:** All subsequent work (Pathfinder planning, Bitsmith implementation, Quill documentation) operates within the worktree

### Skip Conditions

Phase 0 (worktree creation) is **skipped** if:

- The `--no-worktree` flag is provided
- The task is trivially single-file (identified early as not needing Pathfinder)

Examples:

```bash
# Explicitly skip worktree creation (operate in main working tree)
claude --agent dungeonmaster --no-worktree
# Prompt: "Fix typo in README.md"

# Trivial task: worktree skipped automatically
claude --agent dungeonmaster
# Prompt: "Rename AuthContext to AuthProvider in one file"
```

**Late initialization:** If DungeonMaster initially skips worktree creation but later determines the task is non-trivial (e.g., decides to invoke Pathfinder), it creates the worktree at that point before proceeding.

### Worktree Structure

After Phase 0 completes, your repository structure looks like:

```
.
├── .git/                    # Main repo git directory (shared across worktrees)
├── .worktrees/              # Worktrees directory (gitignored)
│   ├── dm-add-oauth-login/  # Session 1 worktree
│   │   ├── .git            # Pointer to main .git (shared objects)
│   │   ├── plans/           # Local plans (gitignored)
│   │   ├── src/
│   │   └── ...
│   └── dm-fix-db-perf/      # Session 2 worktree
│       ├── .git
│       ├── plans/
│       └── ...
├── src/
├── plans/                   # Main repo plans (gitignored)
└── .gitignore               # Contains .worktrees/ and plans/
```

Each worktree is on its own branch and has its own working tree, but shares the git object database for efficiency.

## Managing Worktrees

### Listing Active Worktrees

To see all active worktrees:

```bash
git worktree list
```

Output example:

```
/path/to/repo                 abc1234 [main]
/path/to/repo/.worktrees/dm-add-oauth-login
                              def5678 [dm/add-oauth-login]
/path/to/repo/.worktrees/dm-fix-db-perf
                              ghi9012 [dm/fix-db-perf]
```

### Cleaning Up Worktrees

At Phase 5 (session completion), DungeonMaster logs the branch as ready and advises you to run `/open-pr` to create a pull request, or to handle cleanup manually. The worktree and branch are always preserved — nothing is removed automatically.

#### Manual Cleanup

If you have stale worktrees or want to clean up manually:

```bash
# Remove a specific worktree
git worktree remove .worktrees/dm-add-oauth-login

# Prune stale worktree entries (if a worktree directory was deleted manually)
git worktree prune

# List all worktree branches (those starting with dm/)
git branch --list 'dm/*'

# Delete a merged branch
git branch -d dm/add-oauth-login

# Force delete a branch (if not fully merged)
git branch -D dm/add-oauth-login
```

**Cleanup checklist:**

1. Check if the worktree is no longer needed: `git worktree list`
2. Remove the worktree: `git worktree remove .worktrees/{slug}`
3. Clean up any stale entries: `git worktree prune`
4. Delete the branch: `git branch -d dm/{slug}`

### Orphaned Worktrees

If a DungeonMaster session crashes before Phase 5, worktrees may be left behind. These are harmless but clutter your working directory.

To clean them up:

```bash
# List all worktrees to find orphans
git worktree list

# Remove the orphaned worktree
git worktree remove .worktrees/dm-abandoned-task

# Prune stale entries
git worktree prune

# Clean up the orphaned branch
git branch -d dm/abandoned-task
```

## Suppressing Worktree Creation

If you want to suppress worktree creation and work directly in the main working tree, use the `--no-worktree` flag:

```bash
claude --agent dungeonmaster --no-worktree
# Prompt: "Add OAuth login"
```

With `--no-worktree`:
- DungeonMaster operates in the main working tree
- Plans are saved to `plans/` (main repo)
- No `.worktrees/` directory is used
- Useful for analysis-only sessions or read-only work
- Backwards compatible with pre-worktree workflow

## Worktree Awareness in Sub-Agents

When a DungeonMaster session has an active worktree, all sub-agents (Pathfinder, Bitsmith, Quill) automatically receive worktree context:

```
WORKING_DIRECTORY: /absolute/path/to/.worktrees/dm-add-oauth-login
WORKTREE_BRANCH: dm/add-oauth-login
All file operations and Bash commands must use this directory as the working root.
```

Sub-agents respect this context:

- **Pathfinder:** Writes plans to `{WORKING_DIRECTORY}/plans/` instead of the main repo's `plans/`
- **Bitsmith:** Performs all code changes within the worktree, commits land on the worktree's branch
- **Quill:** Writes documentation updates relative to the worktree

You don't need to do anything — the context is automatically propagated by DungeonMaster.

### Bitsmith's Path Mismatch Guard

Bitsmith includes a safeguard that prevents silent writes to the main working tree when a session worktree is active. This **Path Mismatch Guard** fires as a per-operation invariant before every Write, Edit, or file-modifying Bash command. If you (or Bitsmith) accidentally reference a file path outside the active worktree, Bitsmith halts and surfaces the conflict to the Dungeon Master for confirmation rather than proceeding silently. This ensures changes land on the correct branch in the correct worktree, preventing accidental main-tree modifications during isolated sessions.

## Phase 5 Completion Log

At session completion (Phase 5), DungeonMaster logs a status line and leaves the worktree and branch intact:

```
Branch `dm/add-oauth-login` is ready at `.worktrees/dm-add-oauth-login`.
Run `/open-pr` to create a pull request, or handle cleanup manually.
```

No interactive prompt is shown. The worktree is never removed automatically. When you are ready to create a PR, run `/open-pr` in the same session or a new session. When you are done with the worktree, clean up manually:

```bash
git worktree remove .worktrees/dm-add-oauth-login
git branch -d dm/add-oauth-login
```

## Example: Two Parallel Sessions

### Session 1: OAuth Implementation

**Terminal A:**

```bash
$ claude --agent dungeonmaster
> Add OAuth login to the authentication system
...
[DungeonMaster creates .worktrees/dm-add-oauth-login/ on branch dm/add-oauth-login]
[Pathfinder creates plan at .worktrees/dm-add-oauth-login/plans/oauth-plan.md]
[Bitsmith implements OAuth in the worktree]
[Ruinor and Riskmancer review in the worktree context]
[Quill updates documentation in the worktree]
...
Branch `dm/add-oauth-login` is ready at `.worktrees/dm-add-oauth-login`. Run `/open-pr` to create a pull request, or handle cleanup manually.
```

### Session 2: Database Performance

**Terminal B (same time):**

```bash
$ claude --agent dungeonmaster
> Fix slow database queries on issue #42
...
[DungeonMaster creates .worktrees/dm-fix-db-perf-issue-42/ on branch dm/fix-db-perf-issue-42]
[Pathfinder creates plan at .worktrees/dm-fix-db-perf-issue-42/plans/db-optimization.md]
[Bitsmith implements query fixes in the worktree]
[Ruinor and Windwarden review in the worktree context]
...
Branch `dm/fix-db-perf-issue-42` is ready at `.worktrees/dm-fix-db-perf-issue-42`. Run `/open-pr` to create a pull request, or handle cleanup manually.
```

**Result:**
- Session 1: Branch `dm/add-oauth-login` preserved at `.worktrees/dm-add-oauth-login`; run `/open-pr` when ready
- Session 2: Branch `dm/fix-db-perf-issue-42` preserved at `.worktrees/dm-fix-db-perf-issue-42`; run `/open-pr` when ready
- Main branch untouched until you merge or create a PR
- Zero git conflicts between sessions

## Workflow Flags Summary

| Flag | Effect | Use Case |
|------|--------|----------|
| `--no-worktree` | Suppress worktree creation; operate in main working tree | Read-only analysis, single-file trivial changes, explicit backwards compatibility |
| `--explore-options` | Trigger options exploration before execution planning | Architectural decisions, technology selection, multiple viable paths |

You can combine flags:

```bash
claude --agent dungeonmaster --no-worktree --explore-options
```

## Backwards Compatibility

This feature is **fully backwards compatible**:

- Sessions without `--no-worktree` automatically get worktree isolation
- Sessions with `--no-worktree` behave exactly like pre-worktree DM sessions
- Existing workflows are unaffected
- The `.worktrees/` directory is already gitignored

## Troubleshooting

### "Branch already exists" Error

If you see this error during worktree creation:

```
fatal: 'dm/add-oauth-login' already exists.
```

**Solution:** The branch already exists from a previous session. Either:

1. Delete the stale branch: `git branch -D dm/add-oauth-login`
2. Use `--no-worktree` to operate in the main tree for this session
3. Start a new session with a different task description

DungeonMaster retries with a numeric suffix (e.g., `dm/add-oauth-login-2`) after 3 attempts before falling back to the main working tree.

### Stale Worktrees After Crash

If a session crashes before Phase 5:

```bash
# List orphaned worktrees
git worktree list

# Remove the orphaned worktree
git worktree remove .worktrees/dm-crashed-task

# Clean up references
git worktree prune
git branch -D dm/crashed-task
```

### Worktree on Wrong Branch

If you manually switch branches within a worktree, git may confuse the worktree state. To fix:

```bash
# Check current state
git worktree list

# Remove and recreate the worktree (Phase 0 will handle this next session)
git worktree remove .worktrees/dm-corrupted-task
git worktree prune
```

### Merge Conflicts When Merging Manually

If you merge your worktree branch to main and encounter conflicts:

1. Worktree is preserved at `.worktrees/dm-{task}/`
2. Resolve conflicts manually:

   ```bash
   cd .worktrees/dm-{task}
   git diff main
   # Resolve conflicts manually
   git add .
   git commit -m "Resolve merge conflicts"
   cd ../..
   git checkout main
   git merge --no-ff dm/{task}
   ```

3. Clean up when ready:

   ```bash
   git worktree remove .worktrees/dm-{task}
   git branch -d dm/{task}
   ```

## Design Rationale

Worktree isolation was introduced to solve a critical limitation: multiple concurrent DungeonMaster sessions on the same repository would conflict over:

- **Shared git working tree:** Both sessions modify the same files simultaneously
- **Shared branch:** Both sessions try to checkout different branches, causing confusion
- **Shared plans/ directory:** Both sessions try to write plans to the same files

Git worktrees provide a lightweight solution:

- Each worktree has its own working directory
- Each worktree can be on a different branch
- Worktrees share git object storage (efficient)
- Cleanup is simple: `git worktree remove`

This enables truly parallel development workflows where multiple issues can be worked on simultaneously without manual coordination.

## Best Practices

1. **Use descriptive task descriptions** so worktree branch names are meaningful
   - Good: "Add OAuth login with multi-factor authentication"
   - Bad: "Stuff"

2. **Monitor your worktrees** periodically

   ```bash
   git worktree list  # Check active worktrees
   git branch --list 'dm/*'  # List all DM branches
   ```

3. **Clean up worktrees after completion**
   - Stale worktrees consume disk space
   - `git worktree remove` is quick and safe

4. **Run `/open-pr`** to create a pull request when your branch is ready
   - The worktree stays active for feedback iteration after the PR is created
   - Delete the worktree when the PR is merged

5. **Merge manually** when you are confident the work needs no review
   - `git checkout main && git merge --no-ff dm/{slug}`
   - Then remove the worktree and branch manually

6. **Use `--no-worktree`** only for trivial changes
   - Most tasks benefit from worktree isolation
   - Only skip when explicitly needed (read-only work)

## Related Documentation

- [Agent Reference: Dungeon Master](/docs/AGENTS.md#dungeon-master---orchestrator) - Orchestration workflow details
- [Configuration Guide](/docs/CONFIGURATION.md) - Setup and installation
- [Review Workflow](/docs/adrs/REVIEW_WORKFLOW.md) - Quality gate and review process
