import * as path from "node:path";

/** Sub-directories of claude/ installed into ~/.claude */
export const CLAUDE_WHITELIST_DIRS: readonly string[] = ["skills", "agents", "hooks", "commands", "references"];

/** Standalone files of claude/ installed into ~/.claude */
export const CLAUDE_WHITELIST_FILES: readonly string[] = ["settings.json", "CLAUDE.md"];

/** Minimum Node.js version required by install.sh (major.minor) */
export const NODE_MIN_VERSION = "18.18.0";

/** MCP server definition shape */
export interface McpServerDef {
  name: string;
  prereqRelPath?: string; // relative to destRoot (e.g. ".kube/config")
  addArgs: (destRoot: string) => string[];
}

/** Registered MCP servers */
export const MCP_SERVERS: readonly McpServerDef[] = [
  {
    name: "kubernetes",
    prereqRelPath: ".kube/config",
    addArgs: (destRoot) => [
      "-s", "user",
      "-t", "stdio",
      "-e", `KUBECONFIG=${path.join(destRoot, ".kube", "config")}`,
      "--", "kubernetes", "npx", "mcp-server-kubernetes@3.4.0",
    ],
  },
];
