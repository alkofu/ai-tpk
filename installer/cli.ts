import { c } from "./colors.js";

const USAGE = `Usage: ./install.sh [--copy]

Install AI TPK to your home directory.

Claude Code:
  - Whitelisted paths: settings.json, CLAUDE.md, skills/, agents/, references/
  - MCP servers: kubernetes, cloudwatch (user scope, via claude mcp add)

Options:
  --copy    Copy files instead of creating symlinks (default: symlink)
  --help    Show this help message

Installation methods:
  symlink (default): Creates symbolic links. Changes sync automatically.
  copy:              Copies files. Manual sync required with git pull.`;

export function parseArgs(argv: string[]): { mode: "symlink" | "copy" } {
  let mode: "symlink" | "copy" = "symlink";

  for (const flag of argv) {
    switch (flag) {
      case "--copy":
        mode = "copy";
        break;
      case "--help":
      case "-h":
        console.log(USAGE);
        process.exit(0);
        break;
      default:
        process.stderr.write(`${c.red(`Error: Unknown option ${flag}`)}\n`);
        process.stderr.write("Run './install.sh --help' for usage information.\n");
        process.exit(1);
    }
  }

  return { mode };
}
