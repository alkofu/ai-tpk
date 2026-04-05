import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { c } from "./colors.js";
import { MCP_SERVERS, type McpServerDef } from "./constants.js";

export function installMcpServers(destRoot: string = os.homedir()): void {
  // Check claude CLI availability
  try {
    execFileSync("claude", ["--version"], { stdio: "pipe" });
  } catch {
    console.log(c.yellow("Skipping MCP server setup (claude CLI not found)"));
    return;
  }

  console.log(c.blue("Configuring MCP servers (user scope)..."));

  for (const server of MCP_SERVERS) {
    // Check if already configured
    try {
      execFileSync("claude", ["mcp", "get", server.name], { stdio: "pipe" });
      console.log(c.green(`MCP server '${server.name}' already configured, skipping`));
      continue;
    } catch {
      // Not yet configured — proceed
    }

    // Check prereq
    if (server.prereqRelPath !== undefined) {
      try {
        fs.statSync(path.join(destRoot, server.prereqRelPath));
      } catch (err: unknown) {
        if (err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT") {
          console.log(
            c.yellow(
              `Warning: ${path.join(destRoot, server.prereqRelPath)} not found -- ${server.name} MCP will fail until this file is created`
            )
          );
        }
      }
    }

    // Add the server
    try {
      execFileSync("claude", ["mcp", "add", ...server.addArgs(destRoot)], { stdio: "pipe" });
      console.log(c.green(`MCP server '${server.name}' added`));
    } catch {
      console.log(c.red(`Failed to add MCP server '${server.name}'`));
    }
  }
}
