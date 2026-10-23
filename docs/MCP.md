# MCP Servers

This document covers the MCP (Model Context Protocol) servers configured by this repository: the server roster, stamp-based skipping, and the configuration file format.

## Server Roster

The installer automatically configures user-scoped MCP servers in `~/.claude.json` when the `claude` CLI is available. Server definitions are read from a declarative `src/mcp/mcp-servers.json` file, allowing you to add or modify servers without editing TypeScript code.

Currently configured servers:

- **Kubernetes MCP Server** (`mcp-server-kubernetes@4.1.9`) — Read-only Kubernetes cluster access via `~/.kube/config`, with **one server covering every context**. The wrapper at `~/.claude/wrappers/mcp-kubernetes.sh` always sets `ALLOW_ONLY_READONLY_TOOLS=true`, so only get, describe, logs, explain, list-api-resources, ping and the context tools are registered. Each call names its cluster with the tool's `context` argument; the `kubernetes-context-guard.sh` `PreToolUse` hook (installed to `~/.claude/hooks/`) denies any call without a `context` that exists in the kubeconfig, and denies `kubectl_context` with `operation: "set"`, which would rewrite the global `current-context`. `ping`, `kubectl_reconnect`, and `kubectl_context` list/get need no `context`. The hook denies every Kubernetes call when `jq` is missing. There is no `tpk` step: the server never relies on a default context. The installer warns if `~/.kube/config` does not exist, and the wrapper exits with an error.
- **AWS CloudWatch MCP Server** (`awslabs.cloudwatch-mcp-server@0.3.1`) — CloudWatch Metrics, Alarms, and Logs access via `~/.aws` credentials. Uses `src/mcp/wrappers/mcp-cloudwatch.sh` for dynamic AWS profile selection (set with `/set-aws-profile`). Requires `uvx`. Skips setup gracefully if `~/.aws/credentials` does not exist.
- **Grafana MCP Servers** (`mcp-grafana`) — Read-only Grafana dashboards, datasources, Prometheus, Loki, alerting, incident, and on-call access, with **one always-on server per Grafana cluster**. Define your clusters in `~/.config/tpk/grafana-clusters.yaml` (schema in [docs/TPK.md § Grafana Configuration](/docs/TPK.md#grafana-configuration)) and **set its mode to `0600`: `chmod 600 ~/.config/tpk/grafana-clusters.yaml`**. The wrapper refuses to read the file at MCP-server boot if the mode is broader than `0600`, and the installer prints a warning.

  Every cluster with a non-empty `url` and `viewer_token` becomes a registered MCP server (`grafana-aws-prd-use1`, …) and a tool namespace (`mcp__grafana-aws-prd-use1__*`). Clusters without a `viewer_token` are skipped with a warning. Cluster ids must match `^[a-zA-Z0-9-]+$` — letters, digits, and hyphens only, because the id becomes part of tool names, where Claude Code rewrites `.` and treats `__` as a separator. `editor_token` is not used: there is no write access through MCP.

  The wrapper at `~/.claude/wrappers/mcp-grafana.sh` resolves the cluster's `url` and `viewer_token` at runtime via the `GRAFANA_CLUSTER` env var injected by the installer, and always passes `--disable-write`. **No token is stored in `~/.claude.json`**; rotating a token takes effect on the next MCP server boot without re-running `install.sh`, but adding or removing a cluster requires re-running `install.sh`. The wrapper requires **`uv`** (for `uvx mcp-grafana` and for parsing the YAML with a pinned PyYAML).

  On each run, the installer also removes the legacy single `grafana` registration (previously configured per session by `tpk`), removes stale `grafana-<id>` registrations and their `mcp__grafana-<id>__*` allow-list entries, drops the legacy `mcp__grafana__<tool>` allow-list entries, and auto-approves each registered server with one `mcp__grafana-<id>__*` entry (safe because every server is read-only). Agents that restrict their tools (Tracebloom, Windwarden) list `mcp__grafana__*` in their `tools:` frontmatter as a placeholder; the installer expands it in the installed copy to one `mcp__grafana-<id>__*` entry per registered cluster, because Claude Code does not support wildcards in the server-name part of a tool rule.

  Each server is a separate process started with every session. With many clusters, expect a slower session start; tool search (`ENABLE_TOOL_SEARCH`) keeps their tool definitions out of the context until they are needed.
- **GitHub MCP Server** (`@modelcontextprotocol/server-github@2025.4.8`) — Multi-account GitHub repository, issue, PR, and code search access via `~/.config/tpk/github-pats.json`. Define your accounts as a flat JSON object mapping account names to PATs:

  ```json
  {"personal": "ghp_xxx", "work": "ghp_yyy"}
  ```

  **Set the file mode to `0600` immediately after creation: `chmod 600 ~/.config/tpk/github-pats.json`.** The file holds long-lived GitHub PATs in plaintext; on multi-user hosts a default umask (`022`) leaves it world-readable. The wrapper refuses to read the file at MCP-server boot if the mode is broader than `0600`, and the installer prints a warning.

  Each key becomes the suffix of a registered MCP server (`github-personal`, `github-work`) and a tool namespace (`mcp__github-personal__*`, `mcp__github-work__*`). Account keys must match `^[a-zA-Z0-9_.-]+$`.

  The wrapper at `~/.claude/wrappers/mcp-github.sh` selects the token at runtime via the `GITHUB_ACCOUNT` env var injected by the installer. **The PAT is not stored in `~/.claude.json`**; rotating the token in `~/.config/tpk/github-pats.json` takes effect on the next MCP server boot without re-running `install.sh`.

  The wrapper invokes **`pnpx`** (pnpm's equivalent of the npm runner) because this repository uses pnpm. Users without pnpm installed must install it (<https://pnpm.io/installation>) before GitHub MCP servers can spawn. The wrapper pins `@modelcontextprotocol/server-github@2025.4.8` to protect against any future "latest" publish on the abandoned package name (archived 2025-05-29; the Docker-based successor `ghcr.io/github/github-mcp-server` is not used here to avoid a Docker dependency).

  If `~/.config/tpk/github-pats.json` is missing or empty (`{}`) at install time, GitHub MCP setup is skipped with a yellow warning and installation continues. On each run, the installer also removes the legacy `github` (no suffix) registration, removes stale `github-<key>` registrations, and removes stale `mcp__github-<key>__*` allow-list entries for keys no longer present in the PATs file.
- **ArgoCD MCP Servers** (`argocd-mcp@0.9.0`) — Read-only ArgoCD application, resource, event, and log access, with **one always-on server per ArgoCD cluster**. Define your clusters in `~/.config/tpk/argocd-accounts.json` as a JSON object mapping cluster ids to `{ url, token }` pairs:

  ```json
  { "prod": { "url": "https://argocd.prod.example.com", "token": "..." }, "staging": { "url": "https://argocd.staging.example.com", "token": "..." } }
  ```

  **Set the file mode to `0600` immediately after creation: `chmod 600 ~/.config/tpk/argocd-accounts.json`.** ArgoCD tokens are equivalent in sensitivity to GitHub PATs; the wrapper refuses to read the file if the mode is broader than `0600`.

  Every cluster with an `http(s)` `url` and a non-empty `token` becomes a registered MCP server (`argocd-prod`, …) and a tool namespace (`mcp__argocd-prod__*`). Clusters failing either check are skipped with a warning. Cluster ids must match `^[a-zA-Z0-9-]+$` — letters, digits, and hyphens only, for the same tool-name reason as Grafana cluster ids.

  The wrapper at `~/.claude/wrappers/mcp-argocd.sh` resolves the cluster's `url` and `token` at runtime via the `ARGOCD_CLUSTER` env var injected by the installer, and always sets `MCP_READ_ONLY=true`, which removes the write tools (`create_application`, `update_application`, `delete_application`, `sync_application`, `run_resource_action`). **No token is stored in `~/.claude.json`**; rotating a token takes effect on the next MCP server boot without re-running `install.sh`, but adding or removing a cluster requires re-running `install.sh`. The wrapper requires **`python3`** (available by default on macOS and Linux) to parse the accounts file.

  On each run, the installer also removes the legacy single `argocd` registration (previously pointed at the cluster selected in `tpk`), removes stale `argocd-<id>` registrations and their `mcp__argocd-<id>__*` allow-list entries, drops any legacy `mcp__argocd__<tool>` allow-list entries, and auto-approves each registered server with one `mcp__argocd-<id>__*` entry (safe because every server is read-only). Like the Grafana servers, each is a separate process started with every session.
- **GCP Observability MCP Server** (`@google-cloud/observability-mcp@0.2.3`) — Read-only access to GCP Cloud Logging, Monitoring, Trace, and Error Reporting. Requires Node.js 20+ and the gcloud CLI. Authenticate before running `install.sh`: `gcloud auth application-default login` then `gcloud auth application-default set-quota-project YOUR_PROJECT_ID`.

MCP servers are available in all repositories once configured.

**Stamp-based skipping:** After a wrapper-based server is registered, the installer records a config signature in `~/.claude/.mcp-install-stamps.json`. On subsequent runs, if the signature matches and the registration is intact, the server is skipped. To force re-registration of all wrapper servers (e.g., after a broken install or to pick up manual `src/mcp/mcp-servers.json` edits that the installer did not detect), delete this file and re-run `./install.sh`.

## MCP Server Configuration Format

Server definitions live in `src/mcp/mcp-servers.json`. Each server uses either a `command` field (inline command array) or a `wrapper` field (path relative to `~/.claude/` pointing to an installed wrapper script) — the two are mutually exclusive. Wrapper scripts live in `src/mcp/wrappers/` in the repo and are installed to `~/.claude/wrappers/` by `install.sh`, so a `wrapper` value of `wrappers/mcp-cloudwatch.sh` resolves to `~/.claude/wrappers/mcp-cloudwatch.sh` at runtime. `$HOME` and `$USER` variable expansion is supported in string values.

Two key operational behaviors: a missing `src/mcp/mcp-servers.json` produces a warning and skips MCP setup (installation continues); a malformed JSON file or schema violation stops installation with a non-zero exit code. See `src/mcp/mcp-servers.json` for the schema and `src/installer/mcp.ts` for the installation logic.
