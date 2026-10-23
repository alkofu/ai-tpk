# Intake Gate Delegation Templates

These two templates are used by DM in the Phase 1 Intake Gate. Each has a labeled subsection below.

## Askmaw Intake Template

(The first four lines of the template below are the canonical Worktree Context Block — see `claude/references/worktree-protocol.md` § Canonical Worktree Context Block Template for the source of truth. Per the format-change protocol defined in that subsection, do not edit these lines in isolation; if the canonical format changes, update the subsection first, then update every consumer site in lockstep.)

```
WORKING_DIRECTORY: {WORKTREE_PATH}
WORKTREE_BRANCH: {WORKTREE_BRANCH}
REPO_SLUG: {REPO_SLUG}
All file operations and Bash commands must use this directory as the working root.

Apply the clarify skill to the request below: scan the code, restate the task, and return either one batch of `## Intake Questions` or the `## Task Brief`.

## Original Request
"{raw request text, verbatim}"

## Intake Answers
{Only on the second (or follow-up) invocation: each question you asked, verbatim, with the user's answer. Omit this section on the first invocation.}

## Instructions
{First invocation: "Return the Task Brief if the task is already clear; otherwise return every clarifying question in one batch."}
{Second invocation: "Return the Task Brief. Return one follow-up batch only if an answer opened a new gap about intent."}
{Follow-up invocation: "Return the Task Brief now; list anything still open under Assumptions."}
{If the user said "just do it" or equivalent: "The user declined clarification. Return a best-effort Task Brief with every assumption listed."}
```

## Pathfinder Handoff Template (When Brief Is Ready)

(The first three lines of the template below are a partial Worktree Context Block — see `claude/references/worktree-protocol.md` § Canonical Worktree Context Block Template for the source of truth. The trailing scope sentence is intentionally omitted in this template. Per the format-change protocol defined in that subsection, do not edit these lines in isolation; if the canonical format changes, update the subsection first, then update every consumer site in lockstep.)

```
WORKING_DIRECTORY: ...
WORKTREE_BRANCH: ...
REPO_SLUG: ...

The following Task Brief was produced by Askmaw after the user answered all clarifying questions. Treat it as settled requirements input (Section 3): do not re-ask anything it covers. Return an `## Option Question` only for a real fork between implementation approaches or an intent gap the brief missed.

{Askmaw's Task Brief, verbatim}

[Rest of Pathfinder delegation as normal]
```
