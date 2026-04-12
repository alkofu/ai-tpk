import { spawnSync } from "node:child_process";

export function launchClaude(envVars: Record<string, string>): never {
  // Merge envVars into the current process environment
  const env = { ...process.env, ...envVars };

  // spawnSync with stdio: "inherit" blocks until claude exits,
  // then we forward the exit code. This correctly propagates signals and exit status.
  const result = spawnSync("claude", ["--agent", "dungeonmaster"], {
    stdio: "inherit",
    env,
  });

  process.exit(result.status ?? 1);
}
