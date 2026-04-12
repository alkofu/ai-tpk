import { parseArgs } from "./cli.js";
import { installDir } from "./fs-utils.js";
import { installClaudeWhitelist } from "./claude.js";
import { installMcpServers } from "./mcp.js";
import { installLauncherScript } from "./launcher-install.js";
import { c } from "./colors.js";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import * as os from "node:os";

// Resolve scriptDir = repo root (parent of src/installer/)
const __filename = fileURLToPath(import.meta.url);
const installerDir = path.dirname(__filename);
const scriptDir = path.dirname(path.dirname(installerDir));

try {
  parseArgs(process.argv.slice(2));

  console.log(c.blue("AI TPK Installer"));
  console.log(c.blue("====================="));
  console.log("");
  console.log(`Source directory: ${scriptDir}`);
  console.log("");

  installClaudeWhitelist(scriptDir, os.homedir());
  installDir(scriptDir, "cursor", ".cursor", os.homedir());
  installDir(scriptDir, "wrappers", ".claude/wrappers", os.homedir());

  console.log("");
  installMcpServers(scriptDir);

  console.log("");
  installLauncherScript(scriptDir);

  console.log("");
  console.log(c.green("✓ Installation complete!"));
  console.log("");

  console.log("Your configurations have been copied from this repository.");
  console.log(`To update: cd ${scriptDir} && git pull && ./install.sh`);
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`\x1b[0;31mError: ${msg}\x1b[0m\n`);
  process.exit(1);
}
