import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { log, select } from '@clack/prompts';
import type {
  ArgoCdCluster,
  ArgoCdConfig,
  ResolvedConfig,
  LauncherConfig,
  SkippedMap,
} from '../types.js';
import { handleCancel } from '../cancel.js';
import type { McpCommand } from '../mcp-command-types.js';
import { StaleResourceError } from '../mcp-command-types.js';
import { tryLoad } from '../utils.js';
import { writeDotfile } from '../dotfile.js';

export const DEFAULT_CONFIG_PATH = path.join(
  os.homedir(),
  '.config',
  'argocd-accounts.json',
);

/**
 * Loads and validates the ArgoCD accounts JSON file.
 * The file is a flat object mapping cluster names to { url, token } pairs.
 * Accepts an optional configPath override for hermetic testing.
 */
export function loadArgoCdAccounts(configPath?: string): ArgoCdCluster[] {
  const resolvedPath = configPath ?? DEFAULT_CONFIG_PATH;

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `ArgoCD accounts file not found at ${resolvedPath}. Create it or deselect ArgoCD.`,
    );
  }

  // Warn if file is group- or world-readable (tokens live here)
  const stat = fs.statSync(resolvedPath);
  if (stat.mode & 0o077) {
    log.warn(
      `${resolvedPath} is readable by other users. Run: chmod 600 ${resolvedPath}`,
    );
  }

  let parsed: unknown;
  try {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `ArgoCD accounts file at ${resolvedPath} is not valid JSON.`,
    );
  }

  if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error(
      `ArgoCD accounts file at ${resolvedPath} must be a flat JSON object mapping cluster names to {url, token} objects.`,
    );
  }

  const record = parsed as Record<string, unknown>;
  const keys = Object.keys(record);

  if (keys.length === 0) {
    throw new Error(
      `ArgoCD accounts file at ${resolvedPath} contains no clusters.`,
    );
  }

  return keys.toSorted().map((id): ArgoCdCluster => {
    if (!/^[a-zA-Z0-9_.-]+$/.test(id)) {
      throw new Error(
        `ArgoCD cluster id "${id}" contains characters outside [a-zA-Z0-9_.-].`,
      );
    }

    const value = record[id];
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(
        `ArgoCD cluster "${id}" must have string fields "url" and "token".`,
      );
    }

    const entry = value as Record<string, unknown>;
    const url = entry['url'];
    const token = entry['token'];

    if (typeof url !== 'string' || typeof token !== 'string') {
      throw new Error(
        `ArgoCD cluster "${id}" must have string fields "url" and "token".`,
      );
    }

    if (!/^https?:\/\//i.test(url)) {
      throw new Error(
        `ArgoCD cluster "${id}" has missing or invalid url (must start with http:// or https://).`,
      );
    }

    if (token === '') {
      throw new Error(`ArgoCD cluster "${id}" has an empty token.`);
    }

    return { id, url, token };
  });
}

/**
 * Prompts the user to select an ArgoCD cluster.
 * Pre-selects previousClusterId if it exists in the cluster list.
 */
export async function configureArgoCd(
  clusters: ArgoCdCluster[],
  previousClusterId?: string,
): Promise<ArgoCdConfig> {
  const initialValue =
    previousClusterId && clusters.some((c) => c.id === previousClusterId)
      ? previousClusterId
      : clusters[0]?.id;

  const selected = await select({
    message: 'Select ArgoCD cluster:',
    options: clusters.map((c) => ({ value: c.id, label: c.id, hint: c.url })),
    initialValue,
  });
  handleCancel(selected);

  const cluster = clusters.find((c) => c.id === selected);
  if (!cluster) {
    throw new Error(`Selected ArgoCD cluster "${String(selected)}" not found.`);
  }

  return { cluster };
}

export const argoCdCommand: McpCommand = {
  id: 'argocd',
  skippedKey: 'argocd' as keyof SkippedMap,
  multiselectOption: {
    value: 'argocd',
    label: 'ArgoCD',
    hint: 'cluster',
  },

  async configureInteractive(savedConfig: LauncherConfig): Promise<{
    resolved: Partial<ResolvedConfig>;
    persistable: Partial<LauncherConfig>;
  } | null> {
    const clusters = tryLoad(() => loadArgoCdAccounts(), 'argocd');
    if (clusters === null) return null;
    const result = await configureArgoCd(
      clusters,
      savedConfig.argocd?.clusterId,
    );
    return {
      resolved: { argocd: result },
      persistable: { argocd: { clusterId: result.cluster.id } },
    };
  },

  resolveFromSaved(
    config: LauncherConfig,
    // _grafanaClustersPath satisfies the McpCommand interface contract; unused here (ArgoCD has its own configPath override in loadArgoCdAccounts).
    _grafanaClustersPath?: string,
  ): Partial<ResolvedConfig> | null {
    if (config.argocd === undefined) {
      return null;
    }
    let clusters: ArgoCdCluster[];
    try {
      clusters = loadArgoCdAccounts();
    } catch (err) {
      log.warn(
        `Could not load ArgoCD accounts: ${err instanceof Error ? err.message : String(err)}. Falling through to configure flow.`,
      );
      throw new StaleResourceError('ArgoCD accounts file unavailable');
    }
    const cluster = clusters.find((c) => c.id === config.argocd!.clusterId);
    if (cluster === undefined) {
      log.warn(
        `ArgoCD cluster "${config.argocd.clusterId}" not found in accounts file. Falling through to configure flow.`,
      );
      throw new StaleResourceError(
        `ArgoCD cluster ${config.argocd.clusterId} no longer exists`,
      );
    }
    return { argocd: { cluster } };
  },

  emitEnvVars(resolved: ResolvedConfig, env: Record<string, string>): void {
    if (!resolved.argocd) return;
    env['ARGOCD_BASE_URL'] = resolved.argocd.cluster.url;
    env['ARGOCD_API_TOKEN'] = resolved.argocd.cluster.token;
    writeDotfile('current-argocd-cluster', resolved.argocd.cluster.id);
  },

  buildOutroSuccessLine(resolved: ResolvedConfig): string | null {
    if (!resolved.argocd) return null;
    return `ArgoCD: ${resolved.argocd.cluster.id}`;
  },

  buildOutroSkipLine(skipped: SkippedMap[keyof SkippedMap]): string | null {
    if (skipped === 'loader-failed')
      return 'ArgoCD: skipped (accounts unavailable)';
    return null;
  },

  buildSummaryLine(config: LauncherConfig): string {
    if (config.argocd === undefined) {
      return 'ArgoCD: (not yet configured)';
    }
    return `ArgoCD: cluster ${config.argocd.clusterId}`;
  },
};
