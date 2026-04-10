import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { select } from "@clack/prompts";
import type { CloudWatchConfig } from "../types.js";
import { handleCancel } from "../utils.js";

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), ".aws", "config");

export function loadAwsProfiles(configPath?: string): string[] {
  const resolvedPath = configPath ?? DEFAULT_CONFIG_PATH;

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `AWS config not found at ${resolvedPath}. Create it or deselect CloudWatch.`,
    );
  }

  const lines = fs.readFileSync(resolvedPath, "utf8").split("\n");
  const profiles: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match [default] or [profile <name>]
    const defaultMatch = /^\[default\]$/i.exec(trimmed);
    if (defaultMatch) {
      profiles.push("default");
      continue;
    }
    const profileMatch = /^\[profile\s+([^\]]+)\]$/i.exec(trimmed);
    if (profileMatch) {
      const profileName = profileMatch[1].trim();
      if (profileName) {
        profiles.push(profileName);
      }
    }
  }

  if (profiles.length === 0) {
    throw new Error(
      `No AWS profiles found in ${resolvedPath}. Check the file format.`,
    );
  }

  return profiles;
}

export async function configureCloudWatch(
  profiles: string[],
  previousProfile?: string,
): Promise<CloudWatchConfig> {
  const profileValue = await select({
    message: "Select AWS profile for CloudWatch:",
    options: profiles.map((p) => ({ value: p, label: p })),
    initialValue: previousProfile ?? profiles[0],
  });
  handleCancel(profileValue);

  return { profile: profileValue as string };
}
