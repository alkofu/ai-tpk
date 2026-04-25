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
  const targetBinPath = path.join(binDir, 'tpk');
  const srcBashScript = path.join(repoRoot, 'src', 'launcher', 'tpk.sh');
  const oldLauncherDir = path.join(homeDir, '.claude', 'launcher');

  // 8b. Guard: verify required source files exist before any side effects
  if (!fs.existsSync(srcBundle)) {
    throw new Error(`dist/launcher.cjs not found. Run 'pnpm run build' first.`);
  }
  if (!fs.existsSync(srcBashScript)) {
    throw new Error(
      `src/launcher/tpk.sh not found. The repository may be incomplete.`,
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

  // 8e. Install ~/bin/tpk — refuse symlinks, backup existing
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
  console.log(c.green(`Launcher installed to ~/bin/tpk`));
  console.log(c.green(`Launcher bundle installed to ~/.ai-tpk/launcher.cjs`));

  // 8g. Migrate: copy ~/.config/myclaude/config.json -> ~/.config/tpk/config.json.
  //     Source is preserved (user cleans up manually).
  //     Runs AFTER 8e/8f so any short-circuit return at 8e (symlink branch) prevents
  //     a half-migrated state. Logs a yellow line on BOTH copy and skip paths.
  const legacyConfigDir = path.join(homeDir, '.config', 'myclaude');
  const legacyConfigFile = path.join(legacyConfigDir, 'config.json');
  const newConfigDir = path.join(homeDir, '.config', 'tpk');
  const newConfigFile = path.join(newConfigDir, 'config.json');
  const legacyConfigExists = fs.existsSync(legacyConfigFile);
  const newConfigExists = fs.existsSync(newConfigFile);
  if (legacyConfigExists && !newConfigExists) {
    fs.mkdirSync(newConfigDir, { recursive: true, mode: 0o700 });
    fs.copyFileSync(legacyConfigFile, newConfigFile);
    // Always set 0o600 regardless of source mode — matches the saveConfig() posture
    // and is the same mode the launcher would write next time it persists.
    fs.chmodSync(newConfigFile, 0o600);
    console.log(
      c.yellow(
        'Copied ~/.config/myclaude/config.json -> ~/.config/tpk/config.json (legacy file left in place)',
      ),
    );
  } else if (legacyConfigExists && newConfigExists) {
    console.log(
      c.yellow(
        'Skipping copy: ~/.config/tpk/config.json already exists; legacy source ~/.config/myclaude/config.json left in place',
      ),
    );
  }

  // 8h. Migrate: copy ~/.config/{argocd-accounts.json,github-pats.json,
  //     grafana-clusters.yaml} -> ~/.config/tpk/<same-filename>.
  //     Source is preserved. Runs AFTER 8e/8f so any 8e short-circuit prevents a
  //     half-migrated state. Logs a yellow line on BOTH copy and skip paths.
  const consolidatedConfigDir = path.join(homeDir, '.config', 'tpk');
  const filesToConsolidate = [
    'argocd-accounts.json',
    'github-pats.json',
    'grafana-clusters.yaml',
  ];
  for (const filename of filesToConsolidate) {
    const legacyPath = path.join(homeDir, '.config', filename);
    const newPath = path.join(consolidatedConfigDir, filename);
    const legacyExists = fs.existsSync(legacyPath);
    const newExists = fs.existsSync(newPath);
    if (legacyExists && !newExists) {
      fs.mkdirSync(consolidatedConfigDir, { recursive: true, mode: 0o700 });
      const srcMode = fs.statSync(legacyPath).mode & 0o777;
      fs.copyFileSync(legacyPath, newPath);
      fs.chmodSync(newPath, srcMode);
      console.log(
        c.yellow(
          `Copied ~/.config/${filename} -> ~/.config/tpk/${filename} (legacy file left in place)`,
        ),
      );
    } else if (legacyExists && newExists) {
      console.log(
        c.yellow(
          `Skipping copy: ~/.config/tpk/${filename} already exists; legacy source ~/.config/${filename} left in place`,
        ),
      );
    }
  }
}
