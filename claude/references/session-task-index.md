# Session & Task Tracking Index

This reference is the single canonical spec for the cross-session task/session index. Every instrumentation point that creates, updates, queries, or deletes an index record defers to this document rather than re-describing the schema or the create/update/delete idioms inline (DRY).

## Storage layout

Records live under `~/.ai-tpk/index/records/`, **one JSON file per record**: `~/.ai-tpk/index/records/{key}.json`.

- The directory is **flat and global** — it is NOT nested per-repo. A single glob `records/*.json` spans all repos. `repo_slug` is a *field* inside each record, not a directory segment.
- The directory is created on first write via `mkdir -p ~/.ai-tpk/index/records`.

## Primary key = filename = slug

There is **no `record_id` field**. The filename (minus the `.json` extension) IS the record's identity.

- The key is fixed at record-creation time.
- The key **never changes across stage transitions, under any circumstances** — no rename-on-transition, ever. A record that advances from `idea` to `issue` to `session` is the same file, same name, throughout its entire lifecycle.
- The key is derived on read from the filename basename — it is never stored as a field inside the JSON body.

## Per-record schema

One evolving record represents one unit of work. Fields:

| Field | Type | Present at | Notes |
|---|---|---|---|
| `stage` | string | all stages | `idea` \| `issue` \| `session` — the current lifecycle stage. The `--type` CLI flag (on `index-record.sh`, `index-query.sh`, and `/list`) sets/filters this field; it is spelled `--type` for brevity but always maps to `stage`. |
| `status` | string | `session` only | Session sub-status: `active` \| `pr-open`. Absent for `idea`/`issue` records. |
| `repo_slug` | string | all stages, once known | The owning repo's `REPO_SLUG`. |
| `issue` | int \| null | `issue` stage onward | GitHub issue number. Set at `issue` stage, carried into `session` stage. **The cross-command join key** used by the issue-join lookup. |
| `pr` | int \| null | set at `/open-pr` | Pull request number. |
| `worktree_slug` | string | `session` stage only | Basename of the session's worktree path. **The `/open-pr`/`/merged` lookup field** — always resolved by content match, NEVER assumed to equal the filename. |
| `worktree` | string (path) | `session` stage only | Absolute worktree path. Absent on `idea`/`issue` (no worktree exists yet). |
| `branch` | string | `session` stage only | Git branch name. |
| `session_ts` | string | `session` stage only | The session's `SESSION_TS`. |
| `tags` | array | optional, any stage | Repeatable free-form tags. |
| `summary` | string | optional, any stage | Free-form human-readable summary. |
| `created_ts` | string (ISO-8601 UTC) | all stages | Set once at record creation; never overwritten. |
| `updated_ts` | string (ISO-8601 UTC) | all stages | Bumped on every write (create and every update). |

## Key origin by entry point

- **`/draft-issue` `idea` creation:** `key = {idea-slug}`, derived the same way `SESSION_SLUG` is derived today for `/draft-issue`.
- **Fresh session (`/feature`, `/bug`):** `key = <worktree-slug>`.
- **Continued session (`/feature-issue`, `/bug-issue`):** NO new file is created. The existing file — found by scanning for a content match on the `issue` field — is mutated in place, keeping its original idea-slug filename. Fallback: if no matching record is found, create `{worktree-slug}.json` fresh at `session` stage.

## Lifecycle diagram

```
idea ──(gh issue create succeeds)──> issue ──(worktree created, issue-join)──> session (active) ──(/open-pr)──> session (pr-open) ──(/merged)──> [deleted]

session (active) ──(/open-pr)──> session (pr-open) ──(/merged)──> [deleted]
   ^
   (fresh /feature or /bug — no idea/issue precursor)
```

- `idea → issue → session`: via `/draft-issue` then `/feature-issue`/`/bug-issue`, mutating one file in place.
- `session` alone: fresh `/feature`/`/bug`, no idea/issue precursor.
- **Every stage after creation is reached by an in-place merge-update of the SAME file** — never a new file, never a rename.
- A merged session is represented by **file deletion** (absence), not a persistent `merged` stage or status. There is no terminal `merged` value anywhere in the schema.

## Create semantics (exclusive)

Creation is an **atomic exclusive-create** of `{key}.json`:

- Use `set -C` (noclobber) so redirecting into an existing file fails rather than clobbering it (the `O_EXCL` idiom).
- On collision, retry with a numeric suffix: `{key}-2.json`, then `{key}-3.json`, … (bounded loop; error out if exhausted). This mirrors the Worktree Creation Subroutine's branch-collision retry pattern (`worktree-creation-subroutine.md` step 3).
- This guards the narrow race of two sessions creating a new record with the same slug at the same instant, WITHOUT holding a lock for the file's lifetime.
- Set both `created_ts` and `updated_ts` to `date -u +%Y-%m-%dT%H:%M:%SZ` at creation time.
- On success, print the final key used (basename minus `.json`) to stdout, so a same-session caller can capture it and address the record for a subsequent update. This is necessary because the final key is not deterministically reconstructable after a collision (it may carry a numeric suffix).

## Update semantics (in-place merge)

Updates never create — a missing target file is an error:

1. Require `{key}.json` to already exist. Exit non-zero if absent (this is intentional graceful-degradation signaling to the caller, not a condition to suppress).
2. Read the current contents.
3. Merge the provided fields via `jq '. + {…}'` — later fields override, earlier fields (e.g. `summary`, `issue`, `repo_slug`) survive untouched if not re-specified.
4. Set `updated_ts` to the current UTC timestamp; `created_ts` is preserved unchanged.
5. Write atomically: `TMP="${FILE}.tmp.$$"; jq ... "$FILE" > "$TMP" && mv "$TMP" "$FILE" || rm -f "$TMP"`.

This is the identical idiom already used for the session-context sidecar write in `worktree-creation-subroutine.md` step 4a.

## Issue-join lookup

`/feature-issue`/`/bug-issue` resolve their continuation record via:

```
bash ~/.claude/scripts/index-query.sh --issue <N> --type issue --format key
```

This returns the key(s) of `issue`-stage records whose `issue` field matches `<N>`. The caller takes the first match and performs an in-place `--mode update` to `session` stage.

**Fallback:** no match → create `{worktree-slug}.json` fresh at `session` stage (recording `--issue <N>` on the new record).

## worktree_slug lookup

`/open-pr`/`/merged` resolve the live session record via:

```
bash ~/.claude/scripts/index-query.sh --worktree-slug <worktree-slug> --format key
```

- The filename is **NOT** a reliable lookup key for these commands: a `/feature-issue`/`/bug-issue` session's file is named after the original idea slug, not the worktree slug. The lookup MUST be a content match on the `worktree_slug` field.
- **Uniqueness assumption:** one live session record per worktree-slug. `idea`/`issue`-stage records carry no `worktree_slug` field, so they never match this lookup.
- Each caller (Steps 6 and 7 elsewhere) documents its own fallback when no record is found.

## Delete semantics

```
bash ~/.claude/scripts/index-delete.sh <key>
```

- Performs `rm -f ~/.ai-tpk/index/records/{key}.json`.
- Idempotent: deleting an absent key is a no-op success, not an error.
- Reports whether a file was actually removed ("removed" vs "no such record").
- **No advisory lock, no whole-file rewrite** — removing one record's file cannot affect any other record's file.
- Because the entire `idea → issue → session` lineage lives in one file, deleting that file removes the whole lineage in a single `rm`. There is no separate lineage record to clean up elsewhere.

## Constitution Principle 1 justification

Per-record files under a shared *directory* are session-isolated the same way the accepted `~/.ai-tpk/session-context/by-worktree/{worktree-slug}.json` sidecar is: each file is namespaced by a per-record slug (an idea-slug or a worktree-slug), NOT a singleton path shared across sessions. This is explicitly the mirror of the canonical anti-pattern from PR #187 (`~/.ai-tpk/session-context/current.json` — a singleton path, invalid); this design assigns each record its own file, keyed by a session- or record-unique slug.

- **Exclusive-create + numeric-suffix retry** prevents two concurrent sessions from clobbering each other when minting a new record with the same slug.
- **In-place updates** only ever touch a single record's own file — an update to one record cannot corrupt or block an update to any other record.
- **Deletes** remove exactly one file and cannot affect any other record.

This is a strictly stronger isolation story than the dropped shared-JSONL append/fold model, which relied on append atomicity plus an `mkdir`-based advisory lock for deletion. Per-record files eliminate the shared-mutable-state surface entirely: there is no single file whose corruption could affect more than one unit of work.

**Residual same-file concurrency note:** concurrent updates to the *same* record file are last-writer-wins on the atomic `tmp-then-mv` (never corrupt, never cross records) — this is bounded in practice because a single worktree/session does not run its own stage transitions concurrently with itself.
