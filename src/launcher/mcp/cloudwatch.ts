import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { select } from '@clack/prompts';
import type { CloudWatchConfig } from '../types.js';
import { handleCancel } from '../cancel.js';
import type { McpCommand } from '../mcp-command-types.js';
import { tryLoad } from '../utils.js';
import { writeDotfile } from '../dotfile.js';
import type { ResolvedConfig, LauncherConfig, SkippedMap } from '../types.js';

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.aws', 'config');
const DEFAULT_CREDENTIALS_PATH = path.join(os.homedir(), '.aws', 'credentials');

export function parseProfileSections(
  content: string,
  format: 'config' | 'credentials',
): string[] {
  const lines = content.split('\n');
  const profiles: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (format === 'config') {
      // Match [default] or [profile <name>]
      const defaultMatch = /^\[default\]$/i.exec(trimmed);
      if (defaultMatch) {
        profiles.push('default');
        continue;
      }
      const profileMatch = /^\[profile\s+([^\]]+)\]$/i.exec(trimmed);
      if (profileMatch) {
        const profileName = profileMatch[1].trim();
        if (profileName) {
          profiles.push(profileName);
        }
      }
    } else {
      // credentials format: every [<name>] header is a profile name (including [default])
      const sectionMatch = /^\[([^\]]+)\]$/.exec(trimmed);
      if (sectionMatch) {
        const profileName = sectionMatch[1].trim();
        if (profileName) {
          profiles.push(profileName);
        }
      }
    }
  }

  if (format === 'credentials') {
    const seen = new Set<string>();
    return profiles
      .filter((p) => {
        const key = p.replace(/\./g, '_');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .toSorted();
  }

  return profiles;
}

export function loadAwsProfiles(
  configPath?: string,
  credentialsPath?: string,
): string[] {
  const resolvedConfigPath = configPath ?? DEFAULT_CONFIG_PATH;
  const resolvedCredentialsPath = credentialsPath ?? DEFAULT_CREDENTIALS_PATH;
  const configExplicitlyProvided = configPath !== undefined;

  if (fs.existsSync(resolvedConfigPath)) {
    const content = fs.readFileSync(resolvedConfigPath, 'utf8');
    const profiles = parseProfileSections(content, 'config');

    if (profiles.length === 0) {
      throw new Error(
        `No AWS profiles found in ${resolvedConfigPath}. Check the file format.`,
      );
    }

    return profiles;
  }

  if (configExplicitlyProvided) {
    // Caller pointed at a specific path that does not exist — preserve existing error
    throw new Error(
      `AWS config not found at ${resolvedConfigPath}. Create it or deselect CloudWatch.`,
    );
  }

  // Default config path absent — try credentials file
  if (fs.existsSync(resolvedCredentialsPath)) {
    const content = fs.readFileSync(resolvedCredentialsPath, 'utf8');
    const profiles = parseProfileSections(content, 'credentials');

    if (profiles.length === 0) {
      throw new Error(
        `No AWS profiles found in ${resolvedCredentialsPath}. Check the file format.`,
      );
    }

    return profiles;
  }

  throw new Error(
    `No AWS configuration found. Expected ~/.aws/config or ~/.aws/credentials. Create one of these files or deselect CloudWatch.`,
  );
}

export async function configureCloudWatch(
  profiles: string[],
  previousProfile?: string,
): Promise<CloudWatchConfig> {
  const profileValue = await select({
    message: 'Select AWS profile for CloudWatch:',
    options: profiles.map((p) => ({ value: p, label: p })),
    initialValue:
      previousProfile && profiles.includes(previousProfile)
        ? previousProfile
        : profiles[0],
  });
  handleCancel(profileValue);

  return { profile: profileValue as string };
}

export const cloudwatchCommand: McpCommand = {
  id: 'cloudwatch',
  skippedKey: 'cloudwatch',
  multiselectOption: {
    value: 'cloudwatch',
    label: 'CloudWatch',
    hint: 'AWS profile',
  },

  async configureInteractive(savedConfig: LauncherConfig): Promise<{
    resolved: Partial<ResolvedConfig>;
    persistable: Partial<LauncherConfig>;
  } | null> {
    const profiles = tryLoad(() => loadAwsProfiles(), 'cloudwatch');
    if (profiles === null) return null;
    const result = await configureCloudWatch(
      profiles,
      savedConfig.cloudwatch?.profile,
    );
    return {
      resolved: { cloudwatch: result },
      persistable: { cloudwatch: { profile: result.profile } },
    };
  },

  resolveFromSaved(config: LauncherConfig): Partial<ResolvedConfig> | null {
    if (config.cloudwatch === undefined) return null;
    return { cloudwatch: { profile: config.cloudwatch.profile } };
  },

  emitEnvVars(resolved: ResolvedConfig, env: Record<string, string>): void {
    if (!resolved.cloudwatch) return;
    const profile = resolved.cloudwatch.profile;
    env['AWS_PROFILE'] = profile;
    // mcp-cloudwatch.sh reads ~/.claude/.current-aws-profile and overrides AWS_PROFILE.
    // Write the dotfile so both paths agree — same behaviour as /set-aws-profile command.
    writeDotfile('current-aws-profile', profile);
  },

  buildOutroSuccessLine(resolved: ResolvedConfig): string | null {
    if (!resolved.cloudwatch) return null;
    return `CloudWatch: ${resolved.cloudwatch.profile}`;
  },

  buildOutroSkipLine(skipped: SkippedMap[keyof SkippedMap]): string | null {
    if (!skipped) return null;
    return 'CloudWatch: skipped (profiles unavailable)';
  },

  buildSummaryLine(config: LauncherConfig): string {
    if (config.cloudwatch === undefined) {
      return 'CloudWatch: (not yet configured)';
    }
    return `CloudWatch: profile ${config.cloudwatch.profile}`;
  },
};
