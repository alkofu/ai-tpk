import type { LauncherAgent, LauncherConfig } from './types.js';

export const DEFAULT_AGENT: LauncherAgent = 'dungeonmaster';

export const AGENT_LABELS: Record<LauncherAgent, string> = {
  dungeonmaster: 'Dungeon Master',
  default: 'Default Claude',
};

/**
 * Returns the agent persisted in `config`, falling back to `DEFAULT_AGENT`
 * when the field is absent (configs saved before agent selection existed)
 * or holds an unrecognised value (hand-edited or malformed config).
 */
export function resolveSavedAgent(config: LauncherConfig): LauncherAgent {
  return config.agent === 'default' ? 'default' : DEFAULT_AGENT;
}

export function formatAgentLine(config: LauncherConfig): string {
  return `Agent: ${AGENT_LABELS[resolveSavedAgent(config)]}`;
}
