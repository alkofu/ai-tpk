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

## Persistence Format

User selections are saved to `~/.config/myclaude/config.json` with mode 0600. If the file is missing or malformed, the config loader returns a default empty config, and the wizard prompts for selections on first run.

## Architecture

The wizard orchestration lives in `main.ts`. Type definitions are in `types.ts`. MCP-specific logic is split across:

- `mcp/grafana.ts` — Cluster YAML parsing and cluster/role selection
- `mcp/cloudwatch.ts` — AWS profile parsing and profile selection

Shared utilities (cancellation, prompts) are in `utils.ts` and `prompts.ts`. The `env.ts` module builds environment variables; `config.ts` handles persistence; `launch.ts` executes the final Claude command.

## Integration with install.sh

Installation is handled by `src/installer/launcher-install.ts`. The process is idempotent: it copies the pre-built bundle to `~/.ai-tpk/launcher.cjs` and installs the `~/bin/myclaude` bootstrap script. On upgrade, any old `~/.claude/launcher/` directory is automatically removed, and any stale `~/.ai-tpk/launcher.js` from a previous install is removed. The installed launcher has zero runtime dependency on the ai-tpk repository.

## Migration: Existing grafana-mcp Script

Users with the legacy `~/bin/grafana-mcp` script can continue using it or switch to `myclaude`. The two are independent; there is no automatic migration.

## See Also

- **`src/wrappers/mcp-grafana.sh`** — Bash wrapper that translates `GRAFANA_DISABLE_WRITE=true` to `--disable-write`
- **`src/installer/launcher-install.ts`** — Installation logic for the launcher
