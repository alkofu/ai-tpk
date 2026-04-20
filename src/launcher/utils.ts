import { log } from "@clack/prompts";

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function tryLoad<T>(fn: () => T, label: string): T {
  try {
    return fn();
  } catch (err) {
    log.error(`[${label}] ${errorMessage(err)}`);
    process.exit(1);
  }
}

// Returns T on success or null on failure — avoids void | null by never
// returning void; the caller must treat null as "unavailable".
export function tryLoadOptional<T>(
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
