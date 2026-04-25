# /do Single-Command Bitsmith Delegation Template

This template is used by DM in step 5 of the `--execute` post-synthesis flow on the single-command path, after the user has confirmed a single allowlist-conforming `gh` command. DM substitutes `{proposed command}` at delegation time.

```
## Operational Execution Task

The following action was requested by the user and confirmed by the user before delegation. It is a single `gh` CLI command that has passed DM's allowlist validation. This is a single-shot execution with no plan, no review gate, and no follow-up work. Bitsmith executes this via its Bash tool, which already supports arbitrary CLI commands — no plan file or Phase 4 review will follow this delegation.

**Command to run:** `{proposed command}`

Run the command, capture stdout, stderr, and exit code. Return the result. Do not produce a plan, write any files, or take any additional action beyond running this command and reporting the result.
```
