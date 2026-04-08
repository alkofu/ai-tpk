import { c } from "./colors.js";

const USAGE = `Usage: ./install.sh

Install AI TPK to your home directory.

Claude Code:
  - Whitelisted paths: settings.json, CLAUDE.md, skills/, agents/, references/
  - MCP servers: kubernetes, cloudwatch (user scope, via claude mcp add)

Options:
  --help    Show this help message`;

export function parseArgs(argv: string[]): void {
  for (const flag of argv) {
    switch (flag) {
      case "--help":
      case "-h":
        console.log(USAGE);
        process.exit(0);
        break;
      default:
        process.stderr.write(`${c.red(`Error: Unknown option ${flag}`)}\n`);
        process.stderr.write(
          "Run './install.sh --help' for usage information.\n",
        );
        process.exit(1);
    }
  }
}
