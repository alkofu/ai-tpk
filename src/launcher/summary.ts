import { note, select } from '@clack/prompts';
import { handleCancel } from './cancel.js';
import type { LauncherConfig } from './types.js';
import { registry } from './mcp-command.js';

export function formatSummaryLines(config: LauncherConfig): string[] {
  if (config.selectedMcps.length === 0) {
    return ['No MCPs configured.'];
  }

  return config.selectedMcps.map((name) => {
    const cmd = registry.find((c) => c.id === name);
    if (cmd === undefined) return `${name}: (unknown MCP)`;
    return cmd.buildSummaryLine(config);
  });
}

export async function promptSummaryAction(
  config: LauncherConfig,
): Promise<'launch' | 'configure'> {
  const lines = formatSummaryLines(config);
  note(lines.join('\n'), 'Current Configuration');
  const result = await select({
    message: 'What would you like to do?',
    options: [
      {
        value: 'launch',
        label: 'Launch',
        hint: 'start Claude with current config',
      },
      { value: 'configure', label: 'Configure', hint: 'change MCP settings' },
    ],
    initialValue: 'launch',
  });
  handleCancel(result);
  return result as 'launch' | 'configure';
}
