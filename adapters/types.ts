export interface ClaudeBlock {
  tools?: string; // comma-separated: "Read, Write, Edit, Bash, Grep, Glob, Agent"
  level?: number;
  disallowedTools?: string; // comma-separated: "Write, Edit"
  mandatory?: boolean;
  trigger_keywords?: string[];
  invoke_when?: string;
}

export interface OpencodeBlock {
  permission?: string[]; // lowercase tool names
  mode?: string; // "subagent" | "primary" | "all"
  temperature?: number;
  top_p?: number;
  color?: string;
  steps?: number;
}

export interface AgentSource {
  description: string;
  model?: string;
  system_prompt_below?: boolean;
  claude?: ClaudeBlock;
  opencode?: OpencodeBlock;
}
