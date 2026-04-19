---
description: Address unresolved inline PR review comments -- fetch, reason, propose replies, and post approved responses
---

You are addressing unresolved inline review comments on a GitHub pull request. For each
unresolved thread you will display the reviewer's context, read the current file state,
reason about the comment, categorize it, draft a reply, and present it for approval before
posting. Follow every step below in order. Run each command as a standalone call -- do not
chain commands with `&&`, `;`, or `|`.

## Step 1 -- Parse arguments and generate session timestamp

`$ARGUMENTS` should contain the PR number.

- If `$ARGUMENTS` is empty or contains no numeric value, ask the user: "Which PR number should
  I address comments for?"
- If `$ARGUMENTS` contains a numeric value, extract it and store as `<pr-number>`.
- Validate that `<pr-number>` is a positive integer. If not, abort with: "Invalid PR number:
  `<value>`. Please provide a valid PR number."

Generate `<session-ts>` in the format `YYYYMMDD-HHMMSS` using the current date and time. Store
it for use in the summary file path.

## Step 2 -- Discover unresolved review threads

Run `~/.claude/scripts/pr-comments-fetch.sh <pr-number>` as a single Bash call.

**Exit code handling:**

- Exit code **2** means the script rejected its arguments — this is an internal bug in the
  command prose. Abort immediately: "Internal error: pr-comments-fetch.sh rejected its
  arguments. This is a bug; please report." Do not retry.
- Exit code **1** means the script encountered an error (e.g. PR not found, auth failure,
  network issue). The script will have printed an explanatory message to stderr. Surface that
  message to the user and abort.
- Exit code **0** means success. Parse the script's stdout as JSON and continue.

**JSON shape emitted on success:**

```json
{
  "pr_number": 42,
  "title": "...",
  "state": "OPEN",
  "owner": "...",
  "repo": "...",
  "threads": [
    {
      "thread_id": "...",
      "is_resolved": false,
      "is_outdated": false,
      "path": "src/foo.ts",
      "line": 17,
      "start_line": null,
      "first_comment_full_database_id": 1234567890123456,
      "comments": [
        {
          "comment_full_database_id": 1234567890123456,
          "author": "reviewer-login",
          "body": "...",
          "created_at": "2026-01-01T00:00:00Z",
          "diff_hunk": "...",
          "url": "https://github.com/..."
        }
      ]
    }
  ]
}
```

The `thread_id` field is the GraphQL node id of the thread (used for resume matching). The
`first_comment_full_database_id` is the integer database id of the first (root) comment in
the thread — this is the value to pass to the reply script. The `comment_full_database_id`
field inside each comment object is the per-comment integer id. No field is named bare `id`.

**Sub-steps — execute in this exact order:**

1. **State warning first.** Read `.state` from the JSON. If it is `MERGED` or `CLOSED`, warn
   the user: "PR #`<pr-number>` is `<state>`. Comments can still be addressed but replies may
   have limited visibility." Ask: "Proceed anyway? (yes/no)". If the user says anything other
   than `yes`, abort.

2. **Print PR title.** Print "PR #`<pr-number>`: `<title>`".

3. **Zero-thread short-circuit.** If `.threads | length == 0`, print "No unresolved review
   comments found on PR #`<pr-number>`." and stop. (This runs after the state warning so that
   a CLOSED PR with zero unresolved threads still receives the state warning before
   terminating.)

4. **"Found N unresolved..." print.** Print "Found `<count>` unresolved review thread(s) on
   PR #`<pr-number>`."

Store `<owner>`, `<repo>`, and `<title>` from the JSON for use in subsequent steps.

## Step 3 -- Check for an existing session (resume)

Define the summary directory as `~/.ai-tpk/pr-review-comments/`.

Run: `mkdir -p ~/.ai-tpk/pr-review-comments/`

Check whether any file matching `*-pr-<pr-number>.md` exists in that directory. Use `ls`
to list candidates (the pattern uses a dash before the number to prevent prefix collisions --
`*-pr-1.md` will not match `*-pr-10.md`).

Run: `ls ~/.ai-tpk/pr-review-comments/*-pr-<pr-number>.md`

If one or more matching files exist:

- Identify the most recent by filename (filenames are timestamped, so lexicographic order
  gives chronological order).
- Read the file and parse it for already-processed thread IDs. Each processed thread entry
  in the summary contains a `**Thread ID:**` line with the `thread_id` value.
- Ask: "Found an existing session for PR #`<pr-number>` (`<filename>`). Resume from where
  it left off? (yes/no)"
  - If `yes`: filter the threads list (from Step 2 JSON) to exclude any thread whose
    `thread_id` appears in the existing summary. Update `<session-ts>` to match the existing
    file's timestamp (extracted from the filename prefix) so new entries append to the same
    file. Print: "Resuming -- `<remaining-count>` thread(s) remaining."
  - If `no`: proceed with all threads. Keep the newly generated `<session-ts>`.

If no matching files exist, proceed normally.

## Step 4 -- Reason over each thread and propose a response

For each unresolved thread (in the order returned by the fetch script), perform the following
sequence:

**4a. Present thread context.**

Display a clearly formatted block:

```
--- Thread <N> of <total> ---
File: <path>:<line>
(use <path>:<start_line>-<line> when start_line is non-null)
Status: outdated   (if is_outdated is true)
Status: current    (if is_outdated is false)

Diff context:
<diff_hunk from comments[0]>

Review comment by @<author> (<created_at>):
<body of comments[0]>

(For each subsequent comment in the thread, if any:)
Reply by @<author> (<created_at>):
<body>
```

**4b. Read the current file.**

Read the file at `<path>` in the working tree, focusing on the lines around `<line>`.
This reveals whether the reviewer's concern has already been addressed by subsequent commits.

If the file does not exist in the working tree (deleted or renamed since the review), display:
"File no longer exists in working tree." Factor this into reasoning: the comment refers to
code that no longer exists, making ALREADY-ADDRESSED the likely appropriate category with an
explanation that the file was removed.

**4c. Reason about the comment.**

Consider:

- What is the reviewer asking for or pointing out?
- Has the issue already been addressed in the current code (compare diff hunk to current
  file state)?
- Is the file still present, or has it been deleted or renamed?
- Is the suggestion an improvement, a style preference, a correctness issue, or a
  misunderstanding?
- What is the appropriate response category?

**4d. Categorize the response** as one of:

- **FIX** -- The reviewer is right and the code should be changed. The reply acknowledges
  the issue and states what will be (or has been) fixed.
- **COMPROMISE** -- The reviewer has a point but a full change is not warranted. The reply
  proposes a middle ground.
- **PUSH-BACK** -- The current implementation is correct or intentional. The reply explains
  why, respectfully.
- **ALREADY-ADDRESSED** -- The issue raised has already been fixed in a subsequent commit,
  or the file no longer exists. The reply points this out.
- **ACKNOWLEDGE** -- The comment is informational or a question that deserves a simple
  acknowledgment or answer.

**4e. Draft the reply text.**

The reply should be:

- Professional and respectful
- Specific (reference exact code or lines when relevant)
- Concise (2-5 sentences typically)
- Actionable where appropriate

**4f. Present the proposal.**

```
Proposed response (category: <CATEGORY>):

<draft reply text>

Actions: [approve] [edit] [skip] [quit]
```

**4g. Handle the user's decision.**

- **approve**: Accept the draft as-is. Proceed to Step 5.
- **edit**: The user provides revised text. Use the user's text instead. Proceed to Step 5.
- **skip**: Do not post a reply. Record in the summary as "skipped". Move to the next thread.
- **quit**: Stop processing. Record this thread as "quit -- not processed" in the summary.
  Do not process remaining threads. Print: "Session paused. Run `/address-pr-comments
  <pr-number>` to resume later."

After each decision (including skip and quit), proceed to Step 6 to write the summary entry
before moving on.

## Step 5 -- Post the approved reply

For approved or edited replies, post the reply using the reply script. Because reply text is
free-form and may contain single quotes, double quotes, backticks, dollar signs, newlines,
and other shell-special characters, the script reads the body from a file to bypass all shell
quoting issues.

**5a.** Write the reply text to a temporary file:

Run a write operation to create `/tmp/pr-reply-body.txt` containing the reply body.

**5b.** Invoke the reply script as a single Bash call:

```
~/.claude/scripts/pr-comments-reply.sh <pr-number> <first-comment-full-database-id> /tmp/pr-reply-body.txt
```

Where `<first-comment-full-database-id>` is the `first_comment_full_database_id` value for
this thread from the Step 2 JSON.

**5c.** Branch on the script's exit code and JSON output:

- **Exit code 2** — This is an arg-validation bug in the prose. Abort immediately: "Internal
  error: pr-comments-reply.sh rejected its arguments. This is a bug; please report." Do not
  retry.
- **Exit code 0 or 1** — Parse the script's stdout as JSON and branch on `.ok`:
  - **`.ok == true`**: extract `.html_url` and print "Reply posted: `<html_url>`". Record in
    the summary as "posted" with the URL.
  - **`.ok == false` and `.error_kind == "review_flow_comment"`**: print "Cannot reply via
    REST: this comment was submitted as part of a formal review and GitHub's /replies endpoint
    does not support it. Skipping this thread." Record in the summary as "failed (review-flow
    comment -- REST replies endpoint returned 404)". **Do not retry** -- the next attempt will
    produce the same 404. Move to the next thread.
  - **`.ok == false` and any other `error_kind`** (`auth`, `body_file_missing`,
    `owner_repo_parse`, `api`, `unknown`): print `.error` and ask "Retry? (yes/no)". On
    `yes`, re-run sub-steps 5a--5c once. If the second attempt also returns `.ok == false`,
    record as "failed" in the summary and move to the next thread. On `no`, record as
    "failed" and move on.

**5d.** Remove the temporary file regardless of success or failure:

Run: `rm /tmp/pr-reply-body.txt`

### Known limitation

GitHub's `POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies`
endpoint returns **404** for comments that were submitted as part of a formal review flow
("Start a Review" in the GitHub UI). It works only for standalone diff comments. The script
detects this case and emits `error_kind: "review_flow_comment"`, which the prose above treats
as a non-retryable failure. When this occurs, record the thread as failed with the documented
summary text and move on -- retrying will produce the same result.

## Step 6 -- Write or update the session summary

After each thread is processed (posted, skipped, failed, or quit), write its entry to the
summary file at `~/.ai-tpk/pr-review-comments/<session-ts>-pr-<pr-number>.md`. Write
incrementally after each thread so progress is preserved if the session is interrupted.

**On the first thread:** write the header block followed by the first thread entry:

```markdown
# PR Review Comments -- PR #<pr-number>

**Repository:** <owner>/<repo>
**PR Title:** <title>
**Session started:** <session-ts>
**Total unresolved threads:** <total-count>

---

## Thread 1: <path>:<line>

**Thread ID:** <thread_id>
**Status:** <outdated | current>
**Reviewer:** @<author>
**Comment:**
> <reviewer comment body, block-quoted>

**Category:** <FIX | COMPROMISE | PUSH-BACK | ALREADY-ADDRESSED | ACKNOWLEDGE>
**Proposed reply:**
> <draft reply text>

**Decision:** <approved | edited | skipped | failed | quit>
**Posted reply:**
> <final reply text after any edits, or "N/A" if skipped or failed>

**GitHub URL:** <html_url of posted reply, or "N/A">

---
```

**On subsequent threads:** append only the new thread entry (starting from `## Thread N:`)
after the last existing entry.

**When resuming an existing session:** read the existing file first, then append new thread
entries after the last existing `---` separator.

## Step 7 -- Print the final session summary

After all threads are processed (or the user quit), print:

```
=== Session Complete ===
PR #<pr-number>: <title>
Threads processed: <count>
- Posted: <count>
- Skipped: <count>
- Failed: <count>
- Remaining (quit early): <count>

Summary saved to: ~/.ai-tpk/pr-review-comments/<session-ts>-pr-<pr-number>.md
```

If the user quit early, also print: "Run `/address-pr-comments <pr-number>` to resume the
remaining `<count>` thread(s)."
