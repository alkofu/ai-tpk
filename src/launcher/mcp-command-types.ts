/**
 * Core types for the McpCommand pattern.
 *
 * This file is intentionally kept separate from mcp-command.ts to break the
 * circular dependency that would arise if the command implementations (e.g.,
 * grafana.ts) imported StaleResourceError directly from mcp-command.ts, which
 * in turn imports the command instances from those same files.
 *
 * Consumers of the public API import from mcp-command.ts, which re-exports
 * everything from here. Command implementations (mcp/*.ts) import from this
 * file to avoid the cycle.
 */

import type { ResolvedConfig, LauncherConfig, SkippedMap } from './types.js';

/**
 * Thrown by an McpCommand's resolveFromSaved when a saved resource is no
 * longer available (e.g., Grafana cluster id no longer in the clusters file).
 * buildResolvedFromSaved catches this and returns null so main.ts falls
 * through to the configure flow. Only Grafana throws this today.
 */
export class StaleResourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaleResourceError';
  }
}

export interface McpCommand {
  /** Multiselect ID, also the value persisted in LauncherConfig.selectedMcps. */
  readonly id: string;
  /** SkippedMap key. For most MCPs this equals id; for gcp-observability it is "gcp". */
  readonly skippedKey: keyof SkippedMap;
  /** Multiselect option as shown in selectMcps(). */
  readonly multiselectOption: { value: string; label: string; hint: string };

  /** Configure flow: load resources (e.g., clusters, profiles), prompt, return resolved + persistable. Returns null if loading failed (caller marks skipped="loader-failed"). */
  configureInteractive(savedConfig: LauncherConfig): Promise<{
    resolved: Partial<ResolvedConfig>; // partial of ResolvedConfig keyed by this MCP
    persistable: Partial<LauncherConfig>; // partial of LauncherConfig keyed by this MCP
  } | null>;

  /**
   * Resolve from a saved LauncherConfig without prompting. Returns:
   *   - Partial<ResolvedConfig> on success (the per-MCP fragment to merge into the resolved config)
   *   - null if the MCP was selected but its sub-object is missing (silent skip)
   * May throw StaleResourceError if a saved reference no longer exists; caller
   * (buildResolvedFromSaved) catches this and returns null to trigger configure flow.
   * Only Grafana throws StaleResourceError today; the other three commands never throw.
   */
  resolveFromSaved(
    config: LauncherConfig,
    grafanaClustersPath?: string,
  ): Partial<ResolvedConfig> | null;

  /** Emit env vars and write any associated dotfiles for this MCP. Mutates the env map in place. */
  emitEnvVars(resolved: ResolvedConfig, env: Record<string, string>): void;

  /** Outro success line, or null if this MCP did not emit a success line for the given resolved config. */
  buildOutroSuccessLine(resolved: ResolvedConfig): string | null;

  /** Outro skip line for the given skip discriminant, or null if no skip line should appear. */
  buildOutroSkipLine(skipped: SkippedMap[keyof SkippedMap]): string | null;

  /** Summary screen line for this MCP from a persisted config. */
  buildSummaryLine(config: LauncherConfig): string;
}
