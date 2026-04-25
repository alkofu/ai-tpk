# Launcher Module — tpk Interactive Wizard

The launcher is a TypeScript module that implements the `tpk` interactive wizard. It allows users to configure MCP environment variables and launch Claude with the Dungeon Master agent in a single command.

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
tpk
```

To launch Claude with an initial prompt (bypasses the wizard):

```bash
tpk --skip "/feature-issue 42"
```

Launches Claude with the given string as its first prompt. Requires `--skip` (the wizard cannot also forward an initial message).

## Startup Behavior

**First run** (no saved config): the wizard goes straight to MCP selection. Choices are saved to `~/.config/tpk/config.json` after you complete the flow.

**Subsequent runs** (saved config exists): a summary screen is shown before any prompts.

```
┌  tpk — Session Launcher
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

If the saved Grafana cluster ID no longer exists in `~/.config/tpk/grafana-clusters.yaml`, the launch path is skipped and the configure flow starts automatically with a warning.

**`--skip` flag:** Pass `--skip` on the command line to bypass the summary screen entirely and launch Claude immediately with the saved config. The flag is parsed by `argv.ts` before `loadConfig` is called. If the saved config is unusable, the launcher exits non-zero with one of two stderr messages (no saved config, or stale/unresolvable config) — it never falls back to the interactive flow. Any unknown flag causes exit code 2. Example: `pnpm exec tsx src/launcher/main.ts --skip`.

## Initial Message Forwarding

Pass an initial message as a positional argument to forward it verbatim to `claude` as its first prompt:

```bash
tpk --skip <initial-message>
```

**Rules:**

- `--skip` is required when supplying an initial message. If an initial message is given without `--skip`, the launcher writes `Initial message requires --skip. Usage: tpk --skip <initial-message>` to stderr and exits with code `2`. No wizard banner is printed.
- Only one positional argument is allowed. If two or more are supplied, the launcher writes `Too many positional arguments. Only one initial message is allowed. Usage: tpk [--skip] [<initial-message>]` to stderr and exits with code `2`. No wizard banner is printed.
- Any token starting with `-` other than `--skip` (including single-dash tokens like `-h` and the bare `-`) is rejected as an unknown flag. It is never captured as the initial message.
- The message is passed verbatim to `claude` — quoting at the shell level controls whether spaces become one argument or many. The launcher performs no further tokenisation.

## Testing

Tests are colocated with source as `*.test.ts` files. Non-MCP tests (`argv.test.ts`, `env.test.ts`, `resolve.test.ts`, `outro.test.ts`, `summary.test.ts`, `config.test.ts`, `utils.test.ts`, `mcp-command.test.ts`) live in `src/launcher/`. MCP-specific tests (`cloudwatch.test.ts`, `grafana.test.ts`, `gcp-observability.test.ts`, `kubernetes.test.ts`, `argocd.test.ts`) live in `src/launcher/mcp/`. Run all tests (installer + launcher) with:

```bash
pnpm test
```

## Grafana Configuration Format

The launcher reads `~/.config/tpk/grafana-clusters.yaml`. Required structure:

```yaml
clusters:
  - id: prod-us-east
    name: Production US-East
    url: https://grafana.prod.example.com
    viewer_token: glsa_xxxxxxxxxxxxxxxx_viewer
    editor_token: glsa_xxxxxxxxxxxxxxxx_editor
```

**Required fields:** `id`, `name`, `url`, `viewer_token`, `editor_token`.

**Legacy fallback:** If a cluster has only a `token` field, the launcher warns and uses it as `viewer_token` (see `mcp/grafana.ts` for details). Ensure the file is readable only by the user: `chmod 600 ~/.config/tpk/grafana-clusters.yaml`.

## Environment Variables and Role Translation

The launcher constructs environment variables based on user selections:

- **Grafana Viewer:** Sets `GRAFANA_DISABLE_WRITE=true`, which `src/mcp/wrappers/mcp-grafana.sh` translates to `--disable-write` for the Grafana MCP server.
- **Grafana Editor:** Does not set `GRAFANA_DISABLE_WRITE` (read-write mode).
- **CloudWatch:** Writes the selected AWS profile to `~/.claude/.current-aws-profile` (shared with the CloudWatch MCP wrapper).
- **GCP Observability:** Sets `GOOGLE_CLOUD_PROJECT` in the environment for `google-auth-library` project ID resolution, and writes the project ID to `~/.claude/.current-gcp-project` (shared with `src/mcp/wrappers/mcp-gcp-observability.sh`). Note: `GOOGLE_CLOUD_PROJECT` is read by the auth library's `getProjectId()` but does **not** auto-populate tool call parameters — users still need to specify `resourceNames`, `parent`, `name`, or `projectId` in each tool call.
- **Kubernetes:** Sets `K8S_CONTEXT` to the selected context name, which takes priority over the active context in `~/.kube/config` when other kubeconfig env vars are present. Also writes `~/.claude/.current-kube-context`.

## Persistence Format

User selections are saved to `~/.config/tpk/config.json` with mode 0600. If the file is missing or malformed, the config loader returns a default empty config, and the wizard prompts for selections on first run.

## Architecture

The launcher uses the GoF Command pattern to eliminate per-MCP branching. Each MCP is a single `McpCommand` object that owns its full lifecycle; all orchestration files iterate a shared registry rather than switching on MCP name.

### McpCommand pattern

`mcp-command-types.ts` defines the `McpCommand` interface and the `StaleResourceError` class. Each MCP module under `mcp/` exports a command instance implementing that interface. `mcp-command.ts` imports those five instances and exports the `registry: McpCommand[]` array in canonical order (Grafana → CloudWatch → GCP Observability → Kubernetes → ArgoCD). It re-exports `McpCommand` and `StaleResourceError` as the public entry point for consumers; command implementations import from `mcp-command-types.ts` directly to avoid a circular dependency.

The `McpCommand` interface captures every per-MCP responsibility:

| Member                                         | Responsibility                                                                                                                                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                           | Multiselect ID; also persisted in `LauncherConfig.selectedMcps`                                                                                                                                                 |
| `skippedKey`                                   | Key in `SkippedMap` (differs from `id` only for `gcp-observability`, which uses `"gcp"`)                                                                                                                        |
| `multiselectOption`                            | The `{ value, label, hint }` entry shown in the MCP selection prompt                                                                                                                                            |
| `configureInteractive`                         | Loads resources (clusters, profiles, contexts), prompts the user, returns resolved + persistable fragments, or `null` on loader failure                                                                         |
| `resolveFromSaved`                             | Reconstructs the resolved fragment from a persisted config without prompting. Returns `null` if the sub-object is absent; may throw `StaleResourceError` (Grafana only) when a saved reference no longer exists |
| `emitEnvVars`                                  | Writes env vars and any dotfiles for this MCP into the shared env map                                                                                                                                           |
| `buildOutroSuccessLine` / `buildOutroSkipLine` | Produces the text shown in the `Launching: …` outro                                                                                                                                                             |
| `buildSummaryLine`                             | Produces the line shown in the saved-config summary screen                                                                                                                                                      |

`StaleResourceError` is the signal for Grafana's stale-cluster fall-through. `resolve.ts` catches it and returns `null`, which triggers the configure flow in `main.ts`. No other command throws this error.

### Orchestration files

| File             | Responsibility                                                                                                                                                                                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main.ts`        | Entry point. Parses argv via `argv.ts` and short-circuits to a saved-config launch when `--skip` is present. Configure flow iterates `registry` to call `configureInteractive` for each selected MCP. Calls `applyKubernetesContextSwitch` explicitly after `saveConfig` and before `buildEnvVars` |
| `argv.ts`        | `parseArgs(argv)` — pure lexical parser; returns `{ skip, initialMessage }`. Throws `UnknownFlagError` for unknown flags and `TooManyPositionalsError` for more than one positional.                                                                                                               |
| `claude-args.ts` | `buildClaudeArgs(initialMessage)` — pure helper that produces the `claude` spawn argv. Single source of truth for the spawn-arg shape; called from `launchClaude` in `main.ts`.                                                                                                                    |
| `resolve.ts`     | `buildResolvedFromSaved` — iterates `config.selectedMcps`, calls `cmd.resolveFromSaved`, catches `StaleResourceError`                                                                                                                                                                              |
| `env.ts`         | `buildEnvVars` — iterates `registry`, calls `cmd.emitEnvVars`                                                                                                                                                                                                                                      |
| `outro.ts`       | `buildOutroLines` — two registry passes: success lines first, then skip lines, both in registry order                                                                                                                                                                                              |
| `summary.ts`     | `formatSummaryLines` + `promptSummaryAction` — looks up each selected MCP in the registry by id                                                                                                                                                                                                    |
| `prompts.ts`     | `selectMcps` — derives multiselect options from `registry.map(c => c.multiselectOption)`                                                                                                                                                                                                           |
| `config.ts`      | Persistence: load/save `~/.config/tpk/config.json`                                                                                                                                                                                                                                                 |
| `types.ts`       | All shared TypeScript types (`ResolvedConfig`, `LauncherConfig`, `SkippedMap`, per-MCP config interfaces)                                                                                                                                                                                          |

### Shared helpers

- `utils.ts` — `tryLoad` (returns `null` and emits `log.warn` on failure) and `errorMessage`
- `dotfile.ts` — `writeDotfile`: writes a named dotfile to `~/.claude/.<name>` with mode 0600; used by CloudWatch, GCP Observability, and Kubernetes command implementations
- `cancel.ts` — `handleCancel`: exits the process if a prompt returns a cancel signal; extracted from `prompts.ts` to avoid a circular dep (`prompts.ts` → `mcp-command.ts` → `mcp/*.ts` → `prompts.ts`)

### Kubernetes post-save side effect

Kubernetes requires a context switch (`kubectx <ctx>`) after the user's choice is persisted but before env vars are built. This is handled by `applyKubernetesContextSwitch` exported from `mcp/kubernetes.ts` and called explicitly in `launchClaude`. It is a named function at a visible call site rather than a generic hook in the registry — intentionally, so the side effect is auditable without tracing an abstraction. A future MCP that needs post-save behavior follows the same pattern: add a named function in its module and an explicit call in `launchClaude`.

### Adding a new MCP

For an MCP with no post-save side effect (the common case), the required changes are:

1. **Create `src/launcher/mcp/<name>.ts`** — export a `<name>Command: McpCommand` constant. Import `McpCommand` from `../mcp-command-types.js` (not `../mcp-command.js`) to avoid the circular dependency.
2. **Register it** in `src/launcher/mcp-command.ts` — one import line and one entry in the `registry` array.
3. **Extend `src/launcher/types.ts`** with four additions:
   - A config interface for the resolved sub-shape (e.g., `DatadogConfig`)
   - `datadog?: DatadogConfig` on `ResolvedConfig`
   - `datadog?: false | "loader-failed"` on `SkippedMap`
   - `datadog?: { /* persisted fields */ }` on `LauncherConfig`

No edits to `main.ts`, `env.ts`, `resolve.ts`, `outro.ts`, `summary.ts`, or `prompts.ts` are needed.

For an MCP that requires a post-save side effect, additionally export a named function from its module (e.g., `applyDatadogPostSave`) and add an explicit import and call site in `launchClaude` in `main.ts`.

The comment block at the top of `mcp-command.ts` repeats this checklist as an in-code reference.

## Integration with install.sh

Installation is handled by `src/installer/launcher-install.ts`. The process is idempotent: it copies the pre-built bundle to `~/.ai-tpk/launcher.cjs` and installs the `~/bin/tpk` bootstrap script. On upgrade, any old `~/.claude/launcher/` directory is automatically removed, and any stale `~/.ai-tpk/launcher.js` from a previous install is removed. The installed launcher has zero runtime dependency on the ai-tpk repository.

## Migration: Existing grafana-mcp Script

Users with the legacy `~/bin/grafana-mcp` script can continue using it or switch to `tpk`. The two are independent; there is no automatic migration.

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

If neither source provides a valid credential file, the launcher logs a warning, skips the GCP Observability MCP, and continues launching Claude with the remaining selected MCPs. Run `gcloud auth application-default login` and re-launch to enable GCP.

### Project selection

When 'GCP Observability' is selected in the MCP multiselect, the launcher first runs `gcloud projects list --format=value(projectId) --sort-by=projectId` to fetch the set of accessible projects, then performs an informational ADC credential check. If both succeed, the launcher presents a `select()` prompt listing the available project IDs. If either step fails, the launcher logs a warning, skips the GCP MCP, and continues with the remaining selected MCPs (no project prompt is shown). When the prompt does run and the previously used project is still in the list it is pre-selected; otherwise the first project in the list is selected.

If `gcloud` is not on `PATH`, exits non-zero, or returns no projects, the launcher logs a warning, skips the GCP MCP, and continues with the rest of the session. Failures in any other MCP loader (Grafana, CloudWatch, Kubernetes) are also non-fatal: the launcher logs a warning, skips that MCP, and continues with the remaining selected MCPs.

The selected project ID is written to `~/.claude/.current-gcp-project` (mode 0600) and persisted to `~/.config/tpk/config.json` for use as the default on the next run. `GOOGLE_CLOUD_PROJECT` is also set in the child process environment for `google-auth-library` project resolution.

### What GOOGLE_CLOUD_PROJECT does and does not do

`GOOGLE_CLOUD_PROJECT` tells `google-auth-library`'s `getProjectId()` which project to use for quota and billing. It does **not** auto-populate tool call parameters such as `resourceNames`, `parent`, `name`, or `projectId`. Claude (and users) must still include the project reference explicitly in each tool call. The wrapper prints `GCP Observability MCP: project '<id>'` to stderr at startup as a context hint.

### Wrapper behavior

`src/mcp/wrappers/mcp-gcp-observability.sh` resolves the active project at MCP startup:

1. Reads `~/.claude/.current-gcp-project` (dotfile takes priority over any env var already set)
2. Validates the project ID format (lowercase letters, digits, hyphens; 6-30 characters; must start with a letter and not end with a hyphen)
3. Exports `GOOGLE_CLOUD_PROJECT` and launches `@google-cloud/observability-mcp@0.2.3` via `npx`

If the dotfile is absent or empty, and no project was set another way, the wrapper exits with a helpful error pointing the user back to the `tpk` launcher.

## Kubernetes Configuration

### Prerequisites

`kubectx` must be installed and on `PATH`. A valid `~/.kube/config` with at least one context must exist. The launcher does not install `kubectx` — if it is absent, the launcher logs a warning, skips the Kubernetes MCP, and continues launching Claude with the remaining selections.

### Context selection and switching

When "Kubernetes" is selected in the MCP multiselect, the launcher runs `kubectx` (no arguments) to list available contexts and presents a `select` prompt. The previously saved context is offered as the default; if none is saved, the current active context from `kubectl config current-context` is used as the fallback, then the first context in the list.

If the selected context differs from the saved previous context, the launcher runs `kubectx <selected>` to switch the active context in `~/.kube/config` before launching Claude. Re-selecting the same context skips the switch. The switch happens via `applyKubernetesContextSwitch` (exported from `mcp/kubernetes.ts`), called in `launchClaude` after `saveConfig` completes and before `buildEnvVars` is called. See `mcp/kubernetes.ts` for `switchContext` (the underlying kubectx call) and `applyKubernetesContextSwitch` (the post-save orchestration).

### What env var and dotfile are written

`buildEnvVars` in `env.ts` sets `K8S_CONTEXT` to the selected context name. The Kubernetes MCP server (`mcp-server-kubernetes`) reads this to determine which context to use, overriding whatever context is currently active in `~/.kube/config`. This override matters when `KUBECONFIG` or other kubeconfig env vars are present in the environment.

`~/.claude/.current-kube-context` is also written (mode 0600) for symmetry with the CloudWatch and GCP patterns, and to support potential future wrapper scripts or slash commands that need the selected context at runtime.

If the `kubectx` switch fails, `applyKubernetesContextSwitch` clears `kubernetes` from the resolved config and sets `effectiveSkipped.kubernetes = "switch-failed"`. As a result, `buildEnvVars` emits neither `K8S_CONTEXT` nor the dotfile, and the outro line reflects the skip — keeping display, env export, and dotfile consistent.

### Persistence

The selected context is saved under `kubernetes.context` in `~/.config/tpk/config.json` and offered as the default on the next run.

## See Also

- **`src/launcher/argv.ts`** — Argv parser used by `main.ts`; exports `parseArgs`, `UnknownFlagError`, and `TooManyPositionalsError`
- **`src/launcher/claude-args.ts`** — `buildClaudeArgs` helper that produces the `claude` spawn argv from the optional initial message; used by `launchClaude` in `main.ts`.
- **`src/mcp/wrappers/mcp-grafana.sh`** — Bash wrapper that translates `GRAFANA_DISABLE_WRITE=true` to `--disable-write`
- **`src/mcp/wrappers/mcp-gcp-observability.sh`** — Bash wrapper that resolves the GCP project from the dotfile and launches the Observability MCP server
- **`src/launcher/mcp-command-types.ts`** — `McpCommand` interface and `StaleResourceError` class
- **`src/launcher/mcp-command.ts`** — Registry, re-exports of core types, and the "how to add a new MCP" comment block
- **`src/launcher/mcp/kubernetes.ts`** — `kubectx` context listing, selection prompt, context switching, and `applyKubernetesContextSwitch`
- **`src/launcher/mcp/argocd.ts`** — ArgoCD cluster listing from `~/.config/tpk/argocd-accounts.json`, cluster selection prompt, and dotfile write to `~/.claude/.current-argocd-cluster`
- **`src/mcp/wrappers/mcp-argocd.sh`** — Bash wrapper that reads `~/.claude/.current-argocd-cluster`, extracts the matching `url` and `token` from `~/.config/tpk/argocd-accounts.json` via `python3`, and launches `argocd-mcp@0.5.0`
- **`src/installer/launcher-install.ts`** — Installation logic for the launcher
