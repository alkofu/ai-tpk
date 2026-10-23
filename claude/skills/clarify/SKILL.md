---
name: clarify
description: >
  Front-loaded task intake: before any planning, do a short code scan, restate the task, and ask every clarifying question in one batch so the user answers once and the rest of the delivery runs without check-ins. Produces a Task Brief (objective, scope, answers, assumptions, code pointers) that planning starts from. Use at the start of any constructive task whose goal, scope, or done-criteria could reasonably be read more than one way — in a plain session, inside `wayblade`, or as the methodology preloaded into the Askmaw agent.
---

# Clarify

Use this skill at the very start of a constructive task, before planning. Its job is to make the task **clear**: after it, planning should only ever need to ask about a genuine choice between implementation approaches (see the `planning` skill), never about what the user wants.

The user's working model: give a task, answer all clarifying questions at once, and ideally see a PR next. So ask **everything up front, in one batch**, and nothing about intent afterwards.

This skill is caller-agnostic. In a plain session or `/wayblade`, you run it yourself and ask the user directly. The Askmaw agent applies the same method inside a Dungeon Master session — it keeps the code scan out of DM's context and returns either the question batch or the brief, and DM relays the questions.

## 1. Scan the code (short)

Spend a few minutes, not an investigation, finding *what* is involved and *where*: the files, modules, commands, or configs the request touches, and any existing behaviour or convention the request would change. Use Grep/Glob/Read.

The scan has two purposes only:

- **Never ask the user about codebase facts.** "Where is the auth code?", "Do we already have a retry helper?" are lookups, not questions.
- **Spot real ambiguity.** A request often looks clear until the code shows two places it could apply, an existing behaviour it would break, or a convention it would contradict.

Do not design the solution here; that is planning's job. Record useful pointers (paths, the existing pattern to follow) for the brief.

## 2. Restate the task

Write a one-sentence objective in your own words, plus what is in and out of scope as you understand it. If you cannot write that sentence without "or", the task is ambiguous and the ambiguity is your first question.

## 3. Decide what to ask

Ask only questions whose answer changes **what gets built** or **when it is done**:

- **Objective** — which of several plausible readings is meant
- **Scope** — is X in or out, when it matters for the result
- **Constraints** — compatibility, rollout, performance, or organizational limits the code cannot tell you
- **Preferences** — a user-visible behaviour or trade-off with no single right answer
- **Done** — how the user will judge it finished, when that is not obvious

Do **not** ask:

- anything the request, earlier conversation, or code scan already answers;
- how to implement it, when one approach is clearly right (planning decides);
- a choice between implementation approaches that needs deeper research to even frame — leave it to planning, which asks once if it turns out to be a real fork;
- "are you sure?" or confirmation of what the user just said.

**The task is clear — ask nothing — when** the objective has one reading, the scope is bounded (or the user declined to bound it), and no remaining gap would make a reasonable implementer build the wrong thing. Do not fish for detail to be thorough; most tasks need zero to three questions.

## 4. Ask everything in one batch

- Put **every** question into one round. With `AskUserQuestion` (at most 4 questions per call), send further calls back to back with nothing in between, so it still reads as one round.
- Give each question concrete options and mark the one you would pick as recommended, so a "yes, the recommended ones" answer is enough.
- Wait for the answers. Do not start planning or editing while questions are open.
- **No second round about intent.** If an answer opens a new gap, ask about it right away in the same exchange; never come back about intent after planning has started.

**"Just do it" / "skip the questions"** (or any equivalent): ask nothing. Use your best reading of the request and list every assumption in the brief, so it can be surfaced in the PR.

## 5. Produce the Task Brief

```markdown
## Task Brief

**Objective:** {one sentence}

**Scope:**
- In: {bullets}
- Out: {bullets, or "not established"}

**Answers:** {each question and the user's answer, or "No questions were needed."}

**Constraints and preferences:** {from the answers or the request, or "None stated"}

**Done when:** {how completion will be judged}

**Assumptions:** {anything inferred rather than stated — required when clarification was skipped}

**Code pointers:** {paths and existing patterns found in the scan}

**Raw request:** {the original request, verbatim}
```

In a plain session or `/wayblade`, keep the brief in the conversation (a short version is fine for a small task) and continue straight into the `planning` skill. Planning treats the brief as settled and does not re-ask anything it covers.
