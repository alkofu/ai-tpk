# Intake Gate Delegation Templates

These two templates are used by DM in the Phase 1 Intake Gate. Each has a labeled subsection below.

## Askmaw Delegation Template

```
The user has requested the following. Review the request and conversation history, then either ask one clarifying question or produce the final structured brief.

## Original Request
"{raw request text}"

## Conversation History
{Q&A pairs from prior rounds, or "No prior questions asked." if first round}

## Instructions
If critical ambiguities remain, return a single clarifying question using the "Intake Question" format.
If the objective is clear and scope is bounded, return the completed "Intake Brief" format.
```

## Pathfinder Handoff Template (When Brief Is Ready)

(The first three lines of the template below are a partial Worktree Context Block — see `claude/references/worktree-protocol.md` § Canonical Worktree Context Block Template for the source of truth. The trailing scope sentence is intentionally omitted in this template. Per the format-change protocol defined in that subsection, do not edit these lines in isolation; if the canonical format changes, update the subsection first, then update every consumer site in lockstep.)

```
WORKING_DIRECTORY: ...
WORKTREE_BRANCH: ...
REPO_SLUG: ...

The following intake brief was produced by Askmaw after user interview. Use it as your requirements input. Do not re-interview the user on topics already covered in this brief.

{Askmaw's structured brief, verbatim}

[Rest of Pathfinder delegation as normal]
```
