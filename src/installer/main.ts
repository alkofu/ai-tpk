import { parseArgs } from "./cli.js";
import { installDir } from "./fs-utils.js";
import { installClaudeWhitelist } from "./claude.js";
import { installMcpServers } from "./mcp.js";
import { installLauncherScript } from "./launcher-install.js";
import { initTokenDb, removeLegacySingletonStagingFiles } from "./token-db.js";
import { c } from "./colors.js";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";

// scriptDir = repo root; at runtime __filename is dist/installer.js so one
// dirname reaches dist/ and a second reaches the repo root.
const __filename = fileURLToPath(import.meta.url);
const installerDir = path.dirname(__filename);
const scriptDir = path.dirname(installerDir);

try {
  parseArgs(process.argv.slice(2));

  console.log(c.blue("AI TPK Installer"));
  console.log(c.blue("====================="));
  console.log("");
  console.log(`Source directory: ${scriptDir}`);
  console.log("");

  installClaudeWhitelist(scriptDir, os.homedir());
  installDir(scriptDir, "cursor", ".cursor", os.homedir());
  installDir(scriptDir, "src/mcp/wrappers", ".claude/wrappers", os.homedir());

  // Create ~/.ai-tpk artifact directories
  const aiTpkDir = path.join(os.homedir(), ".ai-tpk");
  fs.mkdirSync(path.join(aiTpkDir, "plans"), { recursive: true });
  fs.mkdirSync(path.join(aiTpkDir, "lessons"), { recursive: true });
  console.log(
    c.green(
      `✓ Created artifact directories: ${aiTpkDir}/plans/, ${aiTpkDir}/lessons/`,
    ),
  );

  // Optional: initialize the SQLite token DB schema when sqlite3 is available.
  // The installer surfaces a one-line notice when sqlite3 is absent; the
  // indexer script (talekeeper-index.sh) is fully silent in the same case.
  initTokenDb(os.homedir(), (msg) => console.log(msg));

  // Remove legacy singleton staging files left over from before per-session
  // staging was introduced.
  removeLegacySingletonStagingFiles(os.homedir(), (msg) => console.log(msg));

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
