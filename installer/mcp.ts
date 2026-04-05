import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { c } from "./colors.js";

interface McpServerDef {
  name: string;
  prereqPath?: string;
  addArgs: string[];
}

const MCP_SERVERS: McpServerDef[] = [
  {
    name: "kubernetes",
    prereqPath: path.join(os.homedir(), ".kube", "config"),
    addArgs: [
      "-s", "user",
      "-t", "stdio",
      "-e", `KUBECONFIG=${path.join(os.homedir(), ".kube", "config")}`,
      "--", "kubernetes", "npx", "mcp-server-kubernetes@3.4.0",
    ],
  },
];

export function installMcpServers(): void {
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
    if (server.prereqPath !== undefined) {
      try {
        fs.statSync(server.prereqPath);
      } catch (err: unknown) {
        if (err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT") {
          console.log(
            c.yellow(
              `Warning: ${server.prereqPath} not found -- ${server.name} MCP will fail until this file is created`
            )
          );
        }
      }
    }

    // Add the server
    try {
      execFileSync("claude", ["mcp", "add", ...server.addArgs], { stdio: "pipe" });
      console.log(c.green(`MCP server '${server.name}' added`));
    } catch {
      console.log(c.red(`Failed to add MCP server '${server.name}'`));
    }
  }
}
