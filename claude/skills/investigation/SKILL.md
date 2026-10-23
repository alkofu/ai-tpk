---
name: investigation
description: >
  Evidence-first, read-only method for open-ended "why is this broken?" questions: restate the symptom, gather code and runtime evidence (logs, metrics, Kubernetes state via available MCP tools), form 1-3 grounded hypotheses, test them read-only, and produce a Diagnostic Report with root cause or an explicit "inconclusive". Use when a bug, failure, or unexpected behavior has no known cause yet — before planning or fixing — in a plain session, inside `wayblade`, or as the methodology preloaded into the Tracebloom agent.
---

# Investigation

Use this skill when the question is "why doesn't X work as expected?" and the cause is not yet known. Investigation comes **before** any plan or fix. If the cause is already known, skip to the `planning` or `implementation-discipline` skill.

This skill is caller-agnostic. In a plain session or `/wayblade`, you run it yourself and then move on to fixing once the report is agreed. The Tracebloom agent applies the same method as an isolated, read-only investigator inside a Dungeon Master session — useful when log and metric output would otherwise flood the main context.

## Ground rules

- **Read-only until the report is done.** Do not edit files, run write-bearing commands (builds, installs, state-modifying tests, git writes), or start fixing mid-investigation. If confirming a hypothesis needs a write-bearing command, stop and say so in the report instead of running it.
- **One focused question.** The investigation boundary is the reported symptom. Note adjacent anomalies in the report; do not pursue them.
- **Use the tools before asking the user.** If MCP tools for logs, metrics, or cluster state (e.g. Grafana/Loki/Prometheus, Kubernetes, CloudWatch, GCP Observability) or the `gh` CLI are available, use them. Never ask the user to fetch data a tool can retrieve. If they are unavailable, record that as a limit on completeness.

## Protocol

Work in sequence; do not skip steps.

### 1. Understand the question

Restate the symptom precisely. Define what "working as expected" means for the affected system and where the boundary lies between the symptom and the surrounding system. Do not start gathering until the question is well-formed.

### 2. Gather context

Read relevant files, grep for error messages and related patterns, check recent git history in the affected area, and examine configuration. Keep an investigation log of what was examined and what was found — it feeds the report.

For runtime symptoms, query available observability tools (logs, metrics, resource state), picking the environment or cluster that matches the affected system. Do not move on until one of these holds:

- (a) external data (logs, metrics, or resource state) has been collected and logged
- (b) the symptom does not warrant infrastructure queries — state why in one sentence
- (c) the tools are confirmed unavailable — note it as a completeness limit

When the symptom has PR, CI run, or issue context, use `gh` to gather it.

### 3. Form hypotheses

Form 1–3 ranked hypotheses, each grounded in a specific observation. For each, state the supporting evidence and what would confirm or rule it out.

### 4. Test hypotheses

For each hypothesis, run a read-only test that confirms or rules it out and record the result. Narrow down until one is confirmed or all are ruled out.

### 5. Produce the Diagnostic Report

Synthesize findings into the report below, then stop.

## Diagnostic Report

Every investigation ends with a report containing all five fields:

1. **Symptom** — the problem restated precisely after investigation
2. **Investigation summary** — what was examined and what was found at each step
3. **Root cause** — the identified cause, or "Inconclusive — {what was ruled out and what remains unknown}"
4. **Evidence** — specific file paths, line numbers, log entries, metric results, git commits, or configuration values supporting the diagnosis. For runtime symptoms (service failures, performance degradation, unexpected runtime behavior), include at least one external data source — code-only evidence is insufficient.
5. **Recommended next action** — e.g. plan a fix, the fix is trivial and can be implemented directly, investigate further with a specific focus, or no bug found because {reason}

When the root cause is inconclusive, present the findings and ask how to proceed.

## Anti-patterns

- **Scope creep** — investigating tangential issues beyond the question asked.
- **Premature diagnosis** — declaring a root cause before evidence confirms or eliminates the candidates. A hypothesis is not a diagnosis.
- **Hypothesis without external data** — reasoning from code alone when runtime data sources were available. Code analysis finds candidates; logs and metrics confirm or rule them out.
- **Fix drift** — sliding from investigation into designing the fix. The report recommends a next action, not a solution design.
- **Write temptation** — editing files or running write-bearing commands during the investigation.
