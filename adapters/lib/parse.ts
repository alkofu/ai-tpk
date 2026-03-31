// adapters/lib/parse.ts — Shared YAML parsing utilities for ai-tpk adapter scripts.
//
// Parses YAML frontmatter from source agent .md files and provides typed
// accessor functions used by the Claude Code and OpenCode adapter scripts.

import { parse as parseYaml } from "@std/yaml";
import { basename } from "@std/path";
import type { AgentSource, ClaudeBlock, OpencodeBlock } from "../types.ts";

export type { AgentSource, ClaudeBlock, OpencodeBlock };

/**
 * Read a .md file and extract the YAML frontmatter between the first and
 * second `---` delimiter lines. Returns a parsed AgentSource.
 *
 * Throws if the file does not contain valid frontmatter.
 */
export async function extractFrontmatter(
  filePath: string,
): Promise<AgentSource> {
  const content = await Deno.readTextFile(filePath);
  const lines = content.split("\n");

  let start = -1;
  let end = -1;
  let delimCount = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === "---") {
      delimCount++;
      if (delimCount === 1) {
        start = i;
      } else if (delimCount === 2) {
        end = i;
        break;
      }
    }
  }

  if (start === -1 || end === -1) {
    throw new Error(
      `File does not contain valid YAML frontmatter delimiters: ${filePath}`,
    );
  }

  const yamlContent = lines.slice(start + 1, end).join("\n");
  const parsed = parseYaml(yamlContent);

  if (parsed === null || typeof parsed !== "object") {
    throw new Error(`Failed to parse YAML frontmatter in: ${filePath}`);
  }

  return validateAgentSource(parsed, filePath);
}

/**
 * Runtime validation of a parsed YAML object against the AgentSource shape.
 * Throws with a descriptive message including the filePath if validation fails.
 */
function validateAgentSource(parsed: unknown, filePath: string): AgentSource {
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`${filePath}: frontmatter is not a valid YAML object`);
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj["description"] !== "string" || !obj["description"]) {
    throw new Error(
      `${filePath}: missing or empty required field 'description'`,
    );
  }
  if (obj["model"] !== undefined && typeof obj["model"] !== "string") {
    throw new Error(
      `${filePath}: field 'model' must be a string, got ${typeof obj["model"]}`,
    );
  }
  return parsed as AgentSource;
}

/**
 * Read a .md file and return everything after the closing `---` of the
 * frontmatter (the system prompt body). The body includes its leading newline.
 * Handles files where the body itself contains `---` lines.
 */
export async function getBody(filePath: string): Promise<string> {
  const content = await Deno.readTextFile(filePath);
  const lines = content.split("\n");

  let delimCount = 0;
  let bodyStart = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === "---") {
      delimCount++;
      if (delimCount === 2) {
        bodyStart = i + 1;
        break;
      }
    }
  }

  if (bodyStart === -1) {
    throw new Error(
      `File does not contain valid YAML frontmatter delimiters: ${filePath}`,
    );
  }

  return lines.slice(bodyStart).join("\n");
}

/**
 * Return a top-level field from the parsed frontmatter.
 */
export function getField<K extends keyof AgentSource>(
  frontmatter: AgentSource,
  key: K,
): AgentSource[K] {
  return frontmatter[key];
}

/**
 * Return a field from a harness-specific block (claude or opencode).
 * Returns undefined if the block or field is absent.
 */
export function getNamespacedField<
  B extends ClaudeBlock | OpencodeBlock,
  K extends keyof B,
>(
  frontmatter: AgentSource,
  namespace: "claude" | "opencode",
  key: K,
): B[K] | undefined {
  const block = frontmatter[namespace] as B | undefined;
  if (block === undefined) {
    return undefined;
  }
  return block[key];
}

/**
 * Read a nested array field using dot-path notation (e.g., 'opencode.permission',
 * 'claude.trigger_keywords'). Returns [] if the field is absent or not an array.
 * The dotPath is always <namespace>.<key>.
 */
export function getArray(frontmatter: AgentSource, dotPath: string): string[] {
  const dotIndex = dotPath.indexOf(".");
  if (dotIndex === -1) {
    return [];
  }

  const namespace = dotPath.slice(0, dotIndex) as "claude" | "opencode";
  const key = dotPath.slice(dotIndex + 1);

  const block = frontmatter[namespace] as Record<string, unknown> | undefined;
  if (block === undefined) {
    return [];
  }

  const value = block[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value as string[];
}

/**
 * Prepend `anthropic/` if not already prefixed.
 * Returns '' if model is undefined or empty.
 */
export function mapModelOpencode(model: string | undefined): string {
  if (!model) {
    return "";
  }
  if (model.startsWith("anthropic/")) {
    return model;
  }
  return `anthropic/${model}`;
}

/**
 * Return the basename without `.md` extension.
 */
export function agentNameFromFile(filePath: string): string {
  const base = basename(filePath);
  return base.endsWith(".md") ? base.slice(0, -3) : base;
}
