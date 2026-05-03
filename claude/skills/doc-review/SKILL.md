---
name: doc-review
description: Methodology for detecting documentation gaps in a codebase, used during gap-analysis phases to produce a structured, severity-tiered list of missing or inaccurate user-facing documentation.
---

# Doc Review

Use this skill whenever a gap-analysis phase requires a systematic audit of project documentation against current source code or recent changes.

## Goal

This skill produces a structured list of documentation gaps, each tiered by severity (critical, important, or polish), with false-positive suppression applied before reporting. It covers how to discover in-scope documentation, what to compare it against, which categories of gap to inspect, how to tier findings, and which apparent gaps to suppress.

The skill does not write or fix documentation. That is the caller's responsibility. The only output is an in-session structured report; no files are written to disk as part of applying this skill.

## Discovery

Before analyzing gaps, enumerate all in-scope documentation and the context the documentation should describe.

**Where to look for user-facing documentation:**
- Top-level files matching `README*`, `CHANGELOG*`, `CONTRIBUTING*`, `LICENSE*`, `NOTICE*`, `CODE_OF_CONDUCT*`
- All files under `docs/`, `examples/`, and `tutorials/` trees
- Any other `*.md` files the caller deems user-facing (e.g., a `QUICKSTART.md` or `MIGRATION.md` at the repo root)

**What to exclude from the documentation set:**
Operational `.md` files are tool artifacts, not user documentation, and must be excluded from both the "existing docs" inventory and the gap analysis. Excluded categories include: agent prompts (e.g., `claude/agents/*.md`), skill bodies (e.g., `claude/skills/**/*.md`), command definitions, hook documentation, reference material, and CI/CD or GitHub templates (e.g., `.github/**/*.md`). This mirrors the inclusion/exclusion logic used by planning agents for documentation-primary classification.

**Context the documentation should describe — gather from:**
- Recent code changes: `git log` summaries or a diff against a caller-supplied baseline commit or branch
- Public API surface: exported symbols, HTTP route definitions, CLI entry points, and configuration schemas (environment variables, config file keys)
- Any feature summary or change description supplied by the caller

## Four Analysis Areas

Apply each of the following four checks across all in-scope documentation.

**1. Coverage**
Identify features, endpoints, configuration options, or commands that exist in code but are not mentioned in any user-facing document. Evidence of a coverage gap: a public export with no corresponding doc entry, a CLI subcommand absent from the README, a new required environment variable with no mention in setup instructions, or an HTTP route not listed in the API reference.

**2. Accuracy**
Identify documented behaviour that contradicts current code. Common signals: a code example that references a renamed or removed function, an outdated command signature, a documented flag that no longer exists, a version number in a tutorial that no longer matches the current release, or a described default value that has changed.

**3. Discoverability**
Identify documentation that exists but cannot be found via a logical navigation path. Evidence: an orphan Markdown file not linked from `README.md` or any table of contents, a broken or missing cross-link between two related docs, a feature described in `docs/` but not mentioned anywhere in the top-level `README.md`.

**4. Onboarding Readability**
Identify gaps that block a new reader from getting started. Evidence: missing prerequisites (required tools, accounts, or permissions not listed), unexplained terminology (jargon used before it is defined), missing or incomplete setup or quickstart steps, or no worked example for a non-trivial feature that new users are likely to encounter first.

## Three Finding Tiers

Assign every reported finding one of the following tiers before including it in the output.

**Critical**
Gaps that block correct use of the project — a reader following the documentation will either fail to complete a task or produce a wrong result. Example: a new required configuration field is not documented, so a user who follows the setup guide will encounter a runtime error with no guidance.

**Important**
Gaps that significantly degrade the documentation experience but do not prevent a determined reader from eventually succeeding. Example: a newly added feature exists in code but is entirely absent from the documentation, or a tutorial example calls a function that has been renamed, causing copy-paste failures.

**Polish**
Minor improvements that would improve quality but do not meaningfully block any reader. Example: a missing cross-link between two related sections, or a heading that uses an outdated product name. Polish-tier findings are reported in the output but should be batched and may be deferred to a dedicated cleanup pass.

## False-Positive Suppression

Apply the following rules before promoting any finding to the output. If a candidate gap is excluded by any rule below, do not report it.

1. **Operational files are not user documentation.** Agent prompts under `claude/agents/`, skill bodies under `claude/skills/`, command definitions under `claude/commands/`, hook documentation under `claude/hooks/`, reference material under `claude/references/`, and GitHub templates under `.github/` are tool artifacts. Do not flag these as missing or outdated user documentation.

2. **Internal code identifiers are not documentation gaps.** A function, type, constant, or class that is not exported, not part of a CLI or HTTP surface, and not referenced by configuration is intentionally internal. Do not generate a "missing documentation" finding for it.

3. **Generated files are not documentation gaps.** Lockfiles, build outputs, and machine-managed sections of dependency manifests are not documentation. Do not flag their absence from docs.

4. **Declared non-goals are not gaps.** When the project explicitly states a non-goal — in a `NON-GOALS.md` file, an "out of scope" section in `README.md`, a constitution principle, or a similarly authoritative location — do not flag the absence of coverage for features or behaviors listed there.

5. **Apply the reasonable-new-user test before escalating tier.** Before promoting a finding to Critical or Important, ask: "Would a reasonable new user notice this gap and be blocked by it?" If the answer is no, downgrade the finding to Polish or suppress it entirely.

## Output Expectations

After applying discovery, all four analysis areas, all three tiers, and false-positive suppression, produce a structured in-session report with the following shape:

- Group findings first by tier (Critical → Important → Polish), then by analysis area within each tier.
- Each finding entry must include:
  - The specific file path (and, where possible, line range) where the gap was detected or where documentation should exist.
  - A one-line description of the gap.
  - A one-line suggested remediation.

The skill does not itself write to disk. The report is produced in-session and the caller (such as Quill) is responsible for acting on the findings and producing or updating documentation files based on them.
