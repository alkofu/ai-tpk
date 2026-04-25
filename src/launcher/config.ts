import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { LauncherConfig } from './types.js';

function getConfigDir(): string {
  return path.join(os.homedir(), '.config', 'tpk');
}

function getConfigFile(): string {
  return path.join(getConfigDir(), 'config.json');
}

const DEFAULT_CONFIG: LauncherConfig = {
  selectedMcps: [],
};

export function loadConfig(): LauncherConfig {
  try {
    const raw = fs.readFileSync(getConfigFile(), 'utf8');
    const parsed = JSON.parse(raw) as LauncherConfig;
    return parsed;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: LauncherConfig): void {
  const configDir = getConfigDir();
  // 0o700 on directory, 0o600 on file — config reveals operational context (cluster names, profiles)
  fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(getConfigFile(), JSON.stringify(config, null, 2), {
    mode: 0o600,
    encoding: 'utf8',
  });
}
