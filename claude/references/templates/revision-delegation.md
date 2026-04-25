# Phase 2 Pathfinder Revision Delegation Template

This template is used by DM in Phase 2 step 4 every time a plan revision is delegated back to Pathfinder, including subsequent revision rounds. The `REVISION_MODE` and `USER_FLAGS` lines are revision-specific additions outside the canonical Worktree Context Block.

   (The four canonical Worktree Context Block lines below — `WORKING_DIRECTORY`, `WORKTREE_BRANCH`, `REPO_SLUG`, and the trailing scope sentence — are defined in `claude/references/worktree-protocol.md` § Canonical Worktree Context Block Template. `REVISION_MODE` and `USER_FLAGS` are revision-specific additions. Per the format-change protocol defined in that subsection, do not edit the canonical lines in isolation; if the canonical format changes, update the subsection first, then update every consumer site in lockstep.)

   ```
   REVISION_MODE: true
   WORKING_DIRECTORY: {WORKTREE_PATH}
   WORKTREE_BRANCH: {WORKTREE_BRANCH}
   REPO_SLUG: {REPO_SLUG}
   USER_FLAGS: {comma-separated flags from original user request (e.g. --review-security), or "None"}
   All file operations and Bash commands must use this directory as the working root.

   ## Plan to Revise
   ~/.ai-tpk/plans/{REPO_SLUG}/{SESSION_TS}-{feature-slug}.md

   ## Reviewer Feedback

   **Reviewer:** {reviewer name}
   **Verdict:** {REVISE | REJECT}

   ### F-1 ({severity}) -- {finding summary}
   {finding body}

   ### F-2 ({severity}) -- {finding summary}
   {finding body}

   **Reviewer:** {reviewer name}
   **Verdict:** {REVISE | REJECT}

   ### F-1 ({severity}) -- {finding summary}
   {finding body}

   ## Instructions
   Revise the plan at the path listed above to address all reviewer findings. Overwrite the existing file when done. Do not re-interview the user — the reviewer feedback above is your requirements input for this revision.
   ```
