# Open Questions — optimize-mcp-install-check

This file tracks reservations from ACCEPT-WITH-RESERVATIONS reviewer verdicts for this plan.

## Review Reservations - 2026-04-11

### From Phase 2 (Plan Review) — Ruinor ACCEPT-WITH-RESERVATIONS

**R-P1 (MAJOR) — Acceptance criteria wording vs. actual signature scope**
The plan's acceptance criteria (Step 2, line 88) says "Changing a field in mcp-servers.json for a wrapper server causes that server to be re-registered on the next run." However, the signature only includes fields that affect the `claude mcp add` invocation: `name`, `scope`, `transport`, `wrapperPath`. Fields like `prereq` are intentionally excluded. The wording is misleading.
*Recommended action:* Update the plan's acceptance criteria wording to say "Changing a field that affects the `claude mcp add` invocation" rather than "Changing a field."

**R-P2 (MAJOR) — Implicit `updatedStamps` behavior on skip path**
The plan does not explicitly state that on the skip path (stamp match + `mcp get` succeeds), `updatedStamps[server.name]` is already preserved via the `{ ...stamps }` initialization. An implementer might mistakenly add an explicit mutation in the skip branch.
*Status:* Implementer handled this correctly — no explicit mutation was added on the skip path. Resolved in practice.

### From Phase 4 (Implementation Review) — Ruinor ACCEPT-WITH-RESERVATIONS

**R-I1 (MAJOR) — `readStamps` does not guard against valid-but-non-object JSON**
`readStamps` handles invalid JSON (catch → return `{}`) but does not guard against valid JSON that is not a plain object (e.g., `null`, `42`, `[1,2]`). If the stamps file contains `null`, `JSON.parse` succeeds and returns `null`, which is then cast to `Record<string, string>`. Downstream `stamps[server.name]` on `null` would throw.
*Recommended fix before merge:*
```typescript
const parsed = JSON.parse(raw);
if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
  console.log(c.yellow(`Warning: MCP stamps file at ${stampsPath} has unexpected format -- resetting`));
  return {};
}
return parsed as Record<string, string>;
```
*Also add test case:* `it("returns empty object when file contains valid non-object JSON")` — write `"null"` to a temp file, assert `deepStrictEqual` to `{}`.

**R-I2 (MINOR) — Missing test for valid-but-non-object JSON in `readStamps`**
Test-side counterpart of R-I1. No test currently covers this case.
*Recommended fix:* Add the test case described in R-I1.

**R-I3 (MINOR) — Warning message deviation from plan (cosmetic)**
`readStamps` warning message is `"Warning: MCP stamps file at ${stampsPath} contains invalid JSON -- resetting"` rather than the plan's specified `"Warning: MCP stamps file is corrupted, will re-register all wrapper servers"`. The implemented message is more informative.
*No action required* — this is an improvement. Document here for traceability.
