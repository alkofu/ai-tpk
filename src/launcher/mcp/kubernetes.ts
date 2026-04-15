import { spawnSync } from "node:child_process";
import { select } from "@clack/prompts";
import type { KubernetesConfig } from "../types.js";
import { handleCancel } from "../prompts.js";

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
  const initialValue = previousContext || getCurrentContext() || contexts[0];

  const options = contexts.map((ctx) => ({ value: ctx, label: ctx }));

  const selected = await select({
    message: "Select Kubernetes context:",
    options,
    initialValue,
  });
  handleCancel(selected);

  return { context: selected as string };
}
