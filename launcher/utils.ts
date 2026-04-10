import { isCancel, cancel } from "@clack/prompts";

export function handleCancel(
  value: unknown,
): asserts value is NonNullable<unknown> {
  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }
}
