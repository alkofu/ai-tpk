import type { ResolvedConfig } from "./types.js";
import { registry } from "./mcp-command.js";

export function buildEnvVars(config: ResolvedConfig): Record<string, string> {
  const envVars: Record<string, string> = {};
  for (const cmd of registry) {
    cmd.emitEnvVars(config, envVars);
  }
  return envVars;
}
