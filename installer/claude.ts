import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { c } from "./colors.js";
import { backupIfExists, installPath } from "./fs-utils.js";

export function installClaudeWhitelist(scriptDir: string, mode: "symlink" | "copy"): void {
  const claudeSrc = path.join(scriptDir, "claude");

  try {
    const claudeSrcStat = fs.statSync(claudeSrc);
    if (!claudeSrcStat.isDirectory()) {
      console.log(c.yellow("Skipping claude/ (not found in repository)"));
      return;
    }
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT") {
      console.log(c.yellow("Skipping claude/ (not found in repository)"));
      return;
    }
    throw err;
  }

  const dotClaudePath = path.join(os.homedir(), ".claude");

  // Replace legacy full-tree ~/.claude symlink with a real directory
  try {
    const stat = fs.lstatSync(dotClaudePath);
    if (stat.isSymbolicLink()) {
      backupIfExists(dotClaudePath);
    }
  } catch (err: unknown) {
    if (!(err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT")) {
      throw err;
    }
    // Does not exist — nothing to do before mkdir
  }

  fs.mkdirSync(dotClaudePath, { recursive: true });

  // settings.json
  const settingsSrc = path.join(claudeSrc, "settings.json");
  try {
    const settingsStat = fs.statSync(settingsSrc);
    if (settingsStat.isFile()) {
      installPath(settingsSrc, path.join(dotClaudePath, "settings.json"), mode);
    } else {
      console.log(c.yellow("Skipping claude/settings.json (not found in repository)"));
    }
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT") {
      console.log(c.yellow("Skipping claude/settings.json (not found in repository)"));
    } else {
      throw err;
    }
  }

  // CLAUDE.md
  const claudeMdSrc = path.join(claudeSrc, "CLAUDE.md");
  try {
    const claudeMdStat = fs.statSync(claudeMdSrc);
    if (claudeMdStat.isFile()) {
      installPath(claudeMdSrc, path.join(dotClaudePath, "CLAUDE.md"), mode);
    } else {
      console.log(c.yellow("Skipping claude/CLAUDE.md (not found in repository)"));
    }
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT") {
      console.log(c.yellow("Skipping claude/CLAUDE.md (not found in repository)"));
    } else {
      throw err;
    }
  }

  // Sub-directories
  for (const name of ["skills", "agents", "hooks", "commands", "references"]) {
    const subSrc = path.join(claudeSrc, name);
    try {
      const subStat = fs.statSync(subSrc);
      if (subStat.isDirectory()) {
        installPath(subSrc, path.join(dotClaudePath, name), mode);
      } else {
        console.log(c.yellow(`Skipping claude/${name}/ (not found in repository)`));
      }
    } catch (err: unknown) {
      if (err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT") {
        console.log(c.yellow(`Skipping claude/${name}/ (not found in repository)`));
      } else {
        throw err;
      }
    }
  }
}
