/**
 * McpCommand — GoF Command pattern for MCP lifecycle management.
 *
 * Each MCP is represented by a single McpCommand instance that owns its full
 * lifecycle: load → configure → resolve from saved → emit env → produce
 * display lines. Orchestration files (main.ts, env.ts, resolve.ts, outro.ts,
 * summary.ts, prompts.ts) iterate over the registry rather than branching on
 * MCP name.
 *
 * The McpCommand interface and StaleResourceError class are defined in
 * mcp-command-types.ts and re-exported from here. They live in a separate
 * file to break the circular dependency that would arise if the command
 * implementations imported StaleResourceError directly from this file (which
 * in turn imports those same command instances).
 *
 * ## How to add a new MCP (e.g., "datadog") with no post-save side effect:
 *
 * 1. Create `src/launcher/mcp/datadog.ts` exporting `datadogCommand: McpCommand`
 *    and any free functions it needs (loaders, configurers, etc.).
 *    Import McpCommand from `../mcp-command-types.js` (not `../mcp-command.js`)
 *    to avoid the circular dependency.
 *
 * 2. Add `datadogCommand` to the `registry` array in this file:
 *    - One import line: `import { datadogCommand } from "./mcp/datadog.js";`
 *    - One array entry: add `datadogCommand` to the registry array below.
 *
 * 3. Extend `src/launcher/types.ts` with the four required type extensions:
 *    a. Add a `DatadogConfig` interface describing the resolved sub-shape.
 *    b. Add `datadog?: DatadogConfig` to the `ResolvedConfig` interface.
 *    c. Add `datadog?: false | "loader-failed"` to the `SkippedMap` type.
 *    d. Add `datadog?: { someKey: string }` to the `LauncherConfig` interface.
 *
 * 4. (Only if the new MCP requires a post-save side effect — datadog does not.)
 *    Add a named function (e.g., `applyDatadogPostSave`) in `mcp/datadog.ts`
 *    and an explicit import + call site in `launchClaude` in `main.ts`. This
 *    is not a generic mechanism — it is a deliberate, visible call site.
 *
 * No edits to main.ts, env.ts, resolve.ts, outro.ts, summary.ts, or prompts.ts
 * are required for an MCP without a post-save side effect.
 */

// Re-export the core types so consumers can import from a single location.
export type { McpCommand } from './mcp-command-types.js';
export { StaleResourceError } from './mcp-command-types.js';

import type { McpCommand } from './mcp-command-types.js';
import { grafanaCommand } from './mcp/grafana.js';
import { cloudwatchCommand } from './mcp/cloudwatch.js';
import { gcpObservabilityCommand } from './mcp/gcp-observability.js';
import { kubernetesCommand } from './mcp/kubernetes.js';
import { argoCdCommand } from './mcp/argocd.js';

export const registry: McpCommand[] = [
  grafanaCommand,
  cloudwatchCommand,
  gcpObservabilityCommand,
  kubernetesCommand,
  argoCdCommand,
];
