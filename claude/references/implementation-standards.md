# Implementation Standards — Shared Reference

This file defines three behavioral norms shared across implementation, planning, and review agents. It is the canonical source for these norms. Agents may elaborate on these norms in their own definition files, but do not restate them independently.

## Minimal Diff

Change only what is necessary to accomplish the task. Do not reformulate unrelated code, rename variables out of scope, or adjust formatting in untouched regions. A correct change that is larger than necessary is not fully correct.

Applies to: Bitsmith (implementation), Ruinor (baseline review), Knotcutter (complexity review).

## No Over-Engineering (YAGNI)

Implement what the plan specifies. Do not add abstractions, generalization, configuration options, or extension points that are not explicitly required by the current task. Build for the specific problem at hand, not hypothetical future cases. Require demonstrated duplication (3+ instances) before abstracting.

Applies to: Bitsmith (implementation), Ruinor (baseline review), Knotcutter (complexity review with specialist depth).

## Test-First Protocol

When a plan step is annotated with `**test-first:** true`, write a failing test (RED) before implementing. The test must fail before implementation begins. If a failing test cannot be written without partial scaffolding (e.g., the type or interface under test does not yet exist), create the minimal stub first, then write the failing test, then implement. If no test infrastructure exists for the artifact type, document why and proceed; do not skip silently.

Applies to: Bitsmith (implementation), Pathfinder (annotates test-first steps in plans), Ruinor (verifies test-first was followed), Knotcutter (complexity review).

## Applies To

Bitsmith (implements these norms), Pathfinder (annotates test-first steps), Ruinor (reviews against these norms), Knotcutter (reviews against these norms with specialist depth).
