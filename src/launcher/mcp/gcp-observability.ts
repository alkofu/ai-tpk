import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { text } from "@clack/prompts";
import type { GcpObservabilityConfig } from "../types.js";
import { handleCancel } from "../utils.js";

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
 * Prompts the user to enter a GCP project ID for the Observability MCP server.
 */
export async function configureGcpObservability(
  previousProject?: string,
): Promise<GcpObservabilityConfig> {
  const projectValue = await text({
    message: "Enter GCP project ID for Observability:",
    defaultValue: previousProject,
    placeholder: previousProject ?? "my-gcp-project-123",
    validate(value) {
      if (!validateGcpProjectId(value)) {
        return "Invalid GCP project ID. Must be 6-30 chars: lowercase letters, digits, hyphens. Must start with a letter, not end with a hyphen, and not contain consecutive hyphens.";
      }
    },
  });
  handleCancel(projectValue);

  return { project: projectValue as string };
}
