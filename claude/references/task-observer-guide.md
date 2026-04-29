# Task-Observer Patterns

This is an advisory reference. It is not a compliance gate. It collects recurring patterns
surfaced by past `/review-observations` cycles so that future observations can flag similar
issues earlier.

**Conflating monitoring with self-modification.** A skill that both detects problems and
autonomously rewrites itself creates an uncontrolled feedback loop. Keep the two phases
separate: observation is cheap and passive; editing is heavyweight and human-gated.

**Prose-encoded concurrency algorithms.** When a skill's write protocol reads like
`grep | sort | tail | increment | assert-no-collision | renumber-on-race`, it is a fragile
ad-hoc database. Replace it with a single atomic filesystem operation (temp-then-rename) plus
a namespaced filename.

**Confidentiality rules that fragment into many micro-cases.** Five-layer scrub pipelines are
hard to reason about and easy to extend inconsistently. Two layers — a mechanical hard-block
for named patterns plus a judgement catch-all — cover the important cases without creating
a false sense of completeness.

**Autonomous schedulers layered on top of an explicit user-invoked path.** Weekly timers and
seven-day fallbacks add complexity without adding safety. A single explicit trigger
(`/review-observations`) is easier to audit and requires no scheduler infrastructure.

**Dual-activation hacks to compensate for under-triggering.** Adding a mandatory CLAUDE.md
load on top of a skill description is a symptom: the description is not pushy enough. Fix the
description to trigger on the right phrases; do not bolt on a second activation mechanism.

If you spot a new recurring pattern during `/review-observations`, propose adding it here as
part of the same review.
