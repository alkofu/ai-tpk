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

## Testing

Tests are colocated with source as `*.test.ts` files in `src/launcher/`. Run all tests (installer + launcher) with:

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

- **Grafana Viewer:** Sets `GRAFANA_DISABLE_WRITE=true`, which `src/wrappers/mcp-grafana.sh` translates to `--disable-write` for the Grafana MCP server.
- **Grafana Editor:** Does not set `GRAFANA_DISABLE_WRITE` (read-write mode).
- **CloudWatch:** Writes the selected AWS profile to `~/.claude/.current-aws-profile` (shared with the CloudWatch MCP wrapper).
- **GCP Observability:** Sets `GOOGLE_CLOUD_PROJECT` in the environment for `google-auth-library` project ID resolution, and writes the project ID to `~/.claude/.current-gcp-project` (shared with `src/wrappers/mcp-gcp-observability.sh`). Note: `GOOGLE_CLOUD_PROJECT` is read by the auth library's `getProjectId()` but does **not** auto-populate tool call parameters — users still need to specify `resourceNames`, `parent`, `name`, or `projectId` in each tool call.

## Persistence Format

User selections are saved to `~/.config/myclaude/config.json` with mode 0600. If the file is missing or malformed, the config loader returns a default empty config, and the wizard prompts for selections on first run.

## Architecture

The wizard orchestration lives in `main.ts`. Type definitions are in `types.ts`. MCP-specific logic is split across:

- `mcp/grafana.ts` — Cluster YAML parsing and cluster/role selection
- `mcp/cloudwatch.ts` — AWS profile parsing and profile selection
- `mcp/gcp-observability.ts` — ADC credential check, project ID validation, and project prompt

Shared utilities (cancellation, prompts) are in `utils.ts` and `prompts.ts`. The `env.ts` module builds environment variables; `config.ts` handles persistence; `launch.ts` executes the final Claude command.

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

### Project ID prompt

When "GCP Observability" is selected in the MCP multiselect, the launcher prompts for a GCP project ID. The previous project is offered as the default. The ID is validated before being accepted:

- 6–30 characters
- Lowercase letters, digits, and hyphens only
- Must start with a lowercase letter
- Must not end with a hyphen
- Must not contain consecutive hyphens

The validated project ID is written to `~/.claude/.current-gcp-project` (mode 0600) and persisted to `~/.config/myclaude/config.json` for use as the default on the next run. `GOOGLE_CLOUD_PROJECT` is also set in the child process environment for `google-auth-library` project resolution.

### What GOOGLE_CLOUD_PROJECT does and does not do

`GOOGLE_CLOUD_PROJECT` tells `google-auth-library`'s `getProjectId()` which project to use for quota and billing. It does **not** auto-populate tool call parameters such as `resourceNames`, `parent`, `name`, or `projectId`. Claude (and users) must still include the project reference explicitly in each tool call. The wrapper prints `GCP Observability MCP: project '<id>'` to stderr at startup as a context hint.

### Wrapper behavior

`src/wrappers/mcp-gcp-observability.sh` resolves the active project at MCP startup:

1. Reads `~/.claude/.current-gcp-project` (dotfile takes priority over any env var already set)
2. Validates the project ID against the same rules as the launcher
3. Exports `GOOGLE_CLOUD_PROJECT` and launches `@google-cloud/observability-mcp@0.2.3` via `npx`

If the dotfile is absent or empty, and no project was set another way, the wrapper exits with a helpful error pointing the user back to the `myclaude` launcher.

## See Also

- **`src/wrappers/mcp-grafana.sh`** — Bash wrapper that translates `GRAFANA_DISABLE_WRITE=true` to `--disable-write`
- **`src/wrappers/mcp-gcp-observability.sh`** — Bash wrapper that resolves the GCP project from the dotfile and launches the Observability MCP server
- **`src/installer/launcher-install.ts`** — Installation logic for the launcher
