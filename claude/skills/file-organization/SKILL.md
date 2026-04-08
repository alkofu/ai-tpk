---
name: file-organization
description: Guide for sensible file and module organization. Use when designing file structure for a new feature, deciding whether to split or merge files, refactoring a large file, or evaluating whether a new file is justified.
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
