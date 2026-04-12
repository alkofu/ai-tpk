import { intro, outro, log } from "@clack/prompts";
import { loadConfig, saveConfig } from "./config.js";
import { loadGrafanaClusters, configureGrafana } from "./mcp/grafana.js";
import { loadAwsProfiles, configureCloudWatch } from "./mcp/cloudwatch.js";
import { selectMcps } from "./prompts.js";
import { buildEnvVars } from "./env.js";
import { launchClaude } from "./launch.js";
import type { ResolvedConfig, LauncherConfig } from "./types.js";

async function main(): Promise<void> {
  intro("myclaude — Session Launcher");

  const savedConfig = loadConfig();

  // MCP selection
  const selectedMcps = await selectMcps(savedConfig.selectedMcps);

  const resolved: ResolvedConfig = {};
  // Carry forward unselected MCP settings so defaults are preserved for next run
  const updatedConfig: LauncherConfig = {
    ...savedConfig,
    selectedMcps,
  };

  // Grafana configuration
  if (selectedMcps.includes("grafana")) {
    let clusters;
    try {
      clusters = loadGrafanaClusters();
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    const grafanaConfig = await configureGrafana(
      clusters,
      savedConfig.grafana?.clusterId,
      savedConfig.grafana?.role,
    );

    resolved.grafana = grafanaConfig;
    updatedConfig.grafana = {
      clusterId: grafanaConfig.cluster.id,
      role: grafanaConfig.role,
    };
  }

  // CloudWatch configuration
  if (selectedMcps.includes("cloudwatch")) {
    let profiles;
    try {
      profiles = loadAwsProfiles();
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    const cwConfig = await configureCloudWatch(
      profiles,
      savedConfig.cloudwatch?.profile,
    );

    resolved.cloudwatch = cwConfig;
    updatedConfig.cloudwatch = {
      profile: cwConfig.profile,
    };
  }

  // Persist updated selections
  saveConfig(updatedConfig);

  // Build env vars summary for outro
  const envVars = buildEnvVars(resolved);
  const lines: string[] = [];
  if (resolved.grafana) {
    lines.push(
      `Grafana: ${resolved.grafana.cluster.name} (${resolved.grafana.role})`,
    );
  }
  if (resolved.cloudwatch) {
    lines.push(`CloudWatch: ${resolved.cloudwatch.profile}`);
  }
  if (lines.length === 0) {
    lines.push("No MCPs configured — launching Claude with current env.");
  }

  outro(`Launching: ${lines.join(" · ")}`);

  launchClaude(envVars);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
