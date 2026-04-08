# GitHub Account Probe — Shared Reference

This file defines the canonical procedure for verifying GitHub account access before pushing or committing. All skills that require GitHub authentication verification must reference this file.

## Probe Procedure

1. **Extract owner/repo:** Parse the remote URL from `git remote get-url origin` to extract `{owner}/{repo}`.
2. **Probe access:** Run `gh api repos/{owner}/{repo}` as a harmless read-only probe.
3. **If probe succeeds:** The current authenticated account has access to this repository. Proceed with the operation.
4. **If probe fails:** Run `gh auth switch` to cycle to the next authenticated GitHub account.
5. **Repeat:** Probe again with the new account. Continue cycling until access is confirmed or all authenticated accounts are exhausted.
6. **If all accounts fail:** Abort the operation and report that no authenticated GitHub account has access to this repository.

## Additional Checks (PR workflow only)

When this probe is used before pushing or opening a PR (as opposed to committing):

- **Do not push or open the PR** until the probe succeeds.
- **Commit author verification:** Once the correct account is confirmed, verify `git config user.email` belongs to that account (cross-check with `gh api user --jq '.email'` if unsure). Fix with `git config user.email "correct@email.com"` if wrong.
