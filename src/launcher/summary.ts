import { note, select } from "@clack/prompts";
import { handleCancel } from "./prompts.js";
import type { LauncherConfig } from "./types.js";

export function formatSummaryLines(config: LauncherConfig): string[] {
  if (config.selectedMcps.length === 0) {
    return ["No MCPs configured."];
  }

  return config.selectedMcps.map((name) => {
    switch (name) {
      case "grafana":
        if (config.grafana === undefined) {
          return "Grafana: (not yet configured)";
        }
        return `Grafana: cluster ${config.grafana.clusterId}, role ${config.grafana.role}`;

      case "cloudwatch":
        if (config.cloudwatch === undefined) {
          return "CloudWatch: (not yet configured)";
        }
        return `CloudWatch: profile ${config.cloudwatch.profile}`;

      case "gcp-observability":
        if (config.gcpObservability === undefined) {
          return "GCP Observability: (not yet configured)";
        }
        return `GCP Observability: project ${config.gcpObservability.project}`;

      case "kubernetes":
        if (config.kubernetes === undefined) {
          return "Kubernetes: (not yet configured)";
        }
        return `Kubernetes: context ${config.kubernetes.context}`;

      default:
        return `${name}: (unknown MCP)`;
    }
  });
}

export async function promptSummaryAction(
  config: LauncherConfig,
): Promise<"launch" | "configure"> {
  const lines = formatSummaryLines(config);
  note(lines.join("\n"), "Current Configuration");
  const result = await select({
    message: "What would you like to do?",
    options: [
      {
        value: "launch",
        label: "Launch",
        hint: "start Claude with current config",
      },
      { value: "configure", label: "Configure", hint: "change MCP settings" },
    ],
    initialValue: "launch",
  });
  handleCancel(result);
  return result as "launch" | "configure";
}
