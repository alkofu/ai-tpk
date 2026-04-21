import { spawnSync } from "node:child_process";
import { select } from "@clack/prompts";
import type { KubernetesConfig } from "../types.js";
import { handleCancel } from "../cancel.js";
import type { McpCommand } from "../mcp-command-types.js";
import { tryLoad } from "../utils.js";
import { writeDotfile } from "../dotfile.js";
import type { ResolvedConfig, LauncherConfig, SkippedMap } from "../types.js";

/**
 * Parses stdout from `kubectx` (no args) into a list of context names.
 * Filters empty lines and trims whitespace.
 */
export function parseKubectxOutput(stdout: string): string[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Runs `kubectx` (no args) to list all available Kubernetes contexts.
 * Throws if kubectx is not found, exits non-zero, or returns no contexts.
 */
export function loadKubectxContexts(): string[] {
  const result = spawnSync("kubectx", [], { encoding: "utf8" });
  if (result.error) {
    throw new Error(
      `Failed to run kubectx: ${result.error.message}\nEnsure kubectx is installed and available on your PATH.`,
    );
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? "";
    throw new Error(
      `kubectx exited with status ${result.status}${stderr ? `: ${stderr}` : ""}.`,
    );
  }
  const contexts = parseKubectxOutput(result.stdout ?? "");
  if (contexts.length === 0) {
    throw new Error(
      "No Kubernetes contexts found. Run `kubectl config get-contexts` to check your kubeconfig.",
    );
  }
  return contexts;
}

/**
 * Returns the name of the currently active Kubernetes context using
 * `kubectl config current-context`. Returns an empty string if unavailable
 * (e.g., kubectl not installed, no current context set).
 */
export function getCurrentContext(): string {
  const result = spawnSync("kubectl", ["config", "current-context"], {
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) {
    return "";
  }
  return result.stdout?.trim() ?? "";
}

/**
 * Switches the active Kubernetes context using kubectx.
 * No-op if `selected === previous` (unchanged selection).
 * Throws if kubectx exits non-zero.
 */
export function switchContext(selected: string, previous?: string): void {
  if (selected === previous) {
    return;
  }
  const result = spawnSync("kubectx", [selected], { encoding: "utf8" });
  if (result.error) {
    throw new Error(`Failed to run kubectx: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? "";
    throw new Error(
      `kubectx exited with status ${result.status} when switching to "${selected}"${stderr ? `: ${stderr}` : ""}.`,
    );
  }
}

/**
 * Prompts the user to select a Kubernetes context.
 * Pre-selects `previousContext` if provided, then falls back to the current
 * active context, then to the first available context.
 */
export async function configureKubernetes(
  contexts: string[],
  previousContext?: string,
): Promise<KubernetesConfig> {
  const initialValue =
    previousContext && contexts.includes(previousContext)
      ? previousContext
      : getCurrentContext() || contexts[0];

  const options = contexts.map((ctx) => ({ value: ctx, label: ctx }));

  const selected = await select({
    message: "Select Kubernetes context:",
    options,
    initialValue,
  });
  handleCancel(selected);

  return { context: selected as string };
}

export const kubernetesCommand: McpCommand = {
  id: "kubernetes",
  skippedKey: "kubernetes",
  multiselectOption: {
    value: "kubernetes",
    label: "Kubernetes",
    hint: "cluster context",
  },

  async configureInteractive(savedConfig: LauncherConfig): Promise<{
    resolved: Partial<ResolvedConfig>;
    persistable: Partial<LauncherConfig>;
  } | null> {
    const contexts = tryLoad(() => loadKubectxContexts(), "kubernetes");
    if (contexts === null) return null;
    const result = await configureKubernetes(
      contexts,
      savedConfig.kubernetes?.context,
    );
    return {
      resolved: { kubernetes: result },
      persistable: { kubernetes: { context: result.context } },
    };
  },

  resolveFromSaved(config: LauncherConfig): Partial<ResolvedConfig> | null {
    if (config.kubernetes === undefined) return null;
    return { kubernetes: { context: config.kubernetes.context } };
  },

  emitEnvVars(resolved: ResolvedConfig, env: Record<string, string>): void {
    if (!resolved.kubernetes) return;
    const context = resolved.kubernetes.context;
    // K8S_CONTEXT: explicit context override for mcp-server-kubernetes.
    // Takes higher priority than ~/.kube/config active context, ensuring the
    // selected context is respected even when other kubeconfig env vars
    // (KUBECONFIG, K8S_SERVER, etc.) are present in the environment.
    env["K8S_CONTEXT"] = context;
    // Write dotfile for symmetry with cloudwatch/gcp patterns and potential
    // future use by wrapper scripts or slash commands.
    writeDotfile("current-kube-context", context);
  },

  buildOutroSuccessLine(resolved: ResolvedConfig): string | null {
    if (!resolved.kubernetes) return null;
    return `Kubernetes: ${resolved.kubernetes.context}`;
  },

  buildOutroSkipLine(skipped: SkippedMap[keyof SkippedMap]): string | null {
    if (skipped === "loader-failed")
      return "Kubernetes: skipped (contexts unavailable)";
    if (skipped === "switch-failed")
      return "Kubernetes: skipped (context switch failed)";
    return null;
  },

  buildSummaryLine(config: LauncherConfig): string {
    if (config.kubernetes === undefined) {
      return "Kubernetes: (not yet configured)";
    }
    return `Kubernetes: context ${config.kubernetes.context}`;
  },
};

/**
 * Apply the post-save Kubernetes context switch. Called from launchClaude
 * AFTER saveConfig has persisted the user's choice but BEFORE buildEnvVars
 * is called. Returns a new (effectiveSkipped, outroResolved) pair reflecting
 * whether the switch succeeded.
 *
 * If resolved.kubernetes is undefined (Kubernetes not selected, or already
 * skipped at load time), this is a no-op: returns the inputs unchanged.
 *
 * If the switch fails, sets effectiveSkipped.kubernetes = "switch-failed"
 * and clears outroResolved.kubernetes so downstream callers (buildEnvVars,
 * buildOutroLines) do not emit Kubernetes data.
 */
export function applyKubernetesContextSwitch(
  resolved: ResolvedConfig,
  savedConfig: LauncherConfig,
  skipped: SkippedMap,
): { effectiveSkipped: SkippedMap; outroResolved: ResolvedConfig } {
  if (resolved.kubernetes === undefined) {
    // Preserve byte-equivalence with old launchClaude: always set kubernetes key explicitly
    return {
      effectiveSkipped: { ...skipped, kubernetes: skipped.kubernetes ?? false },
      outroResolved: resolved,
    };
  }
  const switchResult = tryLoad(
    () =>
      switchContext(
        resolved.kubernetes!.context,
        savedConfig.kubernetes?.context,
      ),
    "kubernetes-switch",
    `Failed to switch Kubernetes context to "${resolved.kubernetes!.context}" — launching with the previously active context.`,
  );
  const switchFailed = switchResult === null;
  return {
    effectiveSkipped: {
      ...skipped,
      kubernetes: switchFailed
        ? "switch-failed"
        : (skipped.kubernetes ?? false),
    },
    outroResolved: switchFailed
      ? { ...resolved, kubernetes: undefined }
      : resolved,
  };
}
