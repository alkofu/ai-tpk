import { multiselect } from "@clack/prompts";
import { handleCancel } from "./utils.js";

export async function selectMcps(
  previousSelections: string[],
): Promise<string[]> {
  const value = await multiselect({
    message: "Select MCPs to configure for this session:",
    options: [
      { value: "grafana", label: "Grafana", hint: "cluster + role" },
      { value: "cloudwatch", label: "CloudWatch", hint: "AWS profile" },
    ],
    initialValues: previousSelections,
    required: false,
  });
  handleCancel(value);
  return value as string[];
}
