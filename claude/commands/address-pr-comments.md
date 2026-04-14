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

## Step 2 -- Verify GitHub authentication

Run: `gh auth status`

If the command exits with a non-zero status, abort immediately: "GitHub authentication is
required. Run `gh auth login` and try again."

## Step 3 -- Derive owner and repo

Run: `git remote get-url origin`

Parse the output to extract `<owner>` and `<repo>`. Handle both URL formats:

- SSH: `git@github.com:owner/repo.git` — split on `:`, take the right side, split on `/`
- HTTPS: `https://github.com/owner/repo.git` — split on `/`, take the last two segments

Strip trailing `.git` if present. Store as `<owner>` and `<repo>` for use in all API calls.

## Step 4 -- Fetch PR metadata and unresolved review threads

Fetch the PR metadata and all unresolved review threads in a single paginated GraphQL query.

**Important:** The cursor variable must be named `$endCursor` exactly. This is the variable
name that `gh api graphql --paginate` recognises for automatic pagination. Any other name
causes pagination to silently return only the first page.

Run the following query:

```
gh api graphql --paginate -f query='
query($owner: String!, $repo: String!, $prNumber: Int!, $endCursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $prNumber) {
      title
      state
      reviewThreads(first: 100, after: $endCursor) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          startLine
          diffSide
          comments(first: 100) {
            nodes {
              fullDatabaseId
              author {
                login
              }
              body
              createdAt
              path
              line
              diffHunk
              url
            }
          }
        }
      }
    }
  }
}
' -f owner=<owner> -f repo=<repo> -F prNumber=<pr-number>
```

Note: inner thread comments are fetched up to 100 per thread, which is sufficient for all practical review threads. Pagination within threads is not implemented.

Check the result:

- If the `pullRequest` field is `null` (PR not found), abort: "PR #`<pr-number>` not found in
  `<owner>/<repo>`."
- If the PR `state` is `MERGED` or `CLOSED`, warn: "PR #`<pr-number>` is `<state>`. Comments
  can still be addressed but replies may have limited visibility." Ask: "Proceed anyway? (yes/no)"
  If the user says anything other than `yes`, abort.
- Print: "PR #`<pr-number>`: `<title>`"

Filter the `reviewThreads.nodes` array: keep only entries where `isResolved` is `false`.

For each unresolved thread, extract and store:

- `thread-id`: the GraphQL `id` of the thread (for internal tracking and resume matching)
- `file-path`: the `path` field from the thread
- `line`: the `line` field (may be null)
- `start-line`: the `startLine` field (may be null; if non-null, the comment spans
  `startLine` to `line`)
- `is-outdated`: the `isOutdated` field (true when the thread references a diff range that
  has since changed)
- `comments`: the ordered list of comments in the thread. For each comment:
  - `comment-full-database-id`: the `fullDatabaseId` value. This is a BigInt string (e.g.,
    `"1234567890123456"`). Use it as-is when interpolating into URL paths -- no type
    conversion is needed; URL path segments are character strings and GitHub's server
    parses them numerically.
  - `author`: `author.login`
  - `body`: the comment body text
  - `created-at`: the `createdAt` timestamp
  - `diff-hunk`: the `diffHunk` context
  - `url`: the GitHub URL of the comment
- **Reply target:** Use `comments.nodes[0].fullDatabaseId` -- the `fullDatabaseId` of the
  **first** (top-level/root) comment in the thread. The GitHub REST API requires the
  original top-level review comment ID. Replies to replies are not supported; the last
  comment's ID must not be used.

If zero unresolved threads remain after filtering, print: "No unresolved review comments found
on PR #`<pr-number>`." and stop.

Print: "Found `<count>` unresolved review thread(s) on PR #`<pr-number>`."

## Step 5 -- Check for an existing session (resume)

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
  in the summary contains a `**Thread ID:**` line with the GraphQL `id`.
- Ask: "Found an existing session for PR #`<pr-number>` (`<filename>`). Resume from where
  it left off? (yes/no)"
  - If `yes`: filter the unresolved threads list to exclude any thread whose `id` appears
    in the existing summary. Update `<session-ts>` to match the existing file's timestamp
    (extracted from the filename prefix) so new entries append to the same file. Print:
    "Resuming -- `<remaining-count>` thread(s) remaining."
  - If `no`: proceed with all threads. Keep the newly generated `<session-ts>`.

If no matching files exist, proceed normally.

## Step 6 -- Reason over each thread and propose a response

For each unresolved thread (in the order fetched), perform the following sequence:

**6a. Present thread context.**

Display a clearly formatted block:

```
--- Thread <N> of <total> ---
File: <file-path>:<line>
(use <file-path>:<start-line>-<line> when start-line is non-null)
Status: outdated   (if is-outdated is true)
Status: current    (if is-outdated is false)

Diff context:
<diffHunk from comments.nodes[0]>

Review comment by @<author> (<created-at>):
<body of comments.nodes[0]>

(For each subsequent comment in the thread, if any:)
Reply by @<author> (<created-at>):
<body>
```

**6b. Read the current file.**

Read the file at `<file-path>` in the working tree, focusing on the lines around `<line>`.
This reveals whether the reviewer's concern has already been addressed by subsequent commits.

If the file does not exist in the working tree (deleted or renamed since the review), display:
"File no longer exists in working tree." Factor this into reasoning: the comment refers to
code that no longer exists, making ALREADY-ADDRESSED the likely appropriate category with an
explanation that the file was removed.

**6c. Reason about the comment.**

Consider:

- What is the reviewer asking for or pointing out?
- Has the issue already been addressed in the current code (compare diff hunk to current
  file state)?
- Is the file still present, or has it been deleted or renamed?
- Is the suggestion an improvement, a style preference, a correctness issue, or a
  misunderstanding?
- What is the appropriate response category?

**6d. Categorize the response** as one of:

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

**6e. Draft the reply text.**

The reply should be:

- Professional and respectful
- Specific (reference exact code or lines when relevant)
- Concise (2-5 sentences typically)
- Actionable where appropriate

**6f. Present the proposal.**

```
Proposed response (category: <CATEGORY>):

<draft reply text>

Actions: [approve] [edit] [skip] [quit]
```

**6g. Handle the user's decision.**

- **approve**: Accept the draft as-is. Proceed to Step 7.
- **edit**: The user provides revised text. Use the user's text instead. Proceed to Step 7.
- **skip**: Do not post a reply. Record in the summary as "skipped". Move to the next thread.
- **quit**: Stop processing. Record this thread as "quit -- not processed" in the summary.
  Do not process remaining threads. Print: "Session paused. Run `/address-pr-comments
  <pr-number>` to resume later."

After each decision (including skip and quit), proceed to Step 8 to write the summary entry
before moving on.

## Step 7 -- Post the approved reply

For approved or edited replies, post the reply using the REST API. Because reply text is
free-form and may contain single quotes, double quotes, backticks, dollar signs, newlines,
and other shell-special characters, do not pass the body inline. Instead:

**7a.** Write the reply text to a temporary file:

Run a write operation to create `/tmp/pr-reply-body.txt` containing the reply body.

**7b.** Post using the `-F` flag with `@file` syntax, which reads the field value from the
file and bypasses all shell quoting issues. (`-F/--field` supports `@filename` file-read
syntax; lowercase `-f/--raw-field` does not -- it would send the literal string
`@/tmp/pr-reply-body.txt` as the comment body.)

Run:

```
gh api --method POST /repos/<owner>/<repo>/pulls/<pr-number>/comments/<first-comment-full-database-id>/replies -F body=@/tmp/pr-reply-body.txt
```

Where:

- `<pr-number>` is the PR number (the `pulls/{pull_number}` segment is required in the path)
- `<first-comment-full-database-id>` is the `fullDatabaseId` string of
  `comments.nodes[0]` for this thread (identified in Step 4) -- used as-is, no conversion

**7c.** Remove the temporary file regardless of success or failure:

Run: `rm /tmp/pr-reply-body.txt`

**If the API call succeeds:**

- Extract the `html_url` from the JSON response.
- Print: "Reply posted: `<html_url>`"
- Record in the summary: status = "posted", include `<html_url>`.

**If the API call fails:**

- Print: "Failed to post reply: `<error>`"
- Ask: "Retry? (yes/no)"
- If `yes`: retry the API call once (Steps 7a--7c again). If it fails again, record as
  "failed" in the summary and move to the next thread.
- If `no`: record as "failed" in the summary and move to the next thread.

## Step 8 -- Write or update the session summary

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

## Thread 1: <file-path>:<line>

**Thread ID:** <thread-id>
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

## Step 9 -- Print the final session summary

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
