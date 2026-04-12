#!/usr/bin/env node

// installer/colors.ts
var noColor = Boolean(process.env["NO_COLOR"]);
function wrap(code, msg) {
  if (noColor) return msg;
  return `${code}${msg}\x1B[0m`;
}
var c = {
  red: (msg) => wrap("\x1B[0;31m", msg),
  green: (msg) => wrap("\x1B[0;32m", msg),
  yellow: (msg) => wrap("\x1B[1;33m", msg),
  blue: (msg) => wrap("\x1B[0;34m", msg)
};

// installer/cli.ts
var USAGE = `Usage: ./install.sh

Install AI TPK to your home directory.

Claude Code:
  - Whitelisted paths: settings.json, CLAUDE.md, skills/, agents/, references/
  - MCP servers: kubernetes, cloudwatch (user scope, via claude mcp add)

Options:
  --help    Show this help message`;
function parseArgs(argv) {
  for (const flag of argv) {
    switch (flag) {
      case "--help":
      case "-h":
        console.log(USAGE);
        process.exit(0);
        break;
      default:
        process.stderr.write(`${c.red(`Error: Unknown option ${flag}`)}
`);
        process.stderr.write(
          "Run './install.sh --help' for usage information.\n"
        );
        process.exit(1);
    }
  }
}

// installer/fs-utils.ts
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
var pad = (n, len = 2) => String(n).padStart(len, "0");
function timestamp() {
  const now = /* @__PURE__ */ new Date();
  const YYYY = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const DD = pad(now.getDate());
  const HH = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const SS = pad(now.getSeconds());
  return `${YYYY}${MM}${DD}_${HH}${mm}${SS}`;
}
function backupIfExists(targetPath) {
  try {
    fs.statSync(targetPath);
  } catch (err) {
    if (err instanceof Error && err.code === "ENOENT") {
      return;
    }
    throw err;
  }
  const backupPath = `${targetPath}.backup.${timestamp()}`;
  console.log(c.yellow(`Backing up existing ${targetPath} to ${backupPath}`));
  fs.renameSync(targetPath, backupPath);
}
function installPath(src, dest) {
  backupIfExists(dest);
  console.log(c.green(`Copying: ${src} -> ${dest}`));
  fs.cpSync(src, dest, { recursive: true });
}
function installDir(scriptDir2, srcName, destName, destRoot = os.homedir()) {
  const srcPath = path.join(scriptDir2, srcName);
  const destPath = path.join(destRoot, destName);
  try {
    const srcStat = fs.statSync(srcPath);
    if (!srcStat.isDirectory()) {
      console.log(c.yellow(`Skipping ${srcName} (not found in repository)`));
      return;
    }
  } catch (err) {
    if (err instanceof Error && err.code === "ENOENT") {
      console.log(c.yellow(`Skipping ${srcName} (not found in repository)`));
      return;
    }
    throw err;
  }
  installPath(srcPath, destPath);
}

// installer/claude.ts
import * as fs2 from "node:fs";
import * as path2 from "node:path";
import * as os2 from "node:os";

// installer/constants.ts
var CLAUDE_WHITELIST_DIRS = [
  "skills",
  "agents",
  "hooks",
  "commands",
  "references"
];
var CLAUDE_WHITELIST_FILES = [
  "settings.json",
  "CLAUDE.md"
];

// installer/claude.ts
function installClaudeWhitelist(scriptDir2, destRoot = os2.homedir()) {
  const claudeSrc = path2.join(scriptDir2, "claude");
  try {
    const claudeSrcStat = fs2.statSync(claudeSrc);
    if (!claudeSrcStat.isDirectory()) {
      console.log(c.yellow("Skipping claude/ (not found in repository)"));
      return;
    }
  } catch (err) {
    if (err instanceof Error && err.code === "ENOENT") {
      console.log(c.yellow("Skipping claude/ (not found in repository)"));
      return;
    }
    throw err;
  }
  const dotClaudePath = path2.join(destRoot, ".claude");
  fs2.mkdirSync(dotClaudePath, { recursive: true });
  for (const fileName of CLAUDE_WHITELIST_FILES) {
    const fileSrc = path2.join(claudeSrc, fileName);
    const fileDest = path2.join(dotClaudePath, fileName);
    try {
      const stat = fs2.statSync(fileSrc);
      if (stat.isFile()) {
        installPath(fileSrc, fileDest);
      } else {
        console.log(
          c.yellow(`Skipping claude/${fileName} (not a regular file)`)
        );
      }
    } catch (err) {
      if (err instanceof Error && err.code === "ENOENT") {
        console.log(
          c.yellow(`Skipping claude/${fileName} (not found in repository)`)
        );
      } else {
        throw err;
      }
    }
  }
  for (const name of CLAUDE_WHITELIST_DIRS) {
    const subSrc = path2.join(claudeSrc, name);
    try {
      const subStat = fs2.statSync(subSrc);
      if (subStat.isDirectory()) {
        installPath(subSrc, path2.join(dotClaudePath, name));
      } else {
        console.log(
          c.yellow(`Skipping claude/${name}/ (not found in repository)`)
        );
      }
    } catch (err) {
      if (err instanceof Error && err.code === "ENOENT") {
        console.log(
          c.yellow(`Skipping claude/${name}/ (not found in repository)`)
        );
      } else {
        throw err;
      }
    }
  }
}

// installer/mcp.ts
import { execFileSync } from "node:child_process";
import * as fs3 from "node:fs";
import * as path3 from "node:path";
import * as os3 from "node:os";
function expandVars(value) {
  const home = os3.homedir();
  const user = os3.userInfo().username;
  return value.replace(/\$\{HOME\}|\$HOME(?!\w)/g, home).replace(/\$\{USER\}|\$USER(?!\w)/g, user);
}
function loadMcpServers(repoRoot) {
  const filePath = path3.join(repoRoot, "mcp-servers.json");
  let raw;
  try {
    raw = fs3.readFileSync(filePath, "utf8");
  } catch (err) {
    if (err instanceof Error && err.code === "ENOENT") {
      console.log(
        c.yellow(
          "Warning: mcp-servers.json not found -- skipping MCP server setup"
        )
      );
      return [];
    }
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`mcp-servers.json: invalid JSON in ${filePath}`);
  }
  if (typeof parsed !== "object" || parsed === null || !("servers" in parsed)) {
    throw new Error("mcp-servers.json: missing top-level 'servers' field");
  }
  const { servers } = parsed;
  if (!Array.isArray(servers)) {
    throw new Error("mcp-servers.json: 'servers' must be an array");
  }
  const validScopes = ["user", "project"];
  const validTransports = ["stdio", "sse", "streamable-http"];
  for (const entry of servers) {
    if (typeof entry !== "object" || entry === null) {
      throw new Error("mcp-servers.json: each server entry must be an object");
    }
    const server = entry;
    if (typeof server["name"] !== "string" || server["name"].trim() === "") {
      throw new Error(
        "mcp-servers.json: server entry missing required non-empty 'name' field"
      );
    }
    const name = server["name"];
    if (!validScopes.includes(server["scope"])) {
      throw new Error(
        `mcp-servers.json: server '${name}' has invalid scope '${String(server["scope"])}' -- must be 'user' or 'project'`
      );
    }
    if (!validTransports.includes(
      server["transport"]
    )) {
      throw new Error(
        `mcp-servers.json: server '${name}' has invalid transport '${String(server["transport"])}' -- must be 'stdio', 'sse', or 'streamable-http'`
      );
    }
    const hasWrapper = typeof server["wrapper"] === "string" && server["wrapper"].trim() !== "";
    const hasCommand = typeof server["command"] === "string" && server["command"].trim() !== "";
    if (hasWrapper && hasCommand) {
      throw new Error(
        `mcp-servers.json: server '${name}' must not have both 'wrapper' and 'command' fields`
      );
    }
    if (!hasWrapper && !hasCommand) {
      throw new Error(
        `mcp-servers.json: server '${name}' must have either 'wrapper' or 'command' field`
      );
    }
  }
  return servers;
}
function buildAddArgs(server, repoRoot, homedir6 = os3.homedir()) {
  if (server.wrapper !== void 0) {
    const absoluteWrapperPath = server.scope === "user" ? path3.join(homedir6, ".claude", server.wrapper) : path3.join(repoRoot, server.wrapper);
    try {
      fs3.statSync(absoluteWrapperPath);
    } catch (err) {
      if (err instanceof Error && err.code === "ENOENT") {
        throw new Error(
          `Wrapper script not found: ${absoluteWrapperPath} (defined in server '${server.name}')`,
          { cause: err }
        );
      }
      throw err;
    }
    return [
      "-s",
      server.scope,
      "-t",
      server.transport,
      "--",
      server.name,
      absoluteWrapperPath
    ];
  }
  const result = ["-s", server.scope, "-t", server.transport];
  for (const [key, value] of Object.entries(server.env ?? {})) {
    result.push("-e", `${key}=${expandVars(value)}`);
  }
  if (!server.command) {
    throw new Error(`Server '${server.name}' has no command or wrapper field`);
  }
  result.push("--", server.name, server.command);
  for (const arg of server.args ?? []) {
    result.push(expandVars(arg));
  }
  return result;
}
function installMcpServers(repoRoot) {
  try {
    execFileSync("claude", ["--version"], { stdio: "pipe" });
  } catch {
    console.log(c.yellow("Skipping MCP server setup (claude CLI not found)"));
    return;
  }
  console.log(c.blue("Configuring MCP servers (user scope)..."));
  for (const server of loadMcpServers(repoRoot)) {
    if (server.wrapper !== void 0) {
      try {
        execFileSync("claude", ["mcp", "remove", server.name], {
          stdio: "pipe"
        });
      } catch {
      }
    } else {
      try {
        execFileSync("claude", ["mcp", "get", server.name], { stdio: "pipe" });
        console.log(
          c.green(`MCP server '${server.name}' already configured, skipping`)
        );
        continue;
      } catch {
      }
    }
    if (server.prereq !== void 0) {
      try {
        fs3.statSync(expandVars(server.prereq));
      } catch (err) {
        if (err instanceof Error && err.code === "ENOENT") {
          console.log(
            c.yellow(
              `Warning: ${expandVars(server.prereq)} not found -- ${server.name} MCP will fail until this file is created`
            )
          );
        }
      }
    }
    try {
      execFileSync(
        "claude",
        ["mcp", "add", ...buildAddArgs(server, repoRoot)],
        {
          stdio: "pipe"
        }
      );
      console.log(c.green(`MCP server '${server.name}' added`));
    } catch {
      console.log(c.red(`Failed to add MCP server '${server.name}'`));
    }
  }
}

// installer/launcher-install.ts
import * as fs4 from "node:fs";
import * as path4 from "node:path";
import * as os4 from "node:os";
function installLauncherScript(repoRoot, { homeDir = os4.homedir() } = {}) {
  const srcBundle = path4.join(repoRoot, "dist", "launcher.js");
  const aiTpkDir = path4.join(homeDir, ".ai-tpk");
  const destBundle = path4.join(aiTpkDir, "launcher.js");
  const binDir = path4.join(homeDir, "bin");
  const targetBinPath = path4.join(binDir, "myclaude");
  const srcBashScript = path4.join(repoRoot, "launcher", "myclaude.sh");
  const oldLauncherDir = path4.join(homeDir, ".claude", "launcher");
  if (!fs4.existsSync(srcBundle)) {
    throw new Error(
      `dist/launcher.js not found. Run 'pnpm run build' first.`
    );
  }
  fs4.mkdirSync(aiTpkDir, { recursive: true });
  fs4.copyFileSync(srcBundle, destBundle);
  if (fs4.existsSync(oldLauncherDir)) {
    fs4.rmSync(oldLauncherDir, { recursive: true, force: true });
    console.log(c.yellow(`Removed old launcher directory: ${oldLauncherDir}`));
  }
  fs4.mkdirSync(binDir, { recursive: true });
  try {
    const stat = fs4.lstatSync(targetBinPath);
    if (stat.isSymbolicLink()) {
      console.warn(
        c.yellow(
          `Warning: ${targetBinPath} is a symlink. Remove it manually before re-running install.sh.`
        )
      );
      return;
    }
  } catch {
  }
  backupIfExists(targetBinPath);
  fs4.copyFileSync(srcBashScript, targetBinPath);
  fs4.chmodSync(targetBinPath, 493);
  console.log(c.green(`Launcher installed to ~/bin/myclaude`));
  console.log(c.green(`Launcher bundle installed to ~/.ai-tpk/launcher.js`));
}

// installer/main.ts
import { fileURLToPath } from "node:url";
import * as path5 from "node:path";
import * as os5 from "node:os";
var __filename = fileURLToPath(import.meta.url);
var installerDir = path5.dirname(__filename);
var scriptDir = path5.dirname(installerDir);
try {
  parseArgs(process.argv.slice(2));
  console.log(c.blue("AI TPK Installer"));
  console.log(c.blue("====================="));
  console.log("");
  console.log(`Source directory: ${scriptDir}`);
  console.log("");
  installClaudeWhitelist(scriptDir, os5.homedir());
  installDir(scriptDir, "cursor", ".cursor", os5.homedir());
  installDir(scriptDir, "wrappers", ".claude/wrappers", os5.homedir());
  console.log("");
  installMcpServers(scriptDir);
  console.log("");
  installLauncherScript(scriptDir);
  console.log("");
  console.log(c.green("\u2713 Installation complete!"));
  console.log("");
  console.log("Your configurations have been copied from this repository.");
  console.log(`To update: cd ${scriptDir} && git pull && ./install.sh`);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`\x1B[0;31mError: ${msg}\x1B[0m
`);
  process.exit(1);
}
