import { isCancel, cancel } from '@clack/prompts';

/**
 * Asserts that a prompt value is not a cancellation signal.
 * Exits the process if the user cancelled the prompt.
 *
 * Extracted from prompts.ts into a standalone module so that MCP command
 * implementations can import it without pulling in the registry (which would
 * create a circular dependency: mcp-command.ts → mcp/*.ts → prompts.ts →
 * mcp-command.ts).
 */
export function handleCancel(
  value: unknown,
): asserts value is NonNullable<unknown> {
  if (isCancel(value)) {
    cancel('Operation cancelled.');
    process.exit(0);
  }
}
