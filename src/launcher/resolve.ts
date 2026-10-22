import type { ResolvedConfig, LauncherConfig } from './types.js';
import { registry, StaleResourceError } from './mcp-command.js';

/**
 * Returns `config` with `selectedMcps` limited to ids in the registry. Saved
 * configs can name MCPs that tpk no longer manages (e.g. `grafana`, now
 * registered per cluster by the installer); without this they would show as
 * "(unknown MCP)" on the summary screen and be passed to the multiselect as
 * initial values that match no option. Does not mutate `config`.
 */
export function withKnownMcpsOnly(config: LauncherConfig): LauncherConfig {
  const known = new Set(registry.map((c) => c.id));
  return {
    ...config,
    selectedMcps: config.selectedMcps.filter((id) => known.has(id)),
  };
}

export function buildResolvedFromSaved(
  config: LauncherConfig,
): ResolvedConfig | null {
  const resolved: ResolvedConfig = {};

  for (const name of config.selectedMcps) {
    const cmd = registry.find((c) => c.id === name);
    if (cmd === undefined) continue; // unknown MCP — silently skip (preserves current default-case behaviour)
    try {
      const fragment = cmd.resolveFromSaved(config);
      if (fragment === null) continue; // sub-object missing — silent skip
      Object.assign(resolved, fragment);
    } catch (err) {
      if (err instanceof StaleResourceError) {
        return null; // trigger fall-through to configure flow
      }
      throw err;
    }
  }

  return resolved;
}
