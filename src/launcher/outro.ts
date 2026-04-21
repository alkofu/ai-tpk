import type { ResolvedConfig, SkippedMap } from "./types.js";
import { registry } from "./mcp-command.js";

export function buildOutroLines(
  resolved: ResolvedConfig,
  effectiveSkipped: SkippedMap,
): string[] {
  const lines: string[] = [];

  // Success lines, in canonical registry order. Each is gated on BOTH resolved.<mcp>
  // truthy AND effectiveSkipped.<mcp> falsy, so the function cannot emit
  // both a success line and a skip line for the same MCP — even if a caller
  // passes a contradictory pair.
  for (const cmd of registry) {
    const isSkipped = Boolean(effectiveSkipped[cmd.skippedKey]);
    if (!isSkipped) {
      const line = cmd.buildOutroSuccessLine(resolved);
      if (line !== null) lines.push(line);
    }
  }

  // Skip lines, in the same canonical order: Grafana → CloudWatch → GCP → Kubernetes.
  for (const cmd of registry) {
    const line = cmd.buildOutroSkipLine(effectiveSkipped[cmd.skippedKey]);
    if (line !== null) lines.push(line);
  }

  return lines;
}
