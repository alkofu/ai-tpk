import { multiselect } from "@clack/prompts";
import { registry } from "./mcp-command.js";
import { handleCancel } from "./cancel.js";

export async function selectMcps(
  previousSelections: string[],
): Promise<string[]> {
  const value = await multiselect({
    message: "Select MCPs to configure for this session:",
    options: registry.map((c) => c.multiselectOption),
    initialValues: previousSelections,
    required: false,
  });
  handleCancel(value);
  return value as string[];
}
