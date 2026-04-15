import { multiselect, isCancel, cancel } from "@clack/prompts";

export function handleCancel(
  value: unknown,
): asserts value is NonNullable<unknown> {
  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }
}

export async function selectMcps(
  previousSelections: string[],
): Promise<string[]> {
  const value = await multiselect({
    message: "Select MCPs to configure for this session:",
    options: [
      { value: "grafana", label: "Grafana", hint: "cluster + role" },
      { value: "cloudwatch", label: "CloudWatch", hint: "AWS profile" },
      {
        value: "gcp-observability",
        label: "GCP Observability",
        hint: "GCP project",
      },
      { value: "kubernetes", label: "Kubernetes", hint: "cluster context" },
    ],
    initialValues: previousSelections,
    required: false,
  });
  handleCancel(value);
  return value as string[];
}
