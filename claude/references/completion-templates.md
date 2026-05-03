# Completion Report Templates

These templates are referenced by `dungeonmaster.md` and command files. Each template is a verbatim markdown block — the DM must reproduce the template exactly, substituting only the `{placeholder}` values. Do not rearrange fields, rename labels, or omit lines (unless the template marks a line as conditional with "only when" or "omit if").

---

## Common Fields

These three fields appear at the end of Templates A, B, and C. Reproduce them verbatim, substituting placeholder values.

```
**Worktree:** `{WORKTREE_PATH}` on branch `{WORKTREE_BRANCH}` | skipped (no worktree)
**Token usage:** {input}k in / {output}k out / {cache_write}k cache-write / {cache_read}k cache-read | unavailable
**Next action:** {contextual directed-prompt suggestion, e.g., "Open a PR now? Reply /open-pr to proceed." or "Merge now? Reply /merge-pr to proceed."}
```

**Note on Template D:** Templates A–C reuse the Common Fields block verbatim. Template D uses a specialized subset (Token usage only) due to its post-cleanup context where the Worktree has already been removed and Next action is not applicable. The Worktree field is replaced by the more specific "Worktree removed" field in Template D.

---

## Template A — Constructive (`/feature`)

Used for constructive pipeline sessions (e.g., sessions driven by `/feature`).

```
## Completion Report — Constructive

**Goal:** {one-sentence goal}

**Plan:** {plan file path} — {created | revised (N rounds)}
**Plan review:** Ruinor {verdict} | Specialists: {list with verdicts, or "none invoked"} | Trigger: {Ruinor recommendation | user flag | keyword detection | N/A}
**Execution:** {N}/{M} steps completed | Files changed: {count}
**Validation:** {outcome — e.g., "all plan steps completed and passed Ruinor review" | "N steps skipped — see Risks"}
**Implementation review:** Ruinor {verdict} | Specialists: {list with verdicts, or "none invoked"}
**Reservations logged:** {no | yes — file path — resolved | yes — file path — unresolved}
**Documentation:** {updated by Quill (Phase 5b meta-update) | produced by Quill (Phase 3 primary writer, documentation-primary plan) | skipped (no planning session)}

**Worktree:** `{WORKTREE_PATH}` on branch `{WORKTREE_BRANCH}` | skipped (no worktree)
**Token usage:** {input}k in / {output}k out / {cache_write}k cache-write / {cache_read}k cache-read | unavailable
**Next action:** {contextual directed-prompt suggestion, e.g., "Open a PR now? Reply /open-pr to proceed." or "Merge now? Reply /merge-pr to proceed."}

**Risks / follow-ups:**
- {item, or "None identified"}
```

---

## Template B — Investigative (`/bug`)

Used for investigative pipeline sessions (e.g., sessions driven by `/bug`). Extends Template A with investigation fields at the top. The `Plan`, `Plan review`, and related fields support "skipped (trivial fix)" variants when Tracebloom routes directly to Bitsmith.

```
## Completion Report — Investigative

**Symptom:** {user-reported symptom, one sentence}
**Investigation:** Tracebloom — {root cause summary, one sentence} | Verdict: {route to Pathfinder | trivial fix | inconclusive | no bug found}

**Goal:** {one-sentence goal, derived from investigation}

**Plan:** {plan file path} — {created | revised (N rounds)} | skipped (trivial fix)
**Plan review:** Ruinor {verdict} | Specialists: {list with verdicts, or "none invoked"} | skipped (trivial fix)
**Execution:** {N}/{M} steps completed | Files changed: {count}
**Validation:** {outcome — e.g., "all plan steps completed and passed Ruinor review" | "N steps skipped — see Risks"}
**Implementation review:** Ruinor {verdict} | Specialists: {list with verdicts, or "none invoked"}
**Reservations logged:** {no | yes — file path — resolved | yes — file path — unresolved}
**Documentation:** {updated by Quill (Phase 5b meta-update) | produced by Quill (Phase 3 primary writer, documentation-primary plan) | skipped (no planning session)}

**Worktree:** `{WORKTREE_PATH}` on branch `{WORKTREE_BRANCH}` | skipped (no worktree)
**Token usage:** {input}k in / {output}k out / {cache_write}k cache-write / {cache_read}k cache-read | unavailable
**Next action:** {contextual directed-prompt suggestion, e.g., "Open a PR now? Reply /open-pr to proceed." or "Merge now? Reply /merge-pr to proceed."}

**Risks / follow-ups:**
- {item, or "None identified"}
```

---

## Template C — Operational PR (`/open-pr`)

Used after a pull request is successfully created by `/open-pr`.

```
## Completion Report — PR Opened

**PR:** #{number} — {title}
**URL:** {PR URL}
**Branch:** `{branch}` -> `main`
**Status:** draft | ready
**Checks:** validate-before-pr {passed | failed}

**Worktree:** `{WORKTREE_PATH}` on branch `{WORKTREE_BRANCH}` | skipped (no worktree)
**Token usage:** {input}k in / {output}k out / {cache_write}k cache-write / {cache_read}k cache-read | unavailable
**Next action:** {contextual directed-prompt suggestion, e.g., "Open a PR now? Reply /open-pr to proceed." or "Merge now? Reply /merge-pr to proceed."}
```

---

## Template D — Post-Merge (`/merged`, `/merge-pr`)

Used after post-merge cleanup by `/merged` (whether standalone or chained from `/merge-pr`).

This template does not use the Common Fields block. The "Worktree" field is replaced by the more specific "Worktree removed" field, and "Next action" does not apply after a merge cleanup.

The `PR` and `Merge method` lines are conditional: include them only when `MERGED_PR_NUMBER` is present in session context (i.e., `/merged` was chained from `/merge-pr`). Omit both lines when `/merged` is run standalone.

```
## Completion Report — Post-Merge Cleanup

**PR:** #{MERGED_PR_NUMBER} — {MERGED_PR_TITLE}  ← only when MERGED_PR_NUMBER is present in session context; omit if standalone /merged
**Merge method:** squash  ← only when MERGED_PR_NUMBER is present in session context; omit if standalone /merged
**Worktree removed:** `{worktree-path}` | N/A
**Branch deleted:** `{branch}` | skipped (detached HEAD) | skipped (see warning)
**Current branch:** main (up to date)
**Plan files cleaned:** {list of deleted files} | none | skipped (no SESSION_TS)

**Token usage:** {input}k in / {output}k out / {cache_write}k cache-write / {cache_read}k cache-read | unavailable
```
