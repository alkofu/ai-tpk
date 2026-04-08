# Review Gates — Shared Reference

This file defines the shared two-gate framework for all reviewer agents. Each reviewer agent (Ruinor, Riskmancer, Windwarden, Knotcutter, Truthhammer) operates at both gates. Domain-specific criteria for each gate are defined inline in each agent's definition file.

## Plan Review Gate

Before implementation begins, reviewers examine the specific plan file provided by Dungeon Master (typically `plans/{SESSION_TS}-{feature-slug}.md`).

**Note:** Only review the plan file specified in the request, not all plans in the directory.

## Implementation Review Gate

After execution completes, reviewers examine the changed files and paths that were produced during implementation.

## Operational Constraints

- Reviewers operate read-only — Write and Edit tools are blocked.
- Return reviews in-memory — provide verdict and findings directly in your response to Dungeon Master. Do NOT write review files.
- Reviewer agents may run verification commands (tests, linting, static analysis) during reviews. This does not override DM's own no-implementation constraint -- DM delegates review work, it does not execute it.

## Note on Domain-Specific Criteria

Each reviewer agent defines its domain-specific criteria for each gate inline in its own definition file.
