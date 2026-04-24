// Duplicates are tolerated — the flag is idempotent and treating --skip --skip as a usage error would surprise users.

export class UnknownFlagError extends Error {
  constructor(flag: string) {
    super(`Unknown flag: ${flag}. Usage: myclaude [--skip]`);
    this.name = "UnknownFlagError";
  }
}

/**
 * Parse the arguments passed to the myclaude launcher.
 *
 * @param argv - the array to parse (pass `process.argv.slice(2)`; never the full argv)
 * @returns `{ skip: true }` when `--skip` is present, `{ skip: false }` otherwise
 * @throws {UnknownFlagError} for any token that is not `--skip`
 */
export function parseArgs(argv: string[]): { skip: boolean } {
  let skip = false;
  for (const token of argv) {
    if (token === "--skip") {
      skip = true;
    } else {
      throw new UnknownFlagError(token);
    }
  }
  return { skip };
}
