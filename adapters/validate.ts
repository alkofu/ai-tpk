#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run=git
// adapters/validate.ts — Verify that adapter output matches committed generated files.
//
// Imports adapter logic directly (no subprocess) to regenerate all output,
// writes it in place, then uses `git diff --exit-code` to detect drift.
//
// Usage:
//   ./adapters/validate.ts

import { join } from "@std/path";
import { agentNameFromFile } from "./lib/parse.ts";
import { generateClaudeAgent } from "./to-claude.ts";
import { generateAgentOutput, generateAgentsMd } from "./to-opencode.ts";

const SCRIPT_DIR = import.meta.dirname!;
const REPO_ROOT = join(SCRIPT_DIR, "..");

export async function validate(): Promise<void> {
  const srcDir = join(REPO_ROOT, "src", "agents");
  const claudeOutDir = join(REPO_ROOT, "claude", "agents");
  const opencodeOutDir = join(REPO_ROOT, "opencode", "agents");
  const agentsMdPath = join(REPO_ROOT, "opencode", "AGENTS.md");

  // ---------------------------------------------------------------------------
  // Collect source agent files
  // ---------------------------------------------------------------------------
  const srcFiles: string[] = [];
  for await (const entry of Deno.readDir(srcDir)) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      srcFiles.push(join(srcDir, entry.name));
    }
  }
  srcFiles.sort();

  if (srcFiles.length === 0) {
    console.error(`ERROR: No source agent files found in ${srcDir}`);
    Deno.exit(1);
  }

  // ---------------------------------------------------------------------------
  // Ensure output directories exist
  // ---------------------------------------------------------------------------
  await Deno.mkdir(claudeOutDir, { recursive: true });
  await Deno.mkdir(opencodeOutDir, { recursive: true });

  // ---------------------------------------------------------------------------
  // Regenerate Claude Code agent files
  // ---------------------------------------------------------------------------
  for (const srcFile of srcFiles) {
    const name = agentNameFromFile(srcFile);
    const outFile = join(claudeOutDir, `${name}.md`);
    const content = await generateClaudeAgent(srcFile);
    await Deno.writeTextFile(outFile, content);
  }

  // ---------------------------------------------------------------------------
  // Regenerate OpenCode agent files and AGENTS.md
  // ---------------------------------------------------------------------------
  for (const srcFile of srcFiles) {
    const name = agentNameFromFile(srcFile);
    const outFile = join(opencodeOutDir, `${name}.md`);
    const content = await generateAgentOutput(srcFile);
    await Deno.writeTextFile(outFile, content);
  }

  const agentsMdContent = await generateAgentsMd(srcDir);
  await Deno.writeTextFile(agentsMdPath, agentsMdContent);

  // ---------------------------------------------------------------------------
  // Verify every src/agents/*.md has a corresponding output file — warn on missing
  // ---------------------------------------------------------------------------
  for (const srcFile of srcFiles) {
    const name = agentNameFromFile(srcFile);
    const claudeFile = join(claudeOutDir, `${name}.md`);
    const opencodeFile = join(opencodeOutDir, `${name}.md`);

    try {
      await Deno.stat(claudeFile);
    } catch {
      console.warn(`WARNING: Missing claude/agents/${name}.md`);
    }

    try {
      await Deno.stat(opencodeFile);
    } catch {
      console.warn(`WARNING: Missing opencode/agents/${name}.md`);
    }
  }

  // ---------------------------------------------------------------------------
  // Check for drift using git diff --exit-code
  // ---------------------------------------------------------------------------
  const gitDiff = new Deno.Command("git", {
    args: [
      "-C",
      REPO_ROOT,
      "diff",
      "--exit-code",
      "claude/agents/",
      "opencode/agents/",
      "opencode/AGENTS.md",
    ],
    stdout: "piped",
    stderr: "piped",
  });

  const result = await gitDiff.output();

  if (result.code === 0) {
    console.log("✓ All generated files are up to date");
    Deno.exit(0);
  } else {
    console.error(
      "✗ Generated files are out of sync with source. Run adapters and commit.",
    );
    const diffOutput = new TextDecoder().decode(result.stdout);
    if (diffOutput) {
      console.error(diffOutput);
    }
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await validate();
}
