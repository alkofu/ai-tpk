---
name: file-organization
description: Guide for sensible file and module organization. Use when designing file structure for a new feature, deciding whether to split or merge files, refactoring a large file, evaluating whether a new file is justified, deciding whether to create a new directory, choosing where test files should live, or naming a new directory.
---

# Sensible File Organization

Use this skill both when writing new code and when refactoring existing code.

## Goal

Create a small number of cohesive files with clear responsibilities. Avoid both extremes:
- **Too few**: one oversized file that mixes unrelated concerns
- **Too many**: a forest of tiny files with no individual file having enough context to be readable alone

## Before You Write

For any work spanning more than one new file or requiring a new directory, **propose the file structure first** — a short sketch prevents restructuring later. Skip this for single-file changes.

## Rules

**1. One responsibility per file.** A file's contents should be describable in one sentence without using "and." If you can't do that, it's probably doing too much.

**2. Bias toward fewer files.** Prefer 3–5 files per feature area; treat 7 as a soft ceiling. Beyond that, question whether the abstraction is helping or just hiding things.

**3. Create a separate file only when the code is:**
- A distinct responsibility (fails the one-sentence test)
- Reused in two or more places
- Independently testable with its own test file
- Likely to grow significantly on its own

**4. Otherwise, keep it together.** Private, tightly coupled helpers belong alongside the code they support. Don't create a file for a one-line wrapper, a single-use constant, a trivial pass-through, or anything that's "just re-exporting X."

**5. When editing a large existing file**, extract only where the boundary is obvious. If you can't name the new file without hedging, the boundary isn't clear enough yet.

## After Changes

Always explain why each file exists and why further splitting isn't needed. This is a forcing function against over-engineering.

**Example:**
> `auth.ts` — session creation and validation  
> `auth.types.ts` — shared types used by both auth and middleware  
> No separate `auth.utils.ts` because all helpers are private to `auth.ts` and have no reuse candidates

## Directory Structure

A directory should represent a coherent responsibility boundary, not just a naming convenience.

**Create a new directory when:**
- A group of 3 or more files share a responsibility that is clearly distinct from the parent directory's responsibility
- A sub-domain is large enough that it will grow independently (e.g., `auth/`, `billing/`, `notifications/`)
- The group needs its own configuration, types, or utilities that would pollute the parent directory

**Do NOT create a new directory when:**
- You have 1–2 files that would fit comfortably in the parent
- The new directory would immediately need to be flattened (e.g., `utils/string-utils/` containing one file)
- The name describes an implementation detail rather than a domain concept — avoid `helpers/`, `misc/`, `common/`, `utils/` at the leaf level

When in doubt, prefer a flat structure and a new file over a new directory. You can always extract a directory later; removing a directory that turned out unnecessary is disruptive.

## Test File Placement

**Default: co-located tests** — place `*.test.ts` (or `*.spec.ts`) next to the source file they test.
- Benefit: immediately obvious that a source file has tests; changes to source and test happen in the same directory; no parallel directory tree to maintain
- Use this when: unit testing a single module with a 1:1 relationship between source file and test file

**Separate `tests/` directory** — only when:
- Tests require shared fixtures, factories, or setup files that are not specific to one source file
- Integration or end-to-end tests span multiple source modules and don't belong to any one of them
- The project's existing convention is a `tests/` directory — match what's already there; do not mix both patterns in the same feature area

If the project already uses one convention, continue it. Introducing a second test placement convention in an existing codebase requires an explicit decision and a note in CLAUDE.md.

## Naming Directories

A directory name passes the test if a reader scanning a file tree immediately understands its role without opening any file inside it.

**Good directory names:** describe the domain or responsibility (`auth`, `payments`, `graph`, `pipeline`)
**Poor directory names:** describe location or type (`utils`, `helpers`, `common`, `shared`, `misc`)

If you cannot name a directory without using a type-descriptor word, it is likely not a genuine responsibility boundary — reconsider whether the files belong in an existing directory instead.
