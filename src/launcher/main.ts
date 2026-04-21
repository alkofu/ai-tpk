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
import { buildOutroLines } from "./outro.js";
import { promptSummaryAction } from "./summary.js";
import { buildResolvedFromSaved } from "./resolve.js";
import type { ResolvedConfig, LauncherConfig, SkippedMap } from "./types.js";

function launchClaude(
  resolved: ResolvedConfig,
  savedConfig: LauncherConfig,
  skipped: SkippedMap = {},
): never {
  // Switch Kubernetes context AFTER config is persisted (avoids inconsistency if switchContext fails)
  let switchAttempted = false;
  let switchResult: void | null | undefined;
  if (resolved.kubernetes !== undefined) {
    switchAttempted = true;
    switchResult = tryLoad(
      () =>
        switchContext(
          resolved.kubernetes!.context,
          savedConfig.kubernetes?.context,
        ),
      "kubernetes-switch",
      `Failed to switch Kubernetes context to "${resolved.kubernetes!.context}" — launching with the previously active context.`,
    );
  }

  const switchFailed = switchAttempted && switchResult === null;
  const effectiveSkipped: SkippedMap = {
    ...skipped,
    kubernetes: switchFailed ? "switch-failed" : (skipped.kubernetes ?? false),
  };
  const outroResolved: ResolvedConfig = switchFailed
    ? { ...resolved, kubernetes: undefined }
    : resolved;

  // Build env vars summary for outro
  const envVars = buildEnvVars(outroResolved);
  const lines = buildOutroLines(outroResolved, effectiveSkipped);
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

async function main(): Promise<void> {
  intro("myclaude — Session Launcher");

  const savedConfig = loadConfig();

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

  // Grafana configuration
  let grafanaSkipped: false | "loader-failed" = false;
  if (selectedMcps.includes("grafana")) {
    const clusters = tryLoad(() => loadGrafanaClusters(), "grafana");

    if (clusters !== null) {
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
    } else {
      grafanaSkipped = "loader-failed";
    }
  }

  // CloudWatch configuration
  let cloudwatchSkipped: false | "loader-failed" = false;
  if (selectedMcps.includes("cloudwatch")) {
    const profiles = tryLoad(() => loadAwsProfiles(), "cloudwatch");

    if (profiles !== null) {
      const cwConfig = await configureCloudWatch(
        profiles,
        savedConfig.cloudwatch?.profile,
      );

      resolved.cloudwatch = cwConfig;
      updatedConfig.cloudwatch = {
        profile: cwConfig.profile,
      };
    } else {
      cloudwatchSkipped = "loader-failed";
    }
  }

  // GCP Observability configuration
  let gcpSkipped: false | "loader-failed" = false;
  if (selectedMcps.includes("gcp-observability")) {
    const projects = tryLoad(
      () => loadGcpProjects(),
      "gcp",
      "GCP project list unavailable — skipping gcp-observability MCP. Run `gcloud auth login` and re-launch.",
    );
    const adcOk =
      projects !== null &&
      tryLoad(
        () => checkAdcCredentials(),
        "gcp-adc",
        "GCP ADC credentials unavailable — skipping gcp-observability MCP. Run `gcloud auth application-default login` and re-launch.",
      ) !== null;

    if (projects !== null && adcOk) {
      const gcpConfig = await configureGcpObservability(
        projects,
        savedConfig.gcpObservability?.project,
      );

      resolved.gcpObservability = gcpConfig;
      updatedConfig.gcpObservability = {
        project: gcpConfig.project,
      };
    } else {
      gcpSkipped = "loader-failed";
    }
  }

  // Kubernetes configuration
  let kubernetesSkipped: false | "loader-failed" = false;
  if (selectedMcps.includes("kubernetes")) {
    const contexts = tryLoad(() => loadKubectxContexts(), "kubernetes");

    if (contexts !== null) {
      const k8sConfig = await configureKubernetes(
        contexts,
        savedConfig.kubernetes?.context,
      );

      resolved.kubernetes = k8sConfig;
      updatedConfig.kubernetes = { context: k8sConfig.context };
    } else {
      kubernetesSkipped = "loader-failed";
    }
  }

  // Persist updated selections (configure path only -- user changed config)
  saveConfig(updatedConfig);
  launchClaude(resolved, updatedConfig, {
    grafana: grafanaSkipped,
    cloudwatch: cloudwatchSkipped,
    gcp: gcpSkipped,
    kubernetes: kubernetesSkipped,
  });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
