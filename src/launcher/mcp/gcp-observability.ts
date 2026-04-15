import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { spawnSync } from "node:child_process";
import { select } from "@clack/prompts";
import type { GcpObservabilityConfig } from "../types.js";
import { handleCancel } from "../utils.js";

export interface GcloudResult {
  status: number | null;
  stdout: string;
  stderr: string;
  signal?: string;
  error?: Error;
}

export type GcloudRunner = () => GcloudResult;

function defaultGcloudRunner(): GcloudResult {
  const result = spawnSync(
    "gcloud",
    ["projects", "list", "--format=value(projectId)", "--sort-by=projectId"],
    { encoding: "utf8", timeout: 15000 },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    signal: result.signal ?? undefined,
    error: result.error,
  };
}

export function loadGcpProjects(runner?: GcloudRunner): string[] {
  const result = (runner ?? defaultGcloudRunner)();

  if (result.status === null && result.signal === "SIGTERM") {
    throw new Error(
      "gcloud projects list timed out after 15s. Check your network connection or try running `gcloud projects list` manually.",
    );
  }

  if (result.error) {
    const isNotFound =
      (result.error as NodeJS.ErrnoException).code === "ENOENT";
    throw new Error(
      isNotFound
        ? "gcloud CLI not found. Install it from https://cloud.google.com/sdk/docs/install or ensure it is on your PATH."
        : `Failed to run gcloud CLI (${result.error.message}). Ensure gcloud is installed and on your PATH.`,
    );
  }

  if (result.status !== 0) {
    throw new Error(
      `gcloud projects list failed (exit ${result.status}):\n${result.stderr.trim()}`,
    );
  }

  if (result.stdout.trim() === "") {
    throw new Error(
      "No GCP projects found. Ensure you have access to at least one project, or run: gcloud auth login",
    );
  }

  return result.stdout
    .trim()
    .split("\n")
    .filter((line) => line.trim().length > 0);
}

const DEFAULT_ADC_PATH = path.join(
  os.homedir(),
  ".config",
  "gcloud",
  "application_default_credentials.json",
);

/**
 * Validates a GCP project ID against Google Cloud naming rules:
 * - 6-30 characters
 * - Lowercase letters, digits, and hyphens only
 * - Must start with a lowercase letter
 * - Must not end with a hyphen
 * - Must not contain consecutive hyphens (conservative safety measure --
 *   not explicitly prohibited in GCP documentation, but likely rejected
 *   by GCP's API in practice)
 */
export function validateGcpProjectId(projectId: string): boolean {
  return /^[a-z](?!.*--)[a-z0-9-]{4,28}[a-z0-9]$/.test(projectId);
}

/**
 * Checks that GCP Application Default Credentials (ADC) exist on disk.
 *
 * Resolution order:
 * 1. If GOOGLE_APPLICATION_CREDENTIALS env var is set and the file exists, the check passes.
 * 2. Otherwise, checks the default ADC path (~/.config/gcloud/application_default_credentials.json).
 * 3. If neither source provides a valid file, throws a descriptive error.
 */
export function checkAdcCredentials(adcPath?: string): void {
  // Check GOOGLE_APPLICATION_CREDENTIALS env var first
  const envCredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envCredPath && fs.existsSync(envCredPath)) {
    return;
  }

  const resolvedPath = adcPath ?? DEFAULT_ADC_PATH;
  if (fs.existsSync(resolvedPath)) {
    return;
  }

  throw new Error(
    `GCP Application Default Credentials not found. Checked:\n` +
      `  - GOOGLE_APPLICATION_CREDENTIALS env var${envCredPath ? ` (${envCredPath} — file not found)` : " (not set)"}\n` +
      `  - ${resolvedPath}\n` +
      `Set GOOGLE_APPLICATION_CREDENTIALS to a valid credential file, or run: gcloud auth application-default login`,
  );
}

/**
 * Prompts the user to select a GCP project ID for the Observability MCP server.
 */
export async function configureGcpObservability(
  projects: string[],
  previousProject?: string,
): Promise<GcpObservabilityConfig> {
  const projectValue = await select({
    message: "Select GCP project for Observability:",
    options: projects.map((p) => ({ value: p, label: p })),
    // Intentionally more defensive than the CloudWatch pattern: guards against a
    // stale previousProject that is no longer present in the current project list.
    initialValue:
      previousProject && projects.includes(previousProject)
        ? previousProject
        : projects[0],
  });
  handleCancel(projectValue);

  return { project: projectValue as string };
}
