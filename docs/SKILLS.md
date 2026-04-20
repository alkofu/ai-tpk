# Agents, References, and Skills

This document covers agents (with a pointer to the full roster), the shared reference files catalog, and the skills catalog (mandatory and additional).

## Agents (`claude/agents/`)

Agents are specialized AI assistants that help with specific tasks. They are automatically available in Claude Code.

See [docs/AGENTS.md](/docs/AGENTS.md) for the agent roster and quick reference. For detailed operational specs, tool lists, and workflows, see each agent's config file in `claude/agents/{name}.md`.

**Invoking an agent:**
Simply @-mention the agent by name (e.g., `@quill` or `@riskmancer`) in your Claude conversation to activate it.

## References

Reference files contain shared behavioral vocabulary loaded by agents at runtime. These files eliminate duplication across multiple agent definitions and ensure consistency in how agents apply shared concepts.

### Available References

- **`bash-style.md`** — Required Bash command style for all agents with Bash tool access. Defines four enforced rules: no compound commands (`&&`, `;`), no process substitution (`<(`, `>(`), no `--no-verify` on git commands, and no command substitution (`$(...)`) or heredoc patterns in git commit commands (use multiple `-m` flags instead). The PermissionRequest hook enforces the first three rules automatically; the fourth is an instruction-level override of Claude Code's built-in commit pattern.

- **`implementation-standards.md`** — Shared behavioral norms for implementation, planning, and review agents: Minimal Diff, YAGNI, and Test-First Protocol. Bitsmith, Pathfinder, Ruinor, and Knotcutter cite this as the canonical source. Each agent may elaborate with role-specific depth in its own definition file.

- **`verdict-taxonomy.md`** — Shared verdict labels (REJECT, REVISE, ACCEPT-WITH-RESERVATIONS, ACCEPT) and severity scales (Ruinor's CRITICAL/MAJOR/MINOR and Specialist CRITICAL/HIGH/MEDIUM/LOW). Reviewer agents load this reference when issuing verdicts. Defines shared vocabulary while noting that domain-specific application is defined per-agent.

- **`worktree-protocol.md`** — Shared rules for interpreting the `WORKING_DIRECTORY:` context block. Agents that operate in isolated git worktrees load this reference to ensure consistent path handling across all file operations and bash commands.

- **`completion-templates.md`** — Four rigid per-command completion report templates and a shared Common Fields block. Defines what the DM must emit at the end of each pipeline: Template A (Constructive, `/feature`), Template B (Investigative, `/bug`), Template C (Operational PR, `/open-pr`), and Template D (Post-Merge, `/merged` and `/merge-pr`). The DM output contract references this file; templates are verbatim formats with no formatting discretion left to the model.

- **`dm-routing-examples.md`** — Worked routing examples for the Dungeon Master, covering multi-step plans, trivial changes, user flags, explore-options, worktrees, intake, investigation, scope confirmation, advisory queries, and ops reports.

- **`github-auth-probe.md`** — Canonical procedure for verifying GitHub account access before pushing or committing. Referenced by the `commit-message-guide` and `open-pull-request` skills.

- **`review-gates.md`** — Shared two-gate review framework (Plan Review Gate and Implementation Review Gate) for all reviewer agents. Defines universal operational constraints and plan-file-scoping rules.

- **`quill-documentation-style.md`** — Documentation style guide used by Quill when authoring and updating documentation.

- **`specialist-triggering.md`** — Canonical keyword list for the Dungeon Master's heuristic-fallback specialist-routing logic. Covers four keyword categories (security, performance, complexity, factual validation) and their corresponding specialist suggestions. DM consults this only when no user flag is present and Ruinor has not recommended specialists. Also documents why Truthhammer's keyword set is intentionally narrow. See [docs/adrs/REVIEW_WORKFLOW.md](/docs/adrs/REVIEW_WORKFLOW.md) for the broader specialist-triggering decision model.

When updating a reference file, changes apply automatically to all agents that load it — no individual agent files need modification.

## Skills (`claude/skills/`)

Skills are reusable capabilities that enhance Claude's functionality. Three mandatory global skills are enforced via `CLAUDE.md`:

- **`commit-message-guide`** — Enforces conventional commit format for all git commits
- **`validate-before-pr`** — Runs lint and format checks (via stack detection: npm, Make, Python, Go, Rust) before opening a PR; gates PR creation on passing checks
- **`open-pull-request`** — Creates pull requests with conventional naming, draft mode, and pre-flight validation

Additional skills (non-mandatory):

- **`write-reliable-tests`** — Guides authorship and review of deterministic, isolated, and idempotent automated tests across unit, integration, and e2e levels; applied automatically whenever test code is being written or evaluated
- **`file-organization`** — Guide for file and module organization decisions
- **`bash-code-quality`** — Defensive coding standards for bash scripts authored as deliverables: strict mode, safe quoting, error trapping, recurring patterns, and anti-patterns; applied automatically when writing or editing `.sh` files or scripts with a bash shebang
- **`skill-creator`** — Creates and improves skills in this repository
