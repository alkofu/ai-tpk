import { c } from "./colors.js";

export const VALID_TARGET_AGENTS = ["claude"] as const;
export type TargetAgent = (typeof VALID_TARGET_AGENTS)[number];

export interface ParsedArgs {
  targetAgent: TargetAgent;
}

const USAGE = `Usage: ./install.sh [options]

Install AI TPK to your home directory.

Claude Code:
  - Whitelisted paths: settings.json, CLAUDE.md, skills/, agents/, references/
  - MCP servers: kubernetes, cloudwatch (user scope, via claude mcp add)

Options:
  --target-agent <name>   Target agent to install for (default: claude). Valid values: claude
  --help, -h              Show this help message`;

export function parseArgs(argv: string[]): ParsedArgs {
  let targetAgent: TargetAgent = "claude";

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    switch (flag) {
      case "--help":
      case "-h":
        console.log(USAGE);
        process.exit(0);
        break;
      case "--target-agent": {
        const value = argv[i + 1];
        if (value === undefined || value.startsWith("--")) {
          process.stderr.write(
            `${c.red("Error: --target-agent requires a value")}\n`,
          );
          process.stderr.write(
            "Run './install.sh --help' for usage information.\n",
          );
          process.exit(1);
        }
        if (!(VALID_TARGET_AGENTS as readonly string[]).includes(value)) {
          process.stderr.write(
            `${c.red(`Error: Invalid --target-agent value '${value}'. Valid values: ${VALID_TARGET_AGENTS.join(", ")}`)}\n`,
          );
          process.stderr.write(
            "Run './install.sh --help' for usage information.\n",
          );
          process.exit(1);
        }
        targetAgent = value as TargetAgent;
        i++;
        break;
      }
      default:
        process.stderr.write(`${c.red(`Error: Unknown option ${flag}`)}\n`);
        process.stderr.write(
          "Run './install.sh --help' for usage information.\n",
        );
        process.exit(1);
    }
  }

  return { targetAgent };
}
