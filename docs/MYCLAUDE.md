# myclaude — Session Launcher

This document covers the `myclaude` interactive wizard: per-MCP configuration wizards, environment variables it sets, and persistence behavior.

## Overview

The `myclaude` command is an interactive wizard that configures MCP environment variables and launches Claude with the Dungeon Master agent. Instead of manually exporting environment variables before each session, you run `myclaude` from your shell to select your desired MCPs and their configuration (Grafana cluster + role, AWS profile, GCP project), then launch a pre-configured Claude session.

**Prerequisites:** Run `./install.sh` first to install the launcher to `~/bin/myclaude`.

**Usage:** From any directory, run:

```bash
myclaude
```

The wizard will present a multi-step flow:

1. **MCP Selection** — Choose which MCPs to configure for this session (Grafana, CloudWatch, GCP Observability, and/or Kubernetes)
2. **Per-MCP Configuration** — For each selected MCP, choose its settings (cluster/role for Grafana; AWS profile for CloudWatch; GCP project ID for GCP Observability; kube context for Kubernetes)
3. **Launch** — Claude opens with `--agent dungeonmaster` and the correct environment variables set

**Persistence:** Your last-used selections are saved to `~/.config/myclaude/config.json` and pre-fill the wizard on your next run. You can accept them with Enter or change them.

## Grafana Configuration

Create `~/.config/grafana-clusters.yaml` with your cluster definitions. The file must use this YAML schema:

```yaml
clusters:
  - id: prod-us-east
    name: Production US-East
    url: https://grafana.prod.us-east.example.com
    viewer_token: glsa_xxxxxxxxxxxxxxxx_viewer
    editor_token: glsa_xxxxxxxxxxxxxxxx_editor

  - id: staging
    name: Staging
    url: https://grafana.staging.example.com
    viewer_token: glsa_yyyyyyyyyyyyyyyy_viewer
    editor_token: glsa_yyyyyyyyyyyyyyyy_editor
```

Each cluster requires:
- `id` — Unique identifier for the cluster
- `name` — Display name shown in the wizard
- `url` — Grafana URL (must start with `http://` or `https://`)
- `viewer_token` — Grafana service account token with read-only permissions
- `editor_token` — Grafana service account token with read-write permissions

The wizard lets you select a cluster and choose a role (Viewer or Editor). If you select Viewer, the launcher automatically sets `GRAFANA_DISABLE_WRITE=true`, which the Grafana MCP server wrapper translates into the `--disable-write` CLI flag.

**Legacy token migration:** If your clusters use a single `token` field instead of separate `viewer_token`/`editor_token` fields, the launcher will fall back to using `token` as `viewer_token` with a warning. Update your YAML to add the new token fields to remove the warning.

## CloudWatch Configuration

The launcher reads AWS profiles from `~/.aws/config` (preferred) or `~/.aws/credentials` (fallback when config is absent). In the wizard, select your active profile for the current session. The launcher stores this choice in `~/.claude/.current-aws-profile` so the CloudWatch MCP server wrapper can resolve it at startup.

**Note:** This is equivalent to running `/set-aws-profile` in Claude — the launcher and the slash command write to the same dotfile, so they stay in sync.

## GCP Observability Configuration

Before using GCP Observability, authenticate with Application Default Credentials (ADC):

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

When "GCP Observability" is selected, the launcher runs `gcloud projects list` to fetch accessible projects and checks for valid ADC credentials (checking `GOOGLE_APPLICATION_CREDENTIALS` first, then `~/.config/gcloud/application_default_credentials.json`). If both steps succeed, the launcher shows a `select()` prompt with the available project IDs; the previously used project is pre-selected when it is still present in the list. The selected project ID is stored in `~/.claude/.current-gcp-project` for the MCP wrapper and persisted for the next run. If `gcloud` is not installed, not authenticated, or returns no projects — or if ADC credentials are unavailable — the launcher logs a warning, skips the GCP Observability MCP, and continues launching Claude with the remaining selected MCPs. Run `gcloud auth application-default login` and re-launch to enable GCP. Failures in the Grafana, CloudWatch, or Kubernetes loaders are handled the same way: a warning is printed, that MCP is skipped, and the wizard continues with the remaining selections.

**Note:** `GOOGLE_CLOUD_PROJECT` is used by the auth library for project ID resolution only — it does not auto-populate tool call parameters. Specify `resourceNames`, `parent`, `name`, or `projectId` explicitly in each tool call. The wrapper prints the active project to stderr as a context hint for Claude.

## Kubernetes Configuration

**Prerequisite:** `kubectx` must be installed and on `PATH`; if it is absent, the launcher logs a warning, skips the Kubernetes MCP, and continues launching Claude with the remaining selections.

When "Kubernetes" is selected, the launcher runs `kubectx` to list available contexts and prompts you to select one. The selected context name is stored in `~/.claude/.current-kube-context` and exported as `K8S_CONTEXT` for the Kubernetes MCP server. If the chosen context differs from the previously saved one, the launcher invokes `kubectx <context>` to switch the active context. If the switch fails, the launcher logs a warning, skips the Kubernetes MCP for this session, and neither `K8S_CONTEXT` nor `~/.claude/.current-kube-context` are written — your previously active context in `~/.kube/config` is used instead.

## Environment Variables Set by myclaude

When you select Grafana with Viewer role, the launcher sets:
```
GRAFANA_URL={cluster_url}
GRAFANA_SERVICE_ACCOUNT_TOKEN={viewer_token}
GRAFANA_DISABLE_WRITE=true
```

When you select Grafana with Editor role:
```
GRAFANA_URL={cluster_url}
GRAFANA_SERVICE_ACCOUNT_TOKEN={editor_token}
```

When you select CloudWatch:
```
AWS_PROFILE={profile}
```

When you select GCP Observability:
```
GOOGLE_CLOUD_PROJECT={project_id}
```

When you select Kubernetes:
```
K8S_CONTEXT={context_name}
```

These variables are passed to `claude --agent dungeonmaster`, and they flow through to all MCP server subprocesses.
