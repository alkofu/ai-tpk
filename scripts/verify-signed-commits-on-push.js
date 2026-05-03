#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ZERO_SHA = '0000000000000000000000000000000000000000';
const SHA_RE = /^[0-9a-f]{40}$/;
const REF_RE = /^[A-Za-z0-9._/+:-]+$/;

// Strips ASCII control characters and ESC bytes from attacker-controllable strings
// before writing them to stderr, preventing terminal output spoofing.
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\x00-\x08\x0B-\x1F\x7F\x1B]/g;
// eslint-disable-next-line no-control-regex
const REF_CONTROL_RE = /[ \t\x00-\x1F\x7F]/;

function sanitize(s) {
  return String(s).replace(CONTROL_RE, '?');
}

function git(args, opts = {}) {
  return spawnSync('git', args, { encoding: 'utf8', ...opts });
}

// --- stdin parsing ---

const raw = readFileSync(0, 'utf8');
const lines = raw.split('\n').filter((l) => l.length > 0);

if (lines.length === 0) {
  process.stderr.write(
    'verify-signed-commits-on-push: no refs received on stdin (is `use_stdin: true` set on the lefthook command?); skipping — no commits to check.\n',
  );
  process.exit(0);
}

// All-upfront validation before any git calls.
const parsed = [];
for (let i = 0; i < lines.length; i++) {
  const fields = lines[i].split(/\s+/);
  if (fields.length !== 4) {
    process.stderr.write(
      `verify-signed-commits-on-push: malformed stdin line ${i + 1}: expected 4 whitespace-separated fields, got ${fields.length}\n`,
    );
    process.exit(1);
  }

  const [localRef, localSha, remoteRef, remoteSha] = fields;

  // Validate SHAs (both must match SHA_RE or be the ZERO_SHA literal).
  for (const sha of [localSha, remoteSha]) {
    if (sha !== ZERO_SHA && !SHA_RE.test(sha)) {
      process.stderr.write(
        `verify-signed-commits-on-push: malformed stdin line ${i + 1}: invalid SHA value ${sanitize(sha)}\n`,
      );
      process.exit(1);
    }
  }

  // Validate refs — reject leading dashes, prohibited substrings, and bad chars.
  for (const ref of [localRef, remoteRef]) {
    if (
      ref.startsWith('-') ||
      !REF_RE.test(ref) ||
      ref.includes('..') ||
      ref.includes('\\') ||
      ref.includes(':') ||
      REF_CONTROL_RE.test(ref)
    ) {
      process.stderr.write(
        `verify-signed-commits-on-push: malformed stdin line ${i + 1}: invalid ref value ${sanitize(ref)}\n`,
      );
      process.exit(1);
    }
  }

  parsed.push({ localRef, localSha, remoteRef, remoteSha });
}

// Classify each pair and accumulate (rangeArgs, refPair) tuples.
const tuples = [];
for (const refPair of parsed) {
  const { localSha, remoteSha } = refPair;

  if (localSha === ZERO_SHA) {
    // Branch deletion — skip.
    continue;
  }

  let rangeArgs;
  if (remoteSha === ZERO_SHA) {
    // New branch push.
    rangeArgs = [localSha, '--not', '--remotes'];
  } else {
    // Incremental push.
    rangeArgs = [`${remoteSha}..${localSha}`];
  }

  tuples.push({ rangeArgs, refPair });
}

// --- enumerate, deduplicate, filter by author email ---

const emailResult = git(['config', '--get', 'user.email']);
const userEmail = emailResult.stdout.trim();
if (!userEmail) {
  process.stderr.write(
    'verify-signed-commits-on-push: git config user.email is unset; cannot determine which commits to check. Set it with: git config --global user.email "you@example.com"\n',
  );
  process.exit(1);
}
const userEmailLower = userEmail.toLowerCase();

// Map<sha, { refPair, sigStatus }> — deduplication, first occurrence wins.
const commitMap = new Map();

for (const { rangeArgs, refPair } of tuples) {
  const result = git(['log', '--format=%H %ae %G?', ...rangeArgs, '--']);
  if (result.status !== 0) {
    process.stderr.write(
      `verify-signed-commits-on-push: git log failed for ref ${sanitize(refPair.localRef)} -> ${sanitize(refPair.remoteRef)}: ${sanitize(result.stderr)}\n`,
    );
    process.exit(1);
  }

  const logLines = result.stdout.split('\n').filter((l) => l.length > 0);
  for (const logLine of logLines) {
    // %H is 40 hex chars; %ae may contain spaces (user.email is unconstrained by git); %G? is a single char. Slice/join reconstructs the email correctly for space-containing values.
    const parts = logLine.split(' ');
    if (parts.length < 3) continue;
    const sha = parts[0];
    const sigStatus = parts[parts.length - 1];
    const authorEmail = parts.slice(1, parts.length - 1).join(' ');

    if (authorEmail.toLowerCase() !== userEmailLower) continue;
    if (commitMap.has(sha)) continue;

    commitMap.set(sha, { refPair, sigStatus });
  }
}

// --- apply pass/fail policy ---

const failures = [];
for (const [sha, { refPair, sigStatus }] of commitMap) {
  if (sigStatus === 'G' || sigStatus === 'E') continue;

  let reason;
  if (sigStatus === 'N') {
    reason = 'Unsigned';
  } else {
    reason = `Problematic signature (status: ${sigStatus})`;
  }

  failures.push({ sha, refPair, sigStatus, reason });
}

if (failures.length === 0) {
  process.exit(0);
}

for (const { sha, refPair, sigStatus, reason } of failures) {
  // Defence-in-depth: assert SHA matches regex before passing to git log -1.
  if (!SHA_RE.test(sha)) {
    process.stderr.write(
      `verify-signed-commits-on-push: internal error: SHA from git log failed regex check: ${sanitize(sha)}\n`,
    );
    process.exit(1);
  }

  const subjectResult = git(['log', '-1', '--format=%s', sha, '--']);
  const subject =
    subjectResult.stdout?.split('\n')[0] ?? '(subject unavailable)';

  process.stderr.write(
    `BLOCKED: ${reason} commit by ${sanitize(userEmail)}\n` +
      `  commit: ${sha}\n` +
      `  subject: ${sanitize(subject)}\n` +
      `  ref: ${sanitize(refPair.localRef)} -> ${sanitize(refPair.remoteRef)}\n` +
      `  signature status (%G?): ${sigStatus}\n`,
  );
}

process.stderr.write(
  "To sign commits, configure signing (git config commit.gpgsign true; git config user.signingkey <key>) and re-sign with: git rebase --exec 'git commit --amend --no-edit -S' <base-ref>\n",
);

process.exit(1);
