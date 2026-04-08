import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { c } from "./colors.js";

interface McpServerConfig {
  name: string;
  scope: "user" | "project";
  transport: "stdio" | "sse" | "streamable-http";
  prereq?: string;
  env?: Record<string, string>;
  command?: string;
  args?: string[];
  wrapper?: string;
}

interface McpServersFile {
  servers: McpServerConfig[];
}

/**
 * Expands $HOME and ${HOME} and $USER and ${USER} in a string value using
 * os.homedir() and os.userInfo().username respectively. No eval or shell
 * is used.
 */
export function expandVars(value: string): string {
  const home = os.homedir();
  const user = os.userInfo().username;
  return value
    .replace(/\$\{HOME\}|\$HOME(?!\w)/g, home)
    .replace(/\$\{USER\}|\$USER(?!\w)/g, user);
}

/**
 * Reads and validates mcp-servers.json from the given repo root directory.
 * - Returns [] if the file does not exist (graceful degradation).
 * - Throws on malformed JSON or schema violations.
 */
export function loadMcpServers(repoRoot: string): McpServerConfig[] {
  const filePath = path.join(repoRoot, "mcp-servers.json");

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      console.log(
        c.yellow(
          "Warning: mcp-servers.json not found -- skipping MCP server setup",
        ),
      );
      return [];
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`mcp-servers.json: invalid JSON in ${filePath}`);
  }

  if (typeof parsed !== "object" || parsed === null || !("servers" in parsed)) {
    throw new Error("mcp-servers.json: missing top-level 'servers' field");
  }

  const { servers } = parsed as McpServersFile;

  if (!Array.isArray(servers)) {
    throw new Error("mcp-servers.json: 'servers' must be an array");
  }

  const validScopes = ["user", "project"] as const;
  const validTransports = ["stdio", "sse", "streamable-http"] as const;

  for (const entry of servers as unknown[]) {
    if (typeof entry !== "object" || entry === null) {
      throw new Error("mcp-servers.json: each server entry must be an object");
    }
    const server = entry as Record<string, unknown>;

    if (typeof server["name"] !== "string" || server["name"].trim() === "") {
      throw new Error(
        "mcp-servers.json: server entry missing required non-empty 'name' field",
      );
    }
    const name = server["name"] as string;

    if (
      !validScopes.includes(server["scope"] as (typeof validScopes)[number])
    ) {
      throw new Error(
        `mcp-servers.json: server '${name}' has invalid scope '${String(server["scope"])}' -- must be 'user' or 'project'`,
      );
    }

    if (
      !validTransports.includes(
        server["transport"] as (typeof validTransports)[number],
      )
    ) {
      throw new Error(
        `mcp-servers.json: server '${name}' has invalid transport '${String(server["transport"])}' -- must be 'stdio', 'sse', or 'streamable-http'`,
      );
    }

    const hasWrapper =
      typeof server["wrapper"] === "string" &&
      (server["wrapper"] as string).trim() !== "";
    const hasCommand =
      typeof server["command"] === "string" &&
      (server["command"] as string).trim() !== "";

    if (hasWrapper && hasCommand) {
      throw new Error(
        `mcp-servers.json: server '${name}' must not have both 'wrapper' and 'command' fields`,
      );
    }

    if (!hasWrapper && !hasCommand) {
      throw new Error(
        `mcp-servers.json: server '${name}' must have either 'wrapper' or 'command' field`,
      );
    }
  }

  return servers as McpServerConfig[];
}

/**
 * Constructs the argument array for `claude mcp add` from a structured server
 * config. Variable expansion is applied to env values and args entries.
 *
 * For wrapper-based servers, the wrapper script path is resolved to an absolute
 * path and validated to exist on disk. No `-e` flags are emitted.
 */
export function buildAddArgs(
  server: McpServerConfig,
  repoRoot: string,
  homedir: string = os.homedir(),
): string[] {
  if (server.wrapper !== undefined) {
    const absoluteWrapperPath =
      server.scope === "user"
        ? path.join(homedir, ".claude", server.wrapper)
        : path.join(repoRoot, server.wrapper);
    try {
      fs.statSync(absoluteWrapperPath);
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        throw new Error(
          `Wrapper script not found: ${absoluteWrapperPath} (defined in server '${server.name}')`,
          { cause: err },
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
      absoluteWrapperPath,
    ];
  }

  const result: string[] = ["-s", server.scope, "-t", server.transport];

  for (const [key, value] of Object.entries(server.env ?? {})) {
    result.push("-e", `${key}=${expandVars(value)}`);
  }

  if (!server.command) {
    // Should not be reachable: loadMcpServers ensures exactly one of wrapper/command is set.
    throw new Error(`Server '${server.name}' has no command or wrapper field`);
  }

  result.push("--", server.name, server.command);

  for (const arg of server.args ?? []) {
    result.push(expandVars(arg));
  }

  return result;
}

export function installMcpServers(repoRoot: string): void {
  // Check claude CLI availability
  try {
    execFileSync("claude", ["--version"], { stdio: "pipe" });
  } catch {
    console.log(c.yellow("Skipping MCP server setup (claude CLI not found)"));
    return;
  }

  console.log(c.blue("Configuring MCP servers (user scope)..."));

  for (const server of loadMcpServers(repoRoot)) {
    if (server.wrapper !== undefined) {
      // Wrapper-based servers: always remove and re-add to self-heal any prior
      // broken registration (e.g. from when env vars were passed via -e flags).
      try {
        execFileSync("claude", ["mcp", "remove", server.name], {
          stdio: "pipe",
        });
      } catch {
        // Server was not registered — that is fine, proceed to add
      }
    } else {
      // Command-based servers: skip if already configured
      try {
        execFileSync("claude", ["mcp", "get", server.name], { stdio: "pipe" });
        console.log(
          c.green(`MCP server '${server.name}' already configured, skipping`),
        );
        continue;
      } catch {
        // Not yet configured — proceed
      }
    }

    // Check prereq
    if (server.prereq !== undefined) {
      try {
        fs.statSync(expandVars(server.prereq));
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          (err as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          // prereq check is advisory: warn if missing, but always proceed to add
          console.log(
            c.yellow(
              `Warning: ${expandVars(server.prereq)} not found -- ${server.name} MCP will fail until this file is created`,
            ),
          );
        }
      }
    }

    // Add the server
    try {
      execFileSync(
        "claude",
        ["mcp", "add", ...buildAddArgs(server, repoRoot)],
        {
          stdio: "pipe",
        },
      );
      console.log(c.green(`MCP server '${server.name}' added`));
    } catch {
      console.log(c.red(`Failed to add MCP server '${server.name}'`));
    }
  }
}
