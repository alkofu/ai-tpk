import type { LauncherAgent } from './types.js';

/**
 * Builds the argv array passed to `spawnSync("claude", ...)`.
 *
 * This helper is the single source of truth for the `claude` spawn-arg shape.
 * No shell tokenisation or escaping occurs at this layer — `spawnSync` passes
 * argv elements directly to the child process without shell interpretation.
 *
 * @param agent - the agent to launch. `"dungeonmaster"` adds
 *   `["--agent", "dungeonmaster"]`; `"default"` adds no `--agent` flag, so
 *   claude starts with its default main agent.
 * @param initialMessage - the optional initial message to forward to claude as
 *   the final positional arg. When `undefined`, no positional is appended.
 * @returns the complete argv array to pass to `spawnSync("claude", ...)`
 */
export function buildClaudeArgs(
  agent: LauncherAgent,
  initialMessage: string | undefined,
): string[] {
  const args = agent === 'dungeonmaster' ? ['--agent', 'dungeonmaster'] : [];
  if (initialMessage !== undefined) {
    args.push(initialMessage);
  }
  return args;
}
