import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { LauncherConfig } from "./types.js";

const CONFIG_DIR = path.join(os.homedir(), ".config", "myclaude");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG: LauncherConfig = {
  selectedMcps: [],
};

export function loadConfig(): LauncherConfig {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw) as LauncherConfig;
    return parsed;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: LauncherConfig): void {
  // 0o700 on directory, 0o600 on file — config reveals operational context (cluster names, profiles)
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), {
    mode: 0o600,
    encoding: "utf8",
  });
}
