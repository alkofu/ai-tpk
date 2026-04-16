import { spawnSync } from "node:child_process";
import { intro, outro } from "@clack/prompts";
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
import { tryLoad } from "./utils.js";
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
    const clusters = tryLoad(() => loadGrafanaClusters(), "grafana");

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
    const profiles = tryLoad(() => loadAwsProfiles(), "cloudwatch");

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
    const projects = tryLoad(() => loadGcpProjects(), "gcp");
    tryLoad(() => checkAdcCredentials(), "gcp-adc");

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
    const contexts = tryLoad(() => loadKubectxContexts(), "kubernetes");

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
    tryLoad(
      () =>
        switchContext(
          resolved.kubernetes!.context,
          savedConfig.kubernetes?.context,
        ),
      "kubernetes-switch",
    );
  }

  // Build env vars summary for outro
  const envVars = buildEnvVars(resolved);
  const summaryParts: Array<{
    config: unknown;
    label: string;
    detail: string;
  }> = [
    {
      config: resolved.grafana,
      label: "Grafana",
      detail: resolved.grafana
        ? `${resolved.grafana.cluster.name} (${resolved.grafana.role})`
        : "",
    },
    {
      config: resolved.cloudwatch,
      label: "CloudWatch",
      detail: resolved.cloudwatch?.profile ?? "",
    },
    {
      config: resolved.gcpObservability,
      label: "GCP Observability",
      detail: resolved.gcpObservability?.project ?? "",
    },
    {
      config: resolved.kubernetes,
      label: "Kubernetes",
      detail: resolved.kubernetes?.context ?? "",
    },
  ];
  const lines = summaryParts
    .filter((p) => p.config)
    .map((p) => `${p.label}: ${p.detail}`);
  if (lines.length === 0) {
    lines.push("No MCPs configured — launching Claude with current env.");
  }

  outro(`Launching: ${lines.join(" · ")}`);

  // Launch Claude with merged env vars
  const env = { ...process.env, ...envVars };
  const result = spawnSync("claude", ["--agent", "dungeonmaster"], {
    stdio: "inherit",
    env,
  });
  process.exit(result.status ?? 1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
