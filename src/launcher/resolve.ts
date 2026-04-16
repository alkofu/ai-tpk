import { log } from "@clack/prompts";
import { loadGrafanaClusters } from "./mcp/grafana.js";
import type { ResolvedConfig, LauncherConfig } from "./types.js";

export function buildResolvedFromSaved(
  config: LauncherConfig,
  grafanaClustersPath?: string,
): ResolvedConfig | null {
  const resolved: ResolvedConfig = {};

  for (const name of config.selectedMcps) {
    switch (name) {
      case "grafana": {
        if (config.grafana === undefined) {
          // Sub-object missing — silently skip
          break;
        }
        let clusters;
        try {
          clusters = loadGrafanaClusters(grafanaClustersPath);
        } catch (err) {
          log.warn(
            `Could not load Grafana clusters: ${err instanceof Error ? err.message : String(err)}. Falling through to configure flow.`,
          );
          return null;
        }
        const cluster = clusters.find(
          (c) => c.id === config.grafana!.clusterId,
        );
        if (cluster === undefined) {
          log.warn(
            `Grafana cluster "${config.grafana.clusterId}" not found in clusters file. Falling through to configure flow.`,
          );
          return null;
        }
        resolved.grafana = { cluster, role: config.grafana.role };
        break;
      }

      case "cloudwatch": {
        if (config.cloudwatch === undefined) {
          break;
        }
        resolved.cloudwatch = { profile: config.cloudwatch.profile };
        break;
      }

      case "gcp-observability": {
        if (config.gcpObservability === undefined) {
          break;
        }
        resolved.gcpObservability = {
          project: config.gcpObservability.project,
        };
        break;
      }

      case "kubernetes": {
        if (config.kubernetes === undefined) {
          break;
        }
        resolved.kubernetes = { context: config.kubernetes.context };
        break;
      }

      default:
        // Unknown MCP — silently skip in resolved config
        break;
    }
  }

  return resolved;
}
