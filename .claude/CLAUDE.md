# Project Instructions — ai-tpk

## Scope Clarification (Mandatory)

This repository has two scopes for Claude Code artifacts. Before creating or modifying any of the artifact types listed below, you MUST ask the user which scope they intend:

| Scope | Directory | Effect |
|-------|-----------|--------|
| **User scope** | `claude/` | Synced by install.sh to `~/.claude/` -- applies globally across all repos |
| **Repo scope** | `.claude/` | Applies only to this repository |

### When to ask

Before performing any of these actions, stop and ask: **"Repo scope (`.claude/`) or user scope (`claude/`)?"**

- Creating or modifying an **agent** (user scope: `claude/agents/` vs repo scope: `.claude/agents/` — repo-scope agents directory does not exist yet)
- Creating or modifying a **skill** (user scope: `claude/skills/` vs repo scope: `.claude/skills/`)
- Creating or modifying a **command** (user scope: `claude/commands/` vs repo scope: `.claude/commands/` — repo-scope commands directory does not exist yet)
- Creating or modifying a **hook** (user scope: `claude/hooks/` vs repo scope: `.claude/hooks/` — repo-scope hooks directory does not exist yet)
- Creating or modifying a **reference** (user scope: `claude/references/` vs repo scope: `.claude/references/` — repo-scope references directory does not exist yet)
- Modifying **CLAUDE.md** (`claude/CLAUDE.md` is the user-scope source; `.claude/CLAUDE.md` is project-scope)
- Modifying **settings** (user scope: `claude/settings.json`; project-shared: `.claude/settings.json` — does not exist yet; project-local: `.claude/settings.local.json` — already exists, untracked)

### Rules

1. **Ask first, act second.** Never assume the scope. The question takes five seconds; fixing a misplaced artifact takes much longer.
2. **Show the concrete paths.** When asking, include the actual directory paths so the user can confirm without needing to remember the mapping.
3. **For artifact types that only exist in user scope today** (agents, commands, hooks, references): still confirm intent, because the user may want to create a repo-scope equivalent or may be confused about where the artifact will land.
4. **Do not skip this step** even if the user's request seems to imply a scope. Explicit confirmation prevents mistakes.

## Repository Design Intent (Mandatory Context)

This repository is a **clone → run → forget** tool.

The workflow is:
1. User clones the repo
2. User runs `install.sh`
3. `install.sh` copies the contents of `claude/` (agents, skills, commands, hooks, references, settings, CLAUDE.md) to `~/.claude/`, and `src/wrappers/` to `~/.claude/wrappers/`. It also registers MCP servers. Additional harnesses may be supported in future.
4. The installed artifacts are fully self-contained — they carry no references back to the repo. The repo may be retained for future updates (re-run `install.sh` after `git pull`), but this is optional.

**Critical implication for all changes:** The installed artifacts carry **no back-references to this repository**. Once copied, they are standalone files at their destination. Any change you make must therefore be complete and self-contained within the artifact itself — do not add relative paths, symlinks, or runtime references that assume the repo still exists on disk.

This self-containment constraint applies to everything `install.sh` installs — the contents of `claude/` and `src/wrappers/`. It does **not** apply to repo-scope artifacts in `.claude/`, which are only active when the repo is checked out. When reviewing or authoring any artifact in `claude/` or `src/wrappers/`, always ask: *"Will this work correctly after being copied to its destination with no repo present?"*
