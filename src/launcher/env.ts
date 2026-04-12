import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { ResolvedConfig } from "./types.js";

const AWS_PROFILE_DOTFILE = path.join(
  os.homedir(),
  ".claude",
  ".current-aws-profile",
);

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
    const dotfileDir = path.dirname(AWS_PROFILE_DOTFILE);
    fs.mkdirSync(dotfileDir, { recursive: true });
    fs.writeFileSync(AWS_PROFILE_DOTFILE, profile + "\n", {
      mode: 0o600,
      encoding: "utf8",
    });
  }

  return envVars;
}
