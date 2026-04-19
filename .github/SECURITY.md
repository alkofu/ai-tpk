# Security Policy

`ai-tpk` is a personal developer-tooling project that installs agents, skills,
hooks, and MCP wrapper scripts into the user's home directory. Vulnerabilities in
the installer, the wrappers, or the shell scripts can have real impact on a user's
machine. The maintainer takes such reports seriously despite the project's small
scale.

## Supported Versions

This project has no release cadence and publishes no versioned releases. Only the
current `main` branch is supported. Fixes are made on `main`, and users are
expected to run `git pull` followed by `install.sh` to receive them.

## Reporting a Vulnerability

Please use GitHub's **Private Vulnerability Reporting** to disclose security
issues: [Report a vulnerability](https://github.com/alkofu/ai-tpk/security/advisories/new).

Do not file public issues for vulnerabilities. When submitting a report, please
include:

- A description of the issue
- Reproduction steps
- The affected file(s) or commit
- Any suggested mitigation

## Scope

**In scope:**

- `install.sh`, `recover.sh`, `clean-backups.sh`, `build.ts`
- TypeScript installer (`src/installer/`)
- Launcher (`src/launcher/`)
- MCP wrapper scripts under `src/mcp/wrappers/`
- POSIX shell scripts under `claude/scripts/*.sh` (recently extracted helpers that
  run on the user's machine)
- Hook scripts under `claude/hooks/**` (deployed to `~/.claude/hooks/` by
  `install.sh`)
- Any skill under `claude/skills/` that ships executable code

**Out of scope:**

- Third-party MCP servers that this project merely registers — report those to the
  respective upstream projects
- Claude Code itself — report those issues to Anthropic
- A user's own `~/.claude/` modifications made after install

## Disclosure Policy

- Acknowledgement of the report within **7 days**
- Initial assessment and severity triage within **30 days**
- Coordinated disclosure: the maintainer will agree a public-disclosure date with
  the reporter once a fix is merged on `main`; credit will be given in the GitHub
  Security Advisory unless the reporter requests anonymity

## Out-of-Band Channel

If Private Vulnerability Reporting is unavailable for any reason, open a minimal
public issue titled `Security: please contact me` (without details) and the
maintainer will arrange a private channel.

## Non-Security Bugs

Non-security bug reports and feature requests belong on the regular
[GitHub issue tracker](https://github.com/alkofu/ai-tpk/issues).
