import { isCancel, cancel, log } from "@clack/prompts";

export function handleCancel(
  value: unknown,
): asserts value is NonNullable<unknown> {
  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }
}

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
