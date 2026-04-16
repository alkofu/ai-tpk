# Launcher Module — myclaude Interactive Wizard

The launcher is a TypeScript module that implements the `myclaude` interactive wizard. It allows users to configure MCP environment variables and launch Claude with the Dungeon Master agent in a single command.

## Quick Start

### For Developers (requires pnpm)

From the repository root:

```bash
pnpm run launch
```

Or directly:

```bash
pnpm exec tsx src/launcher/main.ts
```

### For End-Users (after `./install.sh`)

After installation via `./install.sh`, the launcher is available as:

```bash
myclaude
```

## Startup Behavior

**First run** (no saved config): the wizard goes straight to MCP selection. Choices are saved to `~/.config/myclaude/config.json` after you complete the flow.

**Subsequent runs** (saved config exists): a summary screen is shown before any prompts.

```
┌  myclaude — Session Launcher
│
◆  Current Configuration
│  Grafana: cluster prod-us-east, role viewer
│  CloudWatch: profile my-aws-profile
└
◆  What would you like to do?
│  ● Launch  (start Claude with current config)
│  ○ Configure  (change MCP settings)
└
```

| Action    | Key                | Effect                                                                     |
| --------- | ------------------ | -------------------------------------------------------------------------- |
| Launch    | Enter              | Launches Claude immediately with the saved config. Config is not re-saved. |
| Configure | Arrow-down + Enter | Enters the full MCP selection flow. Config is re-saved on completion.      |

If the saved Grafana cluster ID no longer exists in `~/.config/grafana-clusters.yaml`, the launch path is skipped and the configure flow starts automatically with a warning.

## Testing

Tests are colocated with source as `*.test.ts` files. Non-MCP tests (`env.test.ts`, `config.test.ts`, `utils.test.ts`) live in `src/launcher/`. MCP-specific tests (`cloudwatch.test.ts`, `grafana.test.ts`, `gcp-observability.test.ts`, `kubernetes.test.ts`) live in `src/launcher/mcp/`. Run all tests (installer + launcher) with:

```bash
pnpm test
```

## Grafana Configuration Format

The launcher reads `~/.config/grafana-clusters.yaml`. Required structure:

```yaml
clusters:
  - id: prod-us-east
    name: Production US-East
    url: https://grafana.prod.example.com
    viewer_token: glsa_xxxxxxxxxxxxxxxx_viewer
    editor_token: glsa_xxxxxxxxxxxxxxxx_editor
```

**Required fields:** `id`, `name`, `url`, `viewer_token`, `editor_token`.

**Legacy fallback:** If a cluster has only a `token` field, the launcher warns and uses it as `viewer_token` (see `mcp/grafana.ts` for details). Ensure the file is readable only by the user: `chmod 600 ~/.config/grafana-clusters.yaml`.

## Environment Variables and Role Translation

The launcher constructs environment variables based on user selections:

- **Grafana Viewer:** Sets `GRAFANA_DISABLE_WRITE=true`, which `src/mcp/wrappers/mcp-grafana.sh` translates to `--disable-write` for the Grafana MCP server.
- **Grafana Editor:** Does not set `GRAFANA_DISABLE_WRITE` (read-write mode).
- **CloudWatch:** Writes the selected AWS profile to `~/.claude/.current-aws-profile` (shared with the CloudWatch MCP wrapper).
- **GCP Observability:** Sets `GOOGLE_CLOUD_PROJECT` in the environment for `google-auth-library` project ID resolution, and writes the project ID to `~/.claude/.current-gcp-project` (shared with `src/mcp/wrappers/mcp-gcp-observability.sh`). Note: `GOOGLE_CLOUD_PROJECT` is read by the auth library's `getProjectId()` but does **not** auto-populate tool call parameters — users still need to specify `resourceNames`, `parent`, `name`, or `projectId` in each tool call.
- **Kubernetes:** Sets `K8S_CONTEXT` to the selected context name, which takes priority over the active context in `~/.kube/config` when other kubeconfig env vars are present. Also writes `~/.claude/.current-kube-context`.

## Persistence Format

User selections are saved to `~/.config/myclaude/config.json` with mode 0600. If the file is missing or malformed, the config loader returns a default empty config, and the wizard prompts for selections on first run.

## Architecture

The wizard orchestration lives in `main.ts`. The summary screen gate (`promptSummaryAction`) is in `summary.ts`; the logic that reconstructs a `ResolvedConfig` from persisted data without re-prompting is in `resolve.ts`. Type definitions are in `types.ts`. MCP-specific logic is split across:

- `mcp/grafana.ts` — Cluster YAML parsing and cluster/role selection
- `mcp/cloudwatch.ts` — AWS profile parsing and profile selection
- `mcp/gcp-observability.ts` — ADC credential check and project prompt
- `mcp/kubernetes.ts` — `kubectx` context listing, selection prompt, and context switching

Shared utilities are split across `utils.ts` (exports `errorMessage` and `tryLoad`) and `prompts.ts` (exports `handleCancel` and `selectMcps`). The `env.ts` module builds environment variables (using a private `writeDotfile` helper); `config.ts` handles persistence. Claude is launched inline in `main.ts` via `spawnSync`.

## Integration with install.sh

Installation is handled by `src/installer/launcher-install.ts`. The process is idempotent: it copies the pre-built bundle to `~/.ai-tpk/launcher.cjs` and installs the `~/bin/myclaude` bootstrap script. On upgrade, any old `~/.claude/launcher/` directory is automatically removed, and any stale `~/.ai-tpk/launcher.js` from a previous install is removed. The installed launcher has zero runtime dependency on the ai-tpk repository.

## Migration: Existing grafana-mcp Script

Users with the legacy `~/bin/grafana-mcp` script can continue using it or switch to `myclaude`. The two are independent; there is no automatic migration.

## GCP Observability Configuration

### Prerequisites

Authenticate with Application Default Credentials (ADC) before running the launcher:

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

The launcher checks for ADC at startup in this order:

1. `GOOGLE_APPLICATION_CREDENTIALS` env var (if set and the file exists, the check passes)
2. `~/.config/gcloud/application_default_credentials.json` (the default ADC path)

If neither source provides a valid credential file, the launcher exits with a descriptive error before prompting for a project ID.

### Project selection

When "GCP Observability" is selected in the MCP multiselect, the launcher first runs `gcloud projects list --format=value(projectId) --sort-by=projectId` to fetch the set of accessible projects, then checks ADC credentials, then presents a `select()` prompt listing the available project IDs. If the previously used project is still in the list it is pre-selected; otherwise the first project in the list is selected.

If `gcloud` is not on `PATH`, exits non-zero, or returns no projects, a descriptive error is logged and the launcher exits before showing the ADC check or the prompt.

The selected project ID is written to `~/.claude/.current-gcp-project` (mode 0600) and persisted to `~/.config/myclaude/config.json` for use as the default on the next run. `GOOGLE_CLOUD_PROJECT` is also set in the child process environment for `google-auth-library` project resolution.

### What GOOGLE_CLOUD_PROJECT does and does not do

`GOOGLE_CLOUD_PROJECT` tells `google-auth-library`'s `getProjectId()` which project to use for quota and billing. It does **not** auto-populate tool call parameters such as `resourceNames`, `parent`, `name`, or `projectId`. Claude (and users) must still include the project reference explicitly in each tool call. The wrapper prints `GCP Observability MCP: project '<id>'` to stderr at startup as a context hint.

### Wrapper behavior

`src/mcp/wrappers/mcp-gcp-observability.sh` resolves the active project at MCP startup:

1. Reads `~/.claude/.current-gcp-project` (dotfile takes priority over any env var already set)
2. Validates the project ID format (lowercase letters, digits, hyphens; 6-30 characters; must start with a letter and not end with a hyphen)
3. Exports `GOOGLE_CLOUD_PROJECT` and launches `@google-cloud/observability-mcp@0.2.3` via `npx`

If the dotfile is absent or empty, and no project was set another way, the wrapper exits with a helpful error pointing the user back to the `myclaude` launcher.

## Kubernetes Configuration

### Prerequisites

`kubectx` must be installed and on `PATH`. A valid `~/.kube/config` with at least one context must exist. The launcher does not install `kubectx` — if it is absent, the launcher exits with a descriptive error pointing to the install instructions.

### Context selection and switching

When "Kubernetes" is selected in the MCP multiselect, the launcher runs `kubectx` (no arguments) to list available contexts and presents a `select` prompt. The previously saved context is offered as the default; if none is saved, the current active context from `kubectl config current-context` is used as the fallback, then the first context in the list.

If the selected context differs from the saved previous context, the launcher runs `kubectx <selected>` to switch the active context in `~/.kube/config` before launching Claude. Re-selecting the same context skips the switch. The switch happens in `main.ts` immediately after the prompt, before `buildEnvVars` is called — see `mcp/kubernetes.ts` (`switchContext`) for the exact behavior.

### What env var and dotfile are written

`buildEnvVars` in `env.ts` sets `K8S_CONTEXT` to the selected context name. The Kubernetes MCP server (`mcp-server-kubernetes`) reads this to determine which context to use, overriding whatever context is currently active in `~/.kube/config`. This override matters when `KUBECONFIG` or other kubeconfig env vars are present in the environment.

`~/.claude/.current-kube-context` is also written (mode 0600) for symmetry with the CloudWatch and GCP patterns, and to support potential future wrapper scripts or slash commands that need the selected context at runtime.

### Persistence

The selected context is saved under `kubernetes.context` in `~/.config/myclaude/config.json` and offered as the default on the next run.

## See Also

- **`src/mcp/wrappers/mcp-grafana.sh`** — Bash wrapper that translates `GRAFANA_DISABLE_WRITE=true` to `--disable-write`
- **`src/mcp/wrappers/mcp-gcp-observability.sh`** — Bash wrapper that resolves the GCP project from the dotfile and launches the Observability MCP server
- **`src/launcher/mcp/kubernetes.ts`** — `kubectx` context listing, selection prompt, and context switching logic
- **`src/installer/launcher-install.ts`** — Installation logic for the launcher
