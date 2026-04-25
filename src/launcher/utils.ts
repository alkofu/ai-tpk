import { log } from '@clack/prompts';

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Returns T on success or null on failure. When T = void (e.g., functions
// that succeed by not throwing), the return on success is undefined;
// callers distinguish success from failure via !== null.
export function tryLoad<T>(
  fn: () => T,
  label: string,
  warningMessage?: string,
): T | null {
  try {
    return fn();
  } catch (err) {
    if (warningMessage !== undefined) {
      log.warn(warningMessage);
    } else {
      log.warn(`[${label}] ${errorMessage(err)}`);
    }
    return null;
  }
}
