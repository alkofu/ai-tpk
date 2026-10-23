# tpk — Session Launcher

This document covers the `tpk` interactive wizard: per-MCP configuration wizards, environment variables it sets, and persistence behavior.

## Migration Notes

If you have used a previous version of this tool (before the rename to `tpk`), the following changes apply after running `./install.sh`:

- The new launcher binary is installed as `~/bin/tpk`. The legacy binary at `~/bin/` under the old name is **not** removed by `install.sh` — you may delete it manually when you are ready.
- Your saved launcher config is **copied** (not moved) from the old config directory to `~/.config/tpk/config.json` on install. The legacy file is preserved — you may delete it manually.
- The three previously root-level config files are **copied** (not moved) into `~/.config/tpk/` on install. Each file is copied from `~/.config/<filename>` to `~/.config/tpk/<filename>`:
  - `~/.config/tpk/argocd-accounts.json`
  - `~/.config/tpk/github-pats.json`
  - `~/.config/tpk/grafana-clusters.yaml`
  - Legacy files at the old root-level `~/.config/` paths are preserved — you may delete them manually.
- All three of `argocd-accounts.json`, `github-pats.json`, and `grafana-clusters.yaml` must henceforth live under `~/.config/tpk/` to be read by the launcher, installer, and MCP wrappers. The runtime code no longer reads from the old root-level paths.

## Overview

The `tpk` command is an interactive wizard that configures MCP environment variables and launches Claude with your choice of agent — the Dungeon Master or the default Claude agent. Instead of manually exporting environment variables before each session, you run `tpk` from your shell to select your desired MCPs and their configuration (AWS profile, GCP project), then launch a pre-configured Claude session. Grafana, ArgoCD, and Kubernetes are not part of the wizard: the installer registers one always-on, read-only MCP server per Grafana cluster and per ArgoCD cluster (see [Grafana Configuration](#grafana-configuration) and [ArgoCD Configuration](#argocd-configuration)), and a single read-only Kubernetes server that takes the context on every call (see [Kubernetes Configuration](#kubernetes-configuration)).

**Prerequisites:** Run `./install.sh` first to install the launcher to `~/bin/tpk`.

**Usage:** From any directory, run:

```bash
tpk
```

The wizard will present a multi-step flow:

1. **MCP Selection** — Choose which MCPs to configure for this session (CloudWatch and/or GCP Observability)
2. **Per-MCP Configuration** — For each selected MCP, choose its settings (AWS profile for CloudWatch; GCP project ID for GCP Observability)
3. **Agent Selection** — Choose **Dungeon Master** (`claude --agent dungeonmaster`) or **Default Claude** (`claude` with no `--agent` flag)
4. **Launch** — Claude opens with the chosen agent and the correct environment variables set

The agent prompt is also shown after choosing **Launch** on the summary screen, so you can switch agents on every run without reconfiguring MCPs. Your last choice is preselected; if none is saved, Dungeon Master is preselected.

**Persistence:** Your last-used selections (including the agent) are saved to `~/.config/tpk/config.json` and pre-fill the wizard on your next run. You can accept them with Enter or change them. A `grafana`, `argocd`, or `kubernetes` selection saved by an older `tpk` is ignored.

### `--skip`: launch immediately with saved config

Pass `--skip` to bypass the interactive summary screen and launch Claude immediately using whatever is currently saved in `~/.config/tpk/config.json`, including the saved agent (Dungeon Master if none is saved). The short alias `-S` (uppercase) is fully equivalent to `--skip` and may be used interchangeably.

```bash
tpk --skip
```

```bash
tpk -S
```

This is useful for scripts, hot-key launches, and users who never want to see the summary screen.

**Strict failure behaviour** — `--skip` never falls back to the interactive flow. Instead it exits non-zero with a clear error message in two cases:

- **No saved config:** If `~/.config/tpk/config.json` contains no MCP selections, the launcher prints to stderr and exits with code 1:

  ```
  No saved config found — run tpk without --skip first to configure.
  ```

- **Stale saved config:** If the saved config cannot be resolved (a saved resource is no longer valid), the launcher prints to stderr and exits with code 1. No current MCP triggers this; it is reserved for MCPs that persist a reference to an external resource:

  ```
  Saved config could not be resolved (a saved resource is no longer valid) — re-run tpk without --skip to reconfigure.
  ```

In both cases, run `tpk` without `--skip` to (re)configure.

**Unknown flags** are rejected with exit code 2. Any token other than `--skip` or `-S` prints `Unknown flag: <flag>. Usage: tpk [--skip]` to stderr and exits immediately.

### `batch-open-issues.sh`: open one tab per issue

`batch-open-issues.sh` is a helper script installed to `~/.claude/scripts/` that accepts one or more GitHub issue numbers (or full issue URLs) and opens one new terminal tab or window per issue, each running `tpk --skip '/feature-issue <n>'`.

**Usage:**

```bash
batch-open-issues.sh 42 1-4 https://github.com/owner/repo/issues/7
```

Each argument can be a bare integer (`42`), an integer range like `1-4` (inclusive; expands to `1 2 3 4` in argument order; `start` must be `<=` `end`; both endpoints are non-negative integers; leading zeros are accepted; no upper bound on range size), or a GitHub issue URL in the form `https://github.com/<owner>/<repo>/issues/<n>` (with an optional trailing `/`, `?query`, or `#anchor`). Ranges apply only to bare integers, not URLs.

**Supported terminals:** tmux (new window with `-c "$PWD"`), iTerm2 (new tab via AppleScript, inherits current session CWD), and cmux (new workspace via `cmux new-workspace --cwd "$PWD" --name "issue-<n>" --command "<cmd>"`). cmux is detected via `$CMUX_WORKSPACE_ID` (set automatically inside any cmux terminal session). The cmux binary is located by searching `$PATH` first, then falling back to the bundled CLI at `/Applications/cmux.app/Contents/Resources/bin/cmux`. If neither resolves, that issue's spawn fails (recorded in the partial-failure summary) but other issues continue. Standalone Ghostty (Ghostty running without cmux) is not supported and produces exit code 3.

**Exit codes:**

| Code | Meaning |
|------|---------|
| 0 | All tabs spawned successfully |
| 2 | Missing or unparseable arguments, or required library not found |
| 3 | Unsupported terminal (standalone Ghostty) or undetected terminal |
| 4 | One or more tab spawns failed (partial success) |

**Prerequisite:** Requires the initial-message forwarding PR to be merged before use. That PR extended the launcher to accept an initial-message positional argument alongside `--skip`. If your installed `tpk` predates that merge, the tabs will open but each session will fail silently — re-run `install.sh` against an updated checkout to fix.

**Spawn success is not session success.** The script reports whether the tab was opened, not whether `tpk` started correctly inside it. Verify each tab visually after launch.

The script header comment is the authoritative reference for usage, exit codes, and dependencies.

## Grafana Configuration

Grafana is configured by the installer, not by the `tpk` wizard. Create `~/.config/tpk/grafana-clusters.yaml` with your cluster definitions, then run `chmod 600 ~/.config/tpk/grafana-clusters.yaml` and `./install.sh`. The file must use this YAML schema:

```yaml
clusters:
  - id: prod-us-east
    name: Production US-East
    url: https://grafana.prod.us-east.example.com
    viewer_token: glsa_xxxxxxxxxxxxxxxx_viewer

  - id: staging
    name: Staging
    url: https://grafana.staging.example.com
    viewer_token: glsa_yyyyyyyyyyyyyyyy_viewer
```

Each cluster uses:
- `id` — Unique identifier; letters, digits, and hyphens only. It names the MCP server (`grafana-<id>`) and its tools (`mcp__grafana-<id>__*`).
- `url` — Grafana URL
- `viewer_token` — Grafana service account token with read-only permissions. Clusters without one get no MCP server.
- `name` — Optional display name (not used by the installer or wrapper)

Every cluster with a `url` and `viewer_token` gets its own read-only MCP server, always on in every session, started with `--disable-write`. Re-run `install.sh` after adding, removing, or renaming a cluster; token changes take effect on the next session without reinstalling. See [docs/MCP.md § Server Roster](/docs/MCP.md#server-roster) for how registration, allow-listing, and agent access work.

**Not supported:** `editor_token` (there is no write access through MCP) and the legacy single `token` field (rename it to `viewer_token`).

## CloudWatch Configuration

The launcher reads AWS profiles from `~/.aws/config` (preferred) or `~/.aws/credentials` (fallback when config is absent). In the wizard, select your active profile for the current session. The launcher stores this choice in `~/.claude/.current-aws-profile` so the CloudWatch MCP server wrapper can resolve it at startup.

**Note:** This is equivalent to running `/set-aws-profile` in Claude — the launcher and the slash command write to the same dotfile, so they stay in sync.

## GCP Observability Configuration

Before using GCP Observability, authenticate with Application Default Credentials (ADC):

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

When "GCP Observability" is selected, the launcher runs `gcloud projects list` to fetch accessible projects and checks for valid ADC credentials (checking `GOOGLE_APPLICATION_CREDENTIALS` first, then `~/.config/gcloud/application_default_credentials.json`). If both steps succeed, the launcher shows a `select()` prompt with the available project IDs; the previously used project is pre-selected when it is still present in the list. The selected project ID is stored in `~/.claude/.current-gcp-project` for the MCP wrapper and persisted for the next run. If `gcloud` is not installed, not authenticated, or returns no projects — or if ADC credentials are unavailable — the launcher logs a warning, skips the GCP Observability MCP, and continues launching Claude with the remaining selected MCPs. Run `gcloud auth application-default login` and re-launch to enable GCP. Failures in the CloudWatch or Kubernetes loaders are handled the same way: a warning is printed, that MCP is skipped, and the wizard continues with the remaining selections.

**Note:** `GOOGLE_CLOUD_PROJECT` is used by the auth library for project ID resolution only — it does not auto-populate tool call parameters. Specify `resourceNames`, `parent`, `name`, or `projectId` explicitly in each tool call. The wrapper prints the active project to stderr as a context hint for Claude.

## Kubernetes Configuration

Kubernetes is configured by the installer, not by the `tpk` wizard, and needs no per-session choice. One read-only server reaches every context in `~/.kube/config`; name the cluster in your request (e.g. "check pods in aws-prd-use1 and aws-prd-use2") and Claude passes it as each tool call's `context`. A `PreToolUse` hook rejects calls without a valid `context`, so a vague request is never silently sent to whichever context your terminal last selected. `tpk` no longer runs `kubectx`, so launching Claude never changes your shell's current context. See [docs/MCP.md § Server Roster](/docs/MCP.md#server-roster) for the read-only mode and the hook.

## ArgoCD Configuration

ArgoCD is configured by the installer, not by the `tpk` wizard. Create `~/.config/tpk/argocd-accounts.json` with your cluster definitions, then run `chmod 600 ~/.config/tpk/argocd-accounts.json` and `./install.sh`. The file must use this JSON schema:

```json
{
  "prod": { "url": "https://argocd.prod.example.com", "token": "..." },
  "staging": { "url": "https://argocd.staging.example.com", "token": "..." }
}
```

Each key is a cluster id; letters, digits, and hyphens only. It names the MCP server (`argocd-<id>`) and its tools (`mcp__argocd-<id>__*`). Ids with `_` or `.`, which older versions accepted, are skipped with a warning — rename them. **Set the file mode to `0600` immediately after creation.** The wrapper refuses to read the file if the mode is broader than `0600`.

Every cluster with an `http(s)` `url` and a `token` gets its own read-only MCP server (`MCP_READ_ONLY=true`), always on in every session. Re-run `install.sh` after adding, removing, or renaming a cluster; token changes take effect on the next session without reinstalling. See [docs/MCP.md § Server Roster](/docs/MCP.md#server-roster) for how registration and allow-listing work.

## Environment Variables Set by tpk

When you select CloudWatch:

```
AWS_PROFILE={profile}
```

When you select GCP Observability:

```
GOOGLE_CLOUD_PROJECT={project_id}
```

These variables are passed to the `claude` process (with `--agent dungeonmaster` when the Dungeon Master is selected), and they flow through to all MCP server subprocesses.
