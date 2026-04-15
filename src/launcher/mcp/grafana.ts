import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { parse as parseYaml } from "yaml";
import { log, select, cancel } from "@clack/prompts";
import type { GrafanaCluster, GrafanaConfig, GrafanaRole } from "../types.js";
import { handleCancel } from "../prompts.js";

const DEFAULT_CONFIG_PATH = path.join(
  os.homedir(),
  ".config",
  "grafana-clusters.yaml",
);

interface RawCluster {
  id?: unknown;
  name?: unknown;
  url?: unknown;
  viewer_token?: unknown;
  editor_token?: unknown;
  token?: unknown;
}

export function loadGrafanaClusters(configPath?: string): GrafanaCluster[] {
  const resolvedPath = configPath ?? DEFAULT_CONFIG_PATH;

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Grafana clusters config not found at ${resolvedPath}. Create it or deselect Grafana.`,
    );
  }

  // Warn if file is world- or group-readable (tokens live here)
  const stat = fs.statSync(resolvedPath);
  if (stat.mode & 0o077) {
    log.warn(
      `${resolvedPath} is readable by other users. Run: chmod 600 ${resolvedPath}`,
    );
  }

  const raw = fs.readFileSync(resolvedPath, "utf8");
  // maxAliasCount guards against YAML anchor/alias expansion bombs
  const parsed = parseYaml(raw, { maxAliasCount: 100 }) as {
    clusters?: RawCluster[];
  };

  if (!parsed?.clusters || !Array.isArray(parsed.clusters)) {
    throw new Error(
      `Grafana clusters config at ${resolvedPath} has no 'clusters' array.`,
    );
  }

  if (parsed.clusters.length === 0) {
    throw new Error(
      `Grafana clusters config at ${resolvedPath} has an empty 'clusters' array.`,
    );
  }

  return parsed.clusters.map((c: RawCluster, idx: number): GrafanaCluster => {
    const id = String(c.id ?? "");
    const name = String(c.name ?? "");
    const url = String(c.url ?? "");

    if (!id || !name) {
      throw new Error(
        `Cluster entry at index ${idx} is missing required fields (id, name).`,
      );
    }

    if (!url || !/^https?:\/\//i.test(url)) {
      throw new Error(
        `Cluster "${name}" has a missing or invalid url (must start with http:// or https://).`,
      );
    }

    // Legacy token fallback: warn and use token as viewer_token
    let viewer_token = String(c.viewer_token ?? "");
    let editor_token = String(c.editor_token ?? "");

    if (!viewer_token && !editor_token && c.token) {
      log.warn(
        `Cluster "${name}" uses legacy 'token' field. Add 'viewer_token' and 'editor_token' to ~/.config/grafana-clusters.yaml.`,
      );
      viewer_token = String(c.token);
      editor_token = "";
    }

    return { id, name, url, viewer_token, editor_token };
  });
}

export async function configureGrafana(
  clusters: GrafanaCluster[],
  previousClusterId?: string,
  previousRole?: GrafanaRole,
): Promise<GrafanaConfig> {
  const clusterValue = await select({
    message: "Select Grafana cluster:",
    options: clusters.map((c) => ({
      value: c.id,
      label: c.name,
      hint: c.url,
    })),
    initialValue: previousClusterId ?? clusters[0]?.id,
  });
  handleCancel(clusterValue);

  const selectedCluster = clusters.find((c) => c.id === clusterValue);
  if (!selectedCluster) {
    cancel("Selected cluster not found.");
    process.exit(1);
  }

  const roleValue = await select<GrafanaRole>({
    message: "Select access role:",
    options: [
      {
        value: "viewer" as GrafanaRole,
        label: "Viewer (read-only)",
        hint: "uses --disable-write",
      },
      {
        value: "editor" as GrafanaRole,
        label: "Editor (read + write)",
      },
    ],
    initialValue: previousRole ?? "viewer",
  });
  handleCancel(roleValue);

  if (roleValue === "editor" && !selectedCluster.editor_token) {
    cancel(
      `Cluster "${selectedCluster.name}" has no editor_token configured. Update ~/.config/grafana-clusters.yaml or select Viewer role.`,
    );
    process.exit(1);
  }

  if (roleValue === "viewer" && !selectedCluster.viewer_token) {
    cancel(
      `Cluster "${selectedCluster.name}" has no viewer_token configured. Update ~/.config/grafana-clusters.yaml or select Editor role.`,
    );
    process.exit(1);
  }

  return {
    cluster: selectedCluster,
    role: roleValue as GrafanaRole,
  };
}
