// adapters/to-claude_test.ts — Tests for the Claude Code adapter.
//
// Verifies that generateClaudeAgent() produces output byte-identical to the
// committed claude/agents/*.md files (excluding the generated header line).

import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { generateClaudeAgent } from "./to-claude.ts";

const REPO_ROOT = join(import.meta.dirname!, "..");
const SRC_DIR = join(REPO_ROOT, "src", "agents");
const OUT_DIR = join(REPO_ROOT, "claude", "agents");

// ---------------------------------------------------------------------------
// Helper: read committed output and strip the generated header line + blank line
// ---------------------------------------------------------------------------
async function readCommittedBody(name: string): Promise<string> {
  const content = await Deno.readTextFile(join(OUT_DIR, `${name}.md`));
  const lines = content.split("\n");
  // Line 0: <!-- Generated ... -->
  // Line 1: blank
  // Line 2 onwards: the rest
  return lines.slice(2).join("\n");
}

// ---------------------------------------------------------------------------
// bitsmith: has name, description, model, level, tools (no disallowed/trigger)
// ---------------------------------------------------------------------------
Deno.test("generateClaudeAgent bitsmith matches committed file", async () => {
  const srcFile = join(SRC_DIR, "bitsmith.md");
  const generated = await generateClaudeAgent(srcFile);

  // Strip header from generated output
  const generatedLines = generated.split("\n");
  const generatedBody = generatedLines.slice(2).join("\n");

  const expected = await readCommittedBody("bitsmith");

  assertEquals(generatedBody, expected);
});

// ---------------------------------------------------------------------------
// riskmancer: has name, description, model, level, disallowedTools, mandatory,
//             trigger_keywords (array), invoke_when — no tools
// ---------------------------------------------------------------------------
Deno.test("generateClaudeAgent riskmancer matches committed file", async () => {
  const srcFile = join(SRC_DIR, "riskmancer.md");
  const generated = await generateClaudeAgent(srcFile);

  const generatedLines = generated.split("\n");
  const generatedBody = generatedLines.slice(2).join("\n");

  const expected = await readCommittedBody("riskmancer");

  assertEquals(generatedBody, expected);
});

// ---------------------------------------------------------------------------
// dry-run: --dry-run prints to stdout without writing files
// ---------------------------------------------------------------------------
Deno.test("--dry-run prints output and does not modify files", async () => {
  // Record the mtime of the bitsmith output file before the run
  const outFile = join(OUT_DIR, "bitsmith.md");
  const statBefore = await Deno.stat(outFile);

  // Run the adapter script with --dry-run
  const cmd = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      join(import.meta.dirname!, "to-claude.ts"),
      "--dry-run",
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const result = await cmd.output();
  assertEquals(result.code, 0, "dry-run should exit 0");

  // stdout should contain agent content for bitsmith
  const stdout = new TextDecoder().decode(result.stdout);
  assertEquals(
    stdout.includes("name: bitsmith"),
    true,
    "stdout should contain bitsmith frontmatter",
  );
  assertEquals(
    stdout.includes("=== Would write:"),
    true,
    "stdout should contain dry-run header",
  );

  // The output file must not have been modified (mtime unchanged)
  const statAfter = await Deno.stat(outFile);
  assertEquals(
    statAfter.mtime?.getTime(),
    statBefore.mtime?.getTime(),
    "dry-run must not modify output files",
  );
});

// ---------------------------------------------------------------------------
// All 11 agents: byte-identity check against committed files
// ---------------------------------------------------------------------------
Deno.test("generateClaudeAgent - all 11 agents match committed files", async () => {
  const srcDir = join(import.meta.dirname!, "..", "src", "agents");
  for await (const entry of Deno.readDir(srcDir)) {
    if (!entry.name.endsWith(".md")) continue;
    const srcPath = join(srcDir, entry.name);
    const agentName = entry.name.replace(/\.md$/, "");
    const committedPath = join(
      import.meta.dirname!,
      "..",
      "claude",
      "agents",
      entry.name,
    );
    const generated = await generateClaudeAgent(srcPath);
    const committed = await Deno.readTextFile(committedPath);
    // Strip the generated header (first two lines) from both sides before comparing
    const generatedBody = generated.split("\n").slice(2).join("\n");
    const committedBody = committed.split("\n").slice(2).join("\n");
    assertEquals(
      generatedBody,
      committedBody,
      `Mismatch for agent: ${agentName}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Idempotency: running generateClaudeAgent twice produces identical output
// ---------------------------------------------------------------------------
Deno.test("generateClaudeAgent is idempotent", async () => {
  const srcFile = join(SRC_DIR, "riskmancer.md");
  const first = await generateClaudeAgent(srcFile);
  const second = await generateClaudeAgent(srcFile);
  assertEquals(first, second);
});
