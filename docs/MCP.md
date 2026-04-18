# MCP Servers

This document covers the MCP (Model Context Protocol) servers configured by this repository: the server roster, stamp-based skipping, and the configuration file format.

## Server Roster

The installer automatically configures user-scoped MCP servers in `~/.claude.json` when the `claude` CLI is available. Server definitions are read from a declarative `src/mcp/mcp-servers.json` file, allowing you to add or modify servers without editing TypeScript code.

Currently configured servers:

- **Kubernetes MCP Server** (`mcp-server-kubernetes@3.4.0`) — Read-only Kubernetes cluster access via `~/.kube/config`. Skips setup gracefully if that file does not exist.
- **AWS CloudWatch MCP Server** (`awslabs.cloudwatch-mcp-server@0.0.19`) — CloudWatch Metrics, Alarms, and Logs access via `~/.aws` credentials. Uses `src/mcp/wrappers/mcp-cloudwatch.sh` for dynamic AWS profile selection (set with `/set-aws-profile`). Requires `uvx`. Skips setup gracefully if `~/.aws/credentials` does not exist.
- **Grafana MCP Server** (`mcp-grafana`) — Grafana dashboards, datasources, and incident access. Uses `src/mcp/wrappers/mcp-grafana.sh`, which requires `GRAFANA_URL` and `GRAFANA_SERVICE_ACCOUNT_TOKEN` in the shell environment.
- **GitHub MCP Server** (`@modelcontextprotocol/server-github`) — GitHub repository, issue, PR, and code search access. Requires `GITHUB_PERSONAL_ACCESS_TOKEN` set in `src/mcp/mcp-servers.json` before running `install.sh`. Note: the npm package was archived 2025-05-29; the Docker-based successor (`ghcr.io/github/github-mcp-server`) is not used here to avoid a Docker dependency.
- **GCP Observability MCP Server** (`@google-cloud/observability-mcp@0.2.3`) — Read-only access to GCP Cloud Logging, Monitoring, Trace, and Error Reporting. Requires Node.js 20+ and the gcloud CLI. Authenticate before running `install.sh`: `gcloud auth application-default login` then `gcloud auth application-default set-quota-project YOUR_PROJECT_ID`.

MCP servers are available in all repositories once configured.

**Stamp-based skipping:** After a wrapper-based server is registered, the installer records a config signature in `~/.claude/.mcp-install-stamps.json`. On subsequent runs, if the signature matches and the registration is intact, the server is skipped. To force re-registration of all wrapper servers (e.g., after a broken install or to pick up manual `src/mcp/mcp-servers.json` edits that the installer did not detect), delete this file and re-run `./install.sh`.

## MCP Server Configuration Format

Server definitions live in `src/mcp/mcp-servers.json`. Each server uses either a `command` field (inline command array) or a `wrapper` field (path relative to `~/.claude/` pointing to an installed wrapper script) — the two are mutually exclusive. Wrapper scripts live in `src/mcp/wrappers/` in the repo and are installed to `~/.claude/wrappers/` by `install.sh`, so a `wrapper` value of `wrappers/mcp-cloudwatch.sh` resolves to `~/.claude/wrappers/mcp-cloudwatch.sh` at runtime. `$HOME` and `$USER` variable expansion is supported in string values.

Two key operational behaviors: a missing `src/mcp/mcp-servers.json` produces a warning and skips MCP setup (installation continues); a malformed JSON file or schema violation stops installation with a non-zero exit code. See `src/mcp/mcp-servers.json` for the schema and `src/installer/mcp.ts` for the installation logic.
