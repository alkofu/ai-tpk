import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { backupIfExists } from './fs-utils.js';
import { c } from './colors.js';

export function installLauncherScript(
  repoRoot: string,
  { homeDir = os.homedir() }: { homeDir?: string } = {},
): void {
  // 8a. Define paths
  const srcBundle = path.join(repoRoot, 'dist', 'launcher.cjs');
  const aiTpkDir = path.join(homeDir, '.ai-tpk');
  const destBundle = path.join(aiTpkDir, 'launcher.cjs');
  const binDir = path.join(homeDir, 'bin');
  const targetBinPath = path.join(binDir, 'myclaude');
  const srcBashScript = path.join(repoRoot, 'src', 'launcher', 'myclaude.sh');
  const oldLauncherDir = path.join(homeDir, '.claude', 'launcher');

  // 8b. Guard: verify required source files exist before any side effects
  if (!fs.existsSync(srcBundle)) {
    throw new Error(`dist/launcher.cjs not found. Run 'pnpm run build' first.`);
  }
  if (!fs.existsSync(srcBashScript)) {
    throw new Error(
      `src/launcher/myclaude.sh not found. The repository may be incomplete.`,
    );
  }

  // 8c. Create ~/.ai-tpk/ and copy bundle
  fs.mkdirSync(aiTpkDir, { recursive: true });
  fs.copyFileSync(srcBundle, destBundle);

  // 8d. Migrate: remove old ~/.claude/launcher/ if it exists (only after 8c succeeds)
  if (fs.existsSync(oldLauncherDir)) {
    fs.rmSync(oldLauncherDir, { recursive: true, force: true });
    console.log(c.yellow(`Removed old launcher directory: ${oldLauncherDir}`));
  }

  // 8d2. Migrate: remove stale ~/.ai-tpk/launcher.js left by pre-rename installs
  const staleLauncherJs = path.join(aiTpkDir, 'launcher.js');
  if (fs.existsSync(staleLauncherJs)) {
    fs.rmSync(staleLauncherJs);
    console.log(
      c.yellow(
        'Removed stale ~/.ai-tpk/launcher.js (replaced by launcher.cjs)',
      ),
    );
  }

  // 8e. Install ~/bin/myclaude — refuse symlinks, backup existing
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

  // 8f. Print success messages
  console.log(c.green(`Launcher installed to ~/bin/myclaude`));
  console.log(c.green(`Launcher bundle installed to ~/.ai-tpk/launcher.cjs`));
}
