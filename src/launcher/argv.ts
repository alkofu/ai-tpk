// Parses the argv array passed to the tpk launcher.
//
// Rules:
//   - The literal token `--skip` sets the skip flag (idempotent; duplicates are tolerated).
//   - Any other token that starts with `-` (one or two dashes — covers `--unknown`, `-x`, `-h`,
//     the bare `-`, etc.) throws UnknownFlagError.
//   - Any token that does NOT start with `-` is captured as the positional initial message
//     (first occurrence only).
//   - A second non-flag token throws TooManyPositionalsError.
//
// The no-`--skip` rejection (initial message present but skip is false) is NOT enforced here.
// The parser is purely lexical; that semantic check is main.ts's responsibility.

export class UnknownFlagError extends Error {
  constructor(flag: string) {
    super(`Unknown flag: ${flag}. Usage: tpk [--skip] [<initial-message>]`);
    this.name = 'UnknownFlagError';
  }
}

export class TooManyPositionalsError extends Error {
  constructor() {
    super(
      'Too many positional arguments. Only one initial message is allowed. Usage: tpk [--skip] [<initial-message>]',
    );
    this.name = 'TooManyPositionalsError';
  }
}

/**
 * Parse the arguments passed to the tpk launcher.
 *
 * @param argv - the array to parse (pass `process.argv.slice(2)`; never the full argv)
 * @returns `{ skip, initialMessage }` where `skip` is true when `--skip` is present and
 *   `initialMessage` is the single optional positional arg (or `undefined` if not supplied)
 * @throws {UnknownFlagError} for any token starting with `-` other than `--skip`
 *   (covers single-dash flags like `-h`, the bare `-`, and double-dash flags like `--unknown`)
 * @throws {TooManyPositionalsError} when more than one positional (non-flag) token is supplied
 */
export function parseArgs(argv: string[]): {
  skip: boolean;
  initialMessage: string | undefined;
} {
  let skip = false;
  let initialMessage: string | undefined = undefined;
  for (const token of argv) {
    if (token === '--skip') {
      skip = true;
    } else if (token.startsWith('-')) {
      throw new UnknownFlagError(token);
    } else if (initialMessage !== undefined) {
      throw new TooManyPositionalsError();
    } else {
      initialMessage = token;
    }
  }
  return { skip, initialMessage };
}
