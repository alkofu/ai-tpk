import { multiselect, select } from '@clack/prompts';
import { registry } from './mcp-command.js';
import { handleCancel } from './cancel.js';
import { AGENT_LABELS } from './agent.js';
import type { LauncherAgent } from './types.js';

export async function selectMcps(
  previousSelections: string[],
): Promise<string[]> {
  const value = await multiselect({
    message: 'Select MCPs to configure for this session:',
    options: registry.map((c) => c.multiselectOption),
    initialValues: previousSelections,
    required: false,
  });
  handleCancel(value);
  return value as string[];
}

export async function selectAgent(
  previous: LauncherAgent,
): Promise<LauncherAgent> {
  const value = await select({
    message: 'Which agent?',
    options: [
      {
        value: 'dungeonmaster',
        label: AGENT_LABELS.dungeonmaster,
        hint: 'claude --agent dungeonmaster',
      },
      {
        value: 'default',
        label: AGENT_LABELS.default,
        hint: 'claude with no --agent flag',
      },
    ],
    initialValue: previous,
  });
  handleCancel(value);
  return value as LauncherAgent;
}
