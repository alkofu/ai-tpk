/**
 * Builds the argv array passed to `spawnSync("claude", ...)`.
 *
 * This helper is the single source of truth for the `claude` spawn-arg shape.
 * No shell tokenisation or escaping occurs at this layer — `spawnSync` passes
 * argv elements directly to the child process without shell interpretation.
 *
 * @param initialMessage - the optional initial message to forward to claude as
 *   a third positional arg. When `undefined`, the args are identical to the
 *   baseline `["--agent", "dungeonmaster"]`.
 * @returns the complete argv array to pass to `spawnSync("claude", ...)`
 */
export function buildClaudeArgs(initialMessage: string | undefined): string[] {
  if (initialMessage === undefined) {
    return ['--agent', 'dungeonmaster'];
  }
  return ['--agent', 'dungeonmaster', initialMessage];
}
