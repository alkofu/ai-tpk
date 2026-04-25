# Contributing

This document covers the Continuous Integration setup and the configuration update workflow for this repository.

## Continuous Integration

Pull requests targeting `main` are validated by a GitHub Actions workflow at `.github/workflows/ci.yml`. See the workflow file for the specific checks that run. For formatting failures, run `pnpm run format` and commit the result.

## Configuration Updates

When updating Claude configurations (agents, skills, commands, hooks, references, or settings):

1. Make changes in this repository
2. Test the configurations
3. Commit and push changes
4. Pull on other machines to sync

When adding new hooks, agents, or skills, update the relevant documentation file under `docs/` — `HOOKS.md` for hooks, `MCP.md` for MCP servers, `SKILLS.md` for agents, references, and skills, `SLASH_COMMANDS.md` for slash commands, `TPK.md` for the session launcher, and `INSTRUCTIONS.md` for instruction-level changes.
