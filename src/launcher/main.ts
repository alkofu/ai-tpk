import { spawnSync } from "node:child_process";
import { intro, outro } from "@clack/prompts";
import { loadConfig, saveConfig } from "./config.js";
import { selectMcps } from "./prompts.js";
import { buildEnvVars } from "./env.js";
import { buildOutroLines } from "./outro.js";
import { promptSummaryAction } from "./summary.js";
import { buildResolvedFromSaved } from "./resolve.js";
import { registry } from "./mcp-command.js";
import { applyKubernetesContextSwitch } from "./mcp/kubernetes.js";
import {
  parseArgs,
  UnknownFlagError,
  TooManyPositionalsError,
} from "./argv.js";
import { buildClaudeArgs } from "./claude-args.js";
import type { ResolvedConfig, LauncherConfig, SkippedMap } from "./types.js";

function launchClaude(
  resolved: ResolvedConfig,
  savedConfig: LauncherConfig,
  skipped: SkippedMap = {},
  initialMessage: string | undefined = undefined,
): never {
  // Switch Kubernetes context AFTER config is persisted (avoids inconsistency if switchContext fails)
  const { effectiveSkipped, outroResolved } = applyKubernetesContextSwitch(
    resolved,
    savedConfig,
    skipped,
  );

  // Build env vars summary for outro
  const envVars = buildEnvVars(outroResolved);
  const lines = buildOutroLines(outroResolved, effectiveSkipped);
  if (lines.length === 0) {
    lines.push("No MCPs configured — launching Claude with current env.");
  }

  // Clear terminal so the Claude session starts on a clean screen.
  // The return value is intentionally ignored: if `clear` is missing from PATH
  // or exits non-zero, the launch must still proceed.
  // stderr is suppressed to silence noise from a potentially misconfigured binary.
  spawnSync("clear", [], { stdio: ["inherit", "inherit", "ignore"] });
  outro(`Launching: ${lines.join(" · ")}`);

  // Launch Claude with merged env vars
  const env = { ...process.env, ...envVars };
  const claudeArgs = buildClaudeArgs(initialMessage);
  const result = spawnSync("claude", claudeArgs, {
    stdio: "inherit",
    env,
  });
  process.exit(result.status ?? 1);
}

function runSkipLaunch(
  savedConfig: LauncherConfig,
  initialMessage: string | undefined,
): never {
  if (savedConfig.selectedMcps.length === 0) {
    console.error(
      "No saved config found — run myclaude without --skip first to configure.",
    );
    process.exit(1);
  }
  const resolved = buildResolvedFromSaved(savedConfig);
  if (resolved === null) {
    console.error(
      "Saved config could not be resolved (e.g. Grafana cluster is no longer valid) — re-run myclaude without --skip to reconfigure.",
    );
    process.exit(1);
  }
  // Direct launch: no config was modified, so do NOT call saveConfig.
  launchClaude(resolved, savedConfig, undefined, initialMessage);
}

async function main(): Promise<void> {
  let skip = false;
  let initialMessage: string | undefined = undefined;
  try {
    ({ skip, initialMessage } = parseArgs(process.argv.slice(2)));
  } catch (err) {
    if (err instanceof UnknownFlagError) {
      console.error(err.message);
      process.exit(2);
    }
    if (err instanceof TooManyPositionalsError) {
      console.error(err.message);
      process.exit(2);
    }
    throw err;
  }

  if (initialMessage !== undefined && !skip) {
    console.error(
      "Initial message requires --skip. Usage: myclaude --skip <initial-message>",
    );
    process.exit(2);
  }

  intro("myclaude — Session Launcher");

  const savedConfig = loadConfig();

  if (skip) {
    runSkipLaunch(savedConfig, initialMessage);
  }

  // Summary screen: show current config and let user choose to launch or configure
  const hasExistingConfig = savedConfig.selectedMcps.length > 0;

  if (hasExistingConfig) {
    const action = await promptSummaryAction(savedConfig);

    if (action === "launch") {
      const resolved = buildResolvedFromSaved(savedConfig);
      if (resolved === null) {
        // Fall through to configure flow.
        // Warning already logged by buildResolvedFromSaved (e.g., stale Grafana cluster).
      } else {
        // Direct launch: no config was modified, so do NOT call saveConfig.
        // The direct-launch path intentionally does not call saveConfig because
        // no configuration was modified. Only the configure path (below) persists
        // changes. This prevents an implementer from accidentally inserting a
        // saveConfig call here or moving it into launchClaude where it would be
        // called on both paths.
        launchClaude(resolved, savedConfig);
      }
    }
    // If action === "configure", fall through to existing menu flow below.
    // If resolved === null (stale config), also fall through to configure flow.
  }

  // MCP selection
  const selectedMcps = await selectMcps(savedConfig.selectedMcps);

  const resolved: ResolvedConfig = {};
  // Carry forward unselected MCP settings so defaults are preserved for next run
  const updatedConfig: LauncherConfig = {
    ...savedConfig,
    selectedMcps,
  };
  const skipped: SkippedMap = {};

  // eslint-disable-next-line no-await-in-loop -- configure prompts must be sequential (each one blocks on user input)
  for (const cmd of registry) {
    if (!selectedMcps.includes(cmd.id)) continue;
    const result = await cmd.configureInteractive(updatedConfig); // eslint-disable-line no-await-in-loop
    if (result === null) {
      skipped[cmd.skippedKey] = "loader-failed";
      continue;
    }
    Object.assign(resolved, result.resolved);
    Object.assign(updatedConfig, result.persistable);
  }

  // Persist updated selections (configure path only -- user changed config)
  saveConfig(updatedConfig);
  launchClaude(resolved, updatedConfig, skipped);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
