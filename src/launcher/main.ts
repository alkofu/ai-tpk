import { intro, outro, log } from "@clack/prompts";
import { loadConfig, saveConfig } from "./config.js";
import { loadGrafanaClusters, configureGrafana } from "./mcp/grafana.js";
import { loadAwsProfiles, configureCloudWatch } from "./mcp/cloudwatch.js";
import {
  checkAdcCredentials,
  configureGcpObservability,
  loadGcpProjects,
} from "./mcp/gcp-observability.js";
import {
  loadKubectxContexts,
  configureKubernetes,
  switchContext,
} from "./mcp/kubernetes.js";
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

  // GCP Observability configuration
  if (selectedMcps.includes("gcp-observability")) {
    let projects;
    try {
      projects = loadGcpProjects();
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    try {
      checkAdcCredentials();
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    const gcpConfig = await configureGcpObservability(
      projects,
      savedConfig.gcpObservability?.project,
    );

    resolved.gcpObservability = gcpConfig;
    updatedConfig.gcpObservability = {
      project: gcpConfig.project,
    };
  }

  // Kubernetes configuration
  if (selectedMcps.includes("kubernetes")) {
    let contexts;
    try {
      contexts = loadKubectxContexts();
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    const k8sConfig = await configureKubernetes(
      contexts,
      savedConfig.kubernetes?.context,
    );

    resolved.kubernetes = k8sConfig;
    updatedConfig.kubernetes = { context: k8sConfig.context };
  }

  // Persist updated selections
  saveConfig(updatedConfig);

  // Switch Kubernetes context AFTER config is persisted (avoids inconsistency if switchContext fails)
  if (resolved.kubernetes !== undefined) {
    try {
      switchContext(
        resolved.kubernetes.context,
        savedConfig.kubernetes?.context,
      );
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }

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
  if (resolved.gcpObservability) {
    lines.push(`GCP Observability: ${resolved.gcpObservability.project}`);
  }
  if (resolved.kubernetes) {
    lines.push(`Kubernetes: ${resolved.kubernetes.context}`);
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
