# Worktree Creation Subroutine

<!--
Note on heading structure: the H1 (`# Worktree Creation Subroutine`) above and
the first H2 (`## Worktree Creation Subroutine`) below are intentionally
identical. The H2 must exactly match the pointer anchor used by
`claude/agents/dungeonmaster.md` (which says
"§ Worktree Creation Subroutine"), so the H1/H2 duplication is by design.
-->

This reference is paged in by DM at the moment a routing branch in `claude/agents/dungeonmaster.md` invokes the Worktree Creation Subroutine. It contains the full subroutine procedure and the Branch Name Derivation rule used by the investigative-pipeline fix-bound routing branches.

## Worktree Creation Subroutine

This subroutine is **invoked explicitly** by routing branches in this section that require a worktree. It is **not** a checkpoint — it does not run automatically. Each routing branch below states whether it invokes the subroutine. Branches that do not invoke it (the advisory branches) produce sessions with no worktree.

**When invoked, perform the following steps in order:**

1. **Derive branch name:**

   **Part (a) — DM judgment (prefix inference):** Infer the conventional-commit type prefix from the nature of the request: use `feat/` for new features, `fix/` for bug fixes, `refactor/` for refactoring, `chore/` for maintenance/config/tooling, `docs/` for documentation-only changes, `test/` for test-only changes. The following are prefix-inference illustrations only — they show how to map request intent to a prefix type, not the exact slug the script will emit:
   - "Add OAuth login" → infer `feat` → script produces `feat/add-oauth-login`
   - "Resolve null pointer in auth" → infer `fix` → script produces `fix/resolve-null-pointer-in-auth`
   - "Simplify cache layer" → infer `refactor` → script produces `refactor/simplify-cache-layer`

   If the request is ambiguous, use `chore/session-{YYYYMMDD-HHmmss}` (local time) as `{branch-name}` and skip the slugify call below.

   **Part (b) — mechanical transform (script call):** Call `bash ~/.claude/scripts/slugify.sh "<description>" "<prefix>"` and capture stdout as `{branch-name}`. The script handles lowercasing, character normalization, hyphen collapsing, and the 60-character cap on the full composed branch name.

   On a non-zero exit, handle by exit code:
   - Exit 2 (programmer error — empty arg passed): do NOT silently fall back. Abort with a clear error message to the user explaining the argument was empty.
   - Exit 3 or 4 (data error — pathological prefix or empty slug): fall back to `chore/session-{YYYYMMDD-HHmmss}` and warn the user.

   The `{branch-slug}` used in `WORKTREE_PATH` (step 2) is the portion of `{branch-name}` after the final `/`, with any remaining `/` replaced by `-` to keep the path segment flat (e.g., `{branch-name}` = `feat/add-oauth-login` → `{branch-slug}` = `add-oauth-login`, so `WORKTREE_PATH` = `{REPO_ROOT}/.worktrees/add-oauth-login`).

2. **Delegate worktree creation to Bitsmith** (DM's Bash is read-only scoped; `mkdir` and `git worktree add` are write operations):

   ```
   REPO_ROOT=$(git rev-parse --show-toplevel)
   REPO_SLUG=$(basename "${REPO_ROOT}")
   WORKTREE_PATH="${REPO_ROOT}/.worktrees/{branch-slug}"
   mkdir -p "$(dirname "${WORKTREE_PATH}")"
   git worktree add "${WORKTREE_PATH}" -b {branch-name} HEAD
   mkdir -p "$HOME/.ai-tpk/plans/${REPO_SLUG}"
   ```

3. **Handle branch collisions:** If `git worktree add` fails because the branch already exists, retry with a numeric suffix (`feat/add-oauth-login-2`, then `-3`). After 3 failures, fall back to main working tree and warn the user.

4. **Set session context:** The DM carries `WORKTREE_PATH`, `WORKTREE_BRANCH`, `SESSION_TS`, `SESSION_SLUG`, and `REPO_SLUG` in its conversation memory (the LLM's context window) and explicitly includes them in every delegation prompt to sub-agents for the remainder of the session. No external storage mechanism is needed or used. If a session is interrupted and context is lost, run `git worktree list` to recover `WORKTREE_PATH` and `WORKTREE_BRANCH`. Inspect `~/.ai-tpk/plans/{REPO_SLUG}/` to recover `SESSION_TS` and `SESSION_SLUG` from the plan filename. Recover `REPO_SLUG` via `basename $(git rev-parse --show-toplevel)`. If a prior worktree's variables are present in conversation memory (e.g., from a session that ended with `/open-pr` rather than `/merged`), overwrite them with the new values — the DM never tracks multiple active worktrees simultaneously.

5. **Log to user:** "Session worktree created: `{WORKTREE_PATH}` on branch `{branch-name}`"

**After the subroutine completes, control returns to the routing branch that invoked it.**

## Branch Name Derivation for the Deferred Subroutine

**Branch name derivation for the deferred subroutine** (used by the two fix-bound routing branches in step 2 above): when invoking the Worktree Creation Subroutine post-investigation, derive `{branch-name}` from the Diagnostic Report's root cause rather than the user's original reported symptom. Specifically:

a. **Extract a short fix-essence string** from the Diagnostic Report's `Root cause` field. The fix-essence is the noun phrase or short clause describing the *thing being fixed*, stripped of clarifying clauses, file paths, and explanatory context. Aim for 4–8 words that capture what is wrong. Examples:
- Root cause: *'Worker pool size set to 0 in `config/production.yaml` due to a merge conflict marker'* → fix-essence: *'worker pool size zero'*
- Root cause: *'Full-table scan on `items` table — the `tags` column used in the search filter has no index'* → fix-essence: *'items tags column missing index'*
- Root cause: *'Race condition in session token refresh causes intermittent 401s'* → fix-essence: *'session token refresh race'*

Pre-extracting the fix-essence avoids relying on the slugify script's 60-character cap to truncate long root-cause sentences (which would produce noisy or misleading branch names). If a clean fix-essence cannot be extracted in 4–8 words, fall back to the conventional `chore/session-{YYYYMMDD-HHmmss}` slug used elsewhere in the Worktree Creation Subroutine.

b. **Slugify the fix-essence.** Pass the fix-essence string as the `<description>` argument to `bash ~/.claude/scripts/slugify.sh` and infer the `<prefix>` as `fix/` (the investigative pipeline always produces a fix). The 60-character cap still applies but should not be hit for a well-formed 4–8-word fix-essence.

c. **All other steps of the Worktree Creation Subroutine (collision handling, session context, log message) apply unchanged.**

d. **User scope adjustments do not alter the branch name.** If the user supplied scope adjustments at the Premise Check, those adjustments are appended to the Pathfinder handoff (per step 3d) but the branch is named from the original root cause's fix-essence.
