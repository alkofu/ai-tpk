import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { ResolvedConfig } from "./types.js";

function writeDotfile(name: string, value: string): void {
  const dotfilePath = path.join(os.homedir(), ".claude", "." + name);
  const dotfileDir = path.dirname(dotfilePath);
  fs.mkdirSync(dotfileDir, { recursive: true });
  fs.writeFileSync(dotfilePath, value + "\n", {
    mode: 0o600,
    encoding: "utf8",
  });
}

export function buildEnvVars(config: ResolvedConfig): Record<string, string> {
  const envVars: Record<string, string> = {};

  if (config.grafana) {
    const { cluster, role } = config.grafana;
    envVars["GRAFANA_URL"] = cluster.url;

    if (role === "viewer") {
      envVars["GRAFANA_SERVICE_ACCOUNT_TOKEN"] = cluster.viewer_token;
      envVars["GRAFANA_DISABLE_WRITE"] = "true";
    } else {
      // editor role — no GRAFANA_DISABLE_WRITE
      envVars["GRAFANA_SERVICE_ACCOUNT_TOKEN"] = cluster.editor_token;
    }
  }

  if (config.cloudwatch) {
    const profile = config.cloudwatch.profile;
    envVars["AWS_PROFILE"] = profile;

    // mcp-cloudwatch.sh reads ~/.claude/.current-aws-profile and overrides AWS_PROFILE.
    // Write the dotfile so both paths agree — same behaviour as /set-aws-profile command.
    writeDotfile("current-aws-profile", profile);
  }

  if (config.gcpObservability) {
    const project = config.gcpObservability.project;
    envVars["GOOGLE_CLOUD_PROJECT"] = project;

    // mcp-gcp-observability.sh reads ~/.claude/.current-gcp-project and overrides GOOGLE_CLOUD_PROJECT.
    // Write the dotfile so both paths agree.
    // Note: GOOGLE_CLOUD_PROJECT is used by google-auth-library's getProjectId() for project ID resolution.
    // getProjectId() checks the GCLOUD_PROJECT / GOOGLE_CLOUD_PROJECT env var group (GCLOUD_PROJECT first,
    // then GOOGLE_CLOUD_PROJECT), before credential files or the metadata server.
    // It does NOT auto-populate tool call parameters.
    writeDotfile("current-gcp-project", project);
  }

  if (config.kubernetes) {
    const context = config.kubernetes.context;
    // K8S_CONTEXT: explicit context override for mcp-server-kubernetes.
    // Takes higher priority than ~/.kube/config active context, ensuring the
    // selected context is respected even when other kubeconfig env vars
    // (KUBECONFIG, K8S_SERVER, etc.) are present in the environment.
    envVars["K8S_CONTEXT"] = context;

    // Write dotfile for symmetry with cloudwatch/gcp patterns and potential
    // future use by wrapper scripts or slash commands.
    writeDotfile("current-kube-context", context);
  }

  return envVars;
}
