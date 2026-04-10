import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execSync } from "node:child_process";
import { backupIfExists } from "./fs-utils.js";
import { c } from "./colors.js";

// Directories within launcher/ that should be copied to the installed location.
// Update this list when adding new subdirectories under launcher/.
// test/ is intentionally excluded (dev-only).
const LAUNCHER_SUBDIRS_TO_COPY = ["mcp"];

// Files in launcher/ root that must NOT be copied as TypeScript source.
// These are handled separately or excluded entirely.
const LAUNCHER_ROOT_EXCLUDE = new Set([
  "package.json", // copied separately
  "myclaude.sh", // copied to ~/bin, not to launcher dir
  "README.md", // dev-only documentation
]);

export function installLauncherScript(
  repoRoot: string,
  {
    skipNpmInstall = false,
    homeDir = os.homedir(),
  }: { skipNpmInstall?: boolean; homeDir?: string } = {},
): void {
  const srcLauncherDir = path.join(repoRoot, "launcher");
  const destLauncherDir = path.join(homeDir, ".claude", "launcher");
  const binDir = path.join(homeDir, "bin");
  const targetBinPath = path.join(binDir, "myclaude");
  const srcBashScript = path.join(srcLauncherDir, "myclaude.sh");
  const srcPackageJson = path.join(srcLauncherDir, "package.json");

  // 1. Create destination directory
  // On re-install: remove all non-node_modules content to prevent stale .ts files
  if (fs.existsSync(destLauncherDir)) {
    for (const entry of fs.readdirSync(destLauncherDir, {
      withFileTypes: true,
    })) {
      if (entry.name === "node_modules") continue;
      fs.rmSync(path.join(destLauncherDir, entry.name), {
        recursive: true,
        force: true,
      });
    }
  }
  fs.mkdirSync(destLauncherDir, { recursive: true });

  // 2. Copy root-level .ts files (excluding test/, package.json, myclaude.sh, README.md)
  const rootEntries = fs.readdirSync(srcLauncherDir, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !LAUNCHER_ROOT_EXCLUDE.has(entry.name)
    ) {
      fs.copyFileSync(
        path.join(srcLauncherDir, entry.name),
        path.join(destLauncherDir, entry.name),
      );
    }
  }

  // 3. Copy allowed subdirectories (mcp/ etc.) — one level deep, .ts files only
  for (const subdir of LAUNCHER_SUBDIRS_TO_COPY) {
    const srcSubdir = path.join(srcLauncherDir, subdir);
    const destSubdir = path.join(destLauncherDir, subdir);
    if (!fs.existsSync(srcSubdir)) continue;
    fs.mkdirSync(destSubdir, { recursive: true });
    const subEntries = fs.readdirSync(srcSubdir, { withFileTypes: true });
    for (const entry of subEntries) {
      if (entry.isFile() && entry.name.endsWith(".ts")) {
        fs.copyFileSync(
          path.join(srcSubdir, entry.name),
          path.join(destSubdir, entry.name),
        );
      }
    }
  }

  // 4. Copy package.json
  fs.copyFileSync(srcPackageJson, path.join(destLauncherDir, "package.json"));

  // 5. Run npm install in the destination directory
  if (!skipNpmInstall) {
    console.log("Installing launcher dependencies...");
    try {
      execSync("npm install", {
        cwd: destLauncherDir,
        stdio: "inherit",
      });
    } catch (err) {
      console.error(
        c.red(
          `Failed to install launcher dependencies in ${destLauncherDir}.\n` +
            `Run: cd ${destLauncherDir} && npm install`,
        ),
      );
      throw err;
    }
  }

  // 6. Install ~/bin/myclaude — refuse symlinks, backup existing
  fs.mkdirSync(binDir, { recursive: true });
  try {
    const stat = fs.lstatSync(targetBinPath);
    if (stat.isSymbolicLink()) {
      console.warn(
        c.yellow(
          `Warning: ${targetBinPath} is a symlink. Remove it manually before re-running install.sh.`,
        ),
      );
      return;
    }
  } catch {
    // File does not exist — fine
  }
  backupIfExists(targetBinPath);
  fs.copyFileSync(srcBashScript, targetBinPath);
  fs.chmodSync(targetBinPath, 0o755);

  console.log(c.green(`Launcher installed to ~/bin/myclaude`));
  console.log(c.green(`Launcher source installed to ~/.claude/launcher/`));
}
