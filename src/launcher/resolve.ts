import type { ResolvedConfig, LauncherConfig } from './types.js';
import { registry, StaleResourceError } from './mcp-command.js';

export function buildResolvedFromSaved(
  config: LauncherConfig,
  grafanaClustersPath?: string,
): ResolvedConfig | null {
  const resolved: ResolvedConfig = {};

  for (const name of config.selectedMcps) {
    const cmd = registry.find((c) => c.id === name);
    if (cmd === undefined) continue; // unknown MCP — silently skip (preserves current default-case behaviour)
    try {
      const fragment = cmd.resolveFromSaved(config, grafanaClustersPath);
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
