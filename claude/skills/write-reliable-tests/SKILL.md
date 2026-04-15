---
name: write-reliable-tests
description: >
  Guide for writing reliable, deterministic automated tests. Use when writing new tests for a feature or bug fix, reviewing or refactoring existing test code, creating setup and teardown logic, choosing between unit/integration/e2e testing, designing test fixtures or factories, troubleshooting flaky tests, or writing mocks and stubs. Apply this skill whenever test code is being authored or evaluated, even if the user does not explicitly ask for test quality guidance.
---

# Write Reliable Tests

Use this skill when writing, reviewing, or refactoring automated tests at any level (unit, integration, end-to-end).

## Goal

Produce tests that:
- Pass consistently across runs, machines, and CI environments
- Run alone or in any order within a suite
- Rerun without leaving residue or requiring manual cleanup
- Fail for exactly one clear reason
- Validate behavior visible to callers, not incidental implementation details

## Choosing the Right Test Level

Pick the narrowest level that proves the behavior. Cheaper tests run faster, break less often, and pinpoint failures more precisely.

- **Unit** -- test a single function or module in isolation. Start here by default.
- **Integration** -- test interactions across system boundaries (database, filesystem, HTTP). Use when the boundary itself is the thing that could break.
- **End-to-end** -- test a critical user workflow through the full stack. Reserve for high-value paths where nothing less gives confidence.

State the chosen level and a brief reason when writing a test. This forces a conscious decision rather than defaulting to whatever is easiest to scaffold.

## Core Principles

### 1. Determinism

A test that sometimes passes is worse than no test -- it erodes trust in the entire suite. Control every source of non-determinism:

- **Time.** Inject or freeze clocks rather than calling `Date.now()` or `time.time()` directly. Tests that depend on wall-clock time will fail at midnight, on daylight-saving boundaries, or in different time zones.
- **Randomness.** Seed random generators or inject deterministic values. If a test needs "random-looking" data, use a factory with a fixed seed.
- **Network.** Stub or fake external services by default. A live API call introduces latency, rate limits, and outage-driven failures that have nothing to do with your code.
- **Execution order.** Never rely on tests running in a specific sequence. If test B needs state created by test A, test B has a setup problem.

### 2. Isolation

Shared mutable state is the leading cause of "works on my machine" test failures.

- Give each test its own fixtures. Per-test setup costs a little more wall time but eliminates an entire category of debugging.
- Use unique identifiers (UUIDs, timestamped names) for resources created during tests -- database rows, temp files, queue messages. Collisions between parallel tests are silent and maddening.
- If shared state is genuinely unavoidable (e.g., a heavyweight service container), document the contract explicitly and guard access with setup/teardown discipline.

### 3. Idempotency

Run the same test ten times in a row. If run 2 fails because run 1 left something behind, the test is broken.

- Cleanup must tolerate "already deleted" or "not found" states. Wrap cleanup calls so they succeed whether the resource exists or not.
- Do not assume a pristine environment. The previous test run may have crashed mid-execution, leaving partial state.
- Avoid fixed shared names for created resources unless the test explicitly verifies collision behavior.

### 4. Reliable Cleanup

Resources that leak (temp files, database rows, open connections, spawned processes) degrade the test environment over time and cause cascading failures.

- Register cleanup immediately after creating a resource, not at the end of the test. Use `defer`, `t.Cleanup()`, `addCleanup()`, `afterEach`, or the equivalent in your framework. This guarantees cleanup runs even when the test fails or throws early.
- Clean up in reverse order of creation when resources have dependencies.
- Write cleanup functions that are safe to call multiple times. A cleanup that throws on "not found" defeats its own purpose.

### 5. Behavior-Oriented Assertions

Assert what the system does, not how it does it internally.

- **Good:** "calling `register(email, password)` returns a session token and persists a user row with a hashed password."
- **Bad:** "calling `register` invokes `hashPassword` exactly once, then calls `db.insert` with a specific SQL string."

The first test survives an internal refactor. The second breaks the moment you rename a private method or switch ORMs.

Specific guidance:
- Assert observable outcomes: return values, persisted state, emitted events, HTTP responses.
- Assert side effects only when they are part of the public contract.
- For error cases, assert structured fields or error codes rather than exact message strings, unless the wording is user-facing and intentional.
- Avoid large snapshot assertions unless the output is intentionally stable (e.g., a serialization format). Snapshots of log output or HTML markup break on every cosmetic change.

## Process

Follow this sequence when writing a new test.

### 1. Identify the behavior under test

State clearly:
- What input or trigger is being exercised
- What outcome should happen
- What side effects matter
- What should *not* matter (implementation details to ignore)

### 2. Choose the test level

Pick unit, integration, or e2e using the criteria above. State the choice and the reason.

### 3. Map dependencies and control points

List every dependency: database, filesystem, network, clock, randomness, environment variables, external services, queues, async schedulers. For each one, decide whether to stub, fake, inject, or use the real thing. Control or isolate every dependency before writing the test body.

### 4. Design setup and cleanup

- Start from a known state -- create only what the test needs
- Register cleanup immediately after each resource creation
- Verify cleanup is safe to run multiple times and tolerates missing resources

### 5. Write the test

Structure each test as Arrange / Act / Assert:
- **Arrange:** Set up preconditions and inputs
- **Act:** Execute the behavior under test (one action per test)
- **Assert:** Verify the expected outcome

Naming: use behavior-based names that read as sentences. `test_expired_token_returns_401` tells you what broke; `test_auth_3` does not.

Use parameterized or table-driven tests when testing the same logic across multiple input/output pairs. This reduces duplication and makes it easy to add edge cases.

### 6. Review for flakiness

Before considering the test done, check for:
- Hidden time dependence (timestamps in assertions, timezone assumptions)
- Sleeps instead of condition-based waiting
- Order dependence between tests
- Global shared state mutation
- Unstable snapshot content
- Live API calls that should be stubbed
- Race conditions in async code
- Port, file, or path collisions with other tests

### 7. Review for maintainability

- Is setup duplicated across tests? Extract a shared helper, but keep it transparent -- helpers that hide the scenario make tests harder to debug.
- Are there hard-coded magic values? Name them or parameterize them.
- Does the test assert too many unrelated things? Split into focused tests.
- Could someone unfamiliar with the code understand what the test proves by reading it?

## External System Boundaries

- Stub or fake boundaries you are not testing directly. A unit test for business logic should not fail because a staging API is down.
- Use real integrations only when the boundary itself is the subject of the test.
- Mark slow or live-dependency tests clearly (e.g., a `@slow` or `@integration` tag) and keep them out of the default fast test run.

## Async and Timing

- Replace arbitrary `sleep()` calls with bounded waits on a real condition (polling with a timeout, or an event/promise). A sleep that "usually works" is a flake waiting to happen.
- Use explicit timeouts so tests fail fast rather than hanging.
- Freeze or inject time where possible instead of depending on real elapsed time.

## Test Data

Keep test data small and intentional.

- Use realistic shapes but not production-sized payloads.
- Cover edge cases explicitly: empty inputs, null/missing fields, duplicates, invalid input, boundary values.
- Use factories or builders for test data rather than inlining large object literals. Factories make it easy to vary one field while keeping the rest at sensible defaults.

## Anti-Patterns

Recognizing these patterns helps catch problems before they ship:

- **Order-dependent tests** -- test B passes only after test A. Fix: give each test its own setup.
- **Shared mutable fixtures** -- a global object modified by multiple tests. Fix: create fresh fixtures per test.
- **Live network in unit tests** -- a DNS blip breaks the build. Fix: stub external calls.
- **Exact log-message matching** -- breaks on every rewording. Fix: assert structured fields or log levels.
- **Giant snapshots** -- a 500-line snapshot where 3 lines matter. Fix: assert the specific values.
- **Helpers that hide the scenario** -- `setupEverything()` makes debugging impossible. Fix: keep setup visible in the test or use clearly-named, focused helpers.
- **Retries masking flakiness** -- retrying a flaky test 3 times until it passes. Fix: find and eliminate the non-determinism.
- **Sleeping to "make it work"** -- `sleep(2)` before asserting. Fix: wait on a condition with a timeout.

## Review Checklist

Before finalizing any test, confirm:

- [ ] Can this test run by itself, outside the suite?
- [ ] Can it run repeatedly without failing on the second run?
- [ ] Does it leave residue (files, rows, connections, processes)?
- [ ] Does it depend on wall-clock time, randomness, or live network?
- [ ] Does it assert behavior rather than implementation details?
- [ ] Will the failure message clearly indicate what broke?
- [ ] Is setup minimal -- only what this test needs?
- [ ] Is cleanup registered immediately and safe to run multiple times?
- [ ] Is the test level (unit/integration/e2e) appropriate for what it proves?

## Output Expectations

**When writing a new test:**
1. State the chosen test level and why
2. Note key dependencies being isolated and how
3. Describe the setup and cleanup approach
4. Write the test using Arrange / Act / Assert
5. Briefly explain why the test is reliable

**When reviewing an existing test:**
1. Identify flake risks (non-determinism, shared state, timing)
2. Identify cleanup or idempotency gaps
3. Identify assertion brittleness
4. Suggest a better structure if warranted
5. Rewrite the test if the issues are significant enough
