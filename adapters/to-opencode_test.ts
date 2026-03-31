// adapters/to-opencode_test.ts — Tests for the OpenCode adapter.
//
// Verifies that generateAgentOutput() and generateAgentsMd() produce output
// byte-identical to the committed opencode/ files, and that all assertions
// from the original test-to-opencode.sh are covered as Deno.test cases.

import { assertEquals, assertMatch, assertNotMatch } from "@std/assert";
import { join } from "@std/path";
import {
  generateAgentOutput,
  generateAgentsMd,
  hasOpencodeBlock,
  toolUsesDelegation,
} from "./to-opencode.ts";
import { extractFrontmatter } from "./lib/parse.ts";

const REPO_ROOT = join(import.meta.dirname!, "..");
const SRC_DIR = join(REPO_ROOT, "src", "agents");
const OUT_DIR = join(REPO_ROOT, "opencode", "agents");
const AGENTS_MD_PATH = join(REPO_ROOT, "opencode", "AGENTS.md");

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
// bitsmith: has opencode block, uses Agent tool (delegation NOTE expected)
// ---------------------------------------------------------------------------
Deno.test("generateAgentOutput bitsmith matches committed file", async () => {
  const srcFile = join(SRC_DIR, "bitsmith.md");
  const generated = await generateAgentOutput(srcFile);

  // Strip header from generated output
  const generatedLines = generated.split("\n");
  const generatedBody = generatedLines.slice(2).join("\n");

  const expected = await readCommittedBody("bitsmith");

  assertEquals(generatedBody, expected);
});

// ---------------------------------------------------------------------------
// riskmancer: has opencode block (permission from opencode block, not claude block)
// ---------------------------------------------------------------------------
Deno.test("generateAgentOutput riskmancer matches committed file", async () => {
  const srcFile = join(SRC_DIR, "riskmancer.md");
  const generated = await generateAgentOutput(srcFile);

  const generatedLines = generated.split("\n");
  const generatedBody = generatedLines.slice(2).join("\n");

  const expected = await readCommittedBody("riskmancer");

  assertEquals(generatedBody, expected);
});

// ---------------------------------------------------------------------------
// dungeonmaster: uses Task tool → must contain Agent/Task delegation NOTE
// ---------------------------------------------------------------------------
Deno.test("generateAgentOutput dungeonmaster contains delegation NOTE", async () => {
  const srcFile = join(SRC_DIR, "dungeonmaster.md");
  const generated = await generateAgentOutput(srcFile);

  assertMatch(
    generated,
    /<!-- NOTE: This agent relies on Agent\/Task tool delegation/,
    "dungeonmaster output must contain Agent/Task delegation NOTE",
  );
});

// ---------------------------------------------------------------------------
// dungeonmaster: matches committed file byte-for-byte (minus header)
// ---------------------------------------------------------------------------
Deno.test("generateAgentOutput dungeonmaster matches committed file", async () => {
  const srcFile = join(SRC_DIR, "dungeonmaster.md");
  const generated = await generateAgentOutput(srcFile);

  const generatedLines = generated.split("\n");
  const generatedBody = generatedLines.slice(2).join("\n");

  const expected = await readCommittedBody("dungeonmaster");

  assertEquals(generatedBody, expected);
});

// ---------------------------------------------------------------------------
// No forbidden keys (name, share, provider, tools) in any output file
// ---------------------------------------------------------------------------
Deno.test("no forbidden keys in bitsmith output", async () => {
  const srcFile = join(SRC_DIR, "bitsmith.md");
  const generated = await generateAgentOutput(srcFile);

  assertNotMatch(generated, /^name:/m, "must not contain 'name:' key");
  assertNotMatch(generated, /^share:/m, "must not contain 'share:' key");
  assertNotMatch(generated, /^provider:/m, "must not contain 'provider:' key");
  assertNotMatch(generated, /^tools:/m, "must not contain 'tools:' key");
});

Deno.test("no forbidden keys in riskmancer output", async () => {
  const srcFile = join(SRC_DIR, "riskmancer.md");
  const generated = await generateAgentOutput(srcFile);

  assertNotMatch(generated, /^name:/m, "must not contain 'name:' key");
  assertNotMatch(generated, /^share:/m, "must not contain 'share:' key");
  assertNotMatch(generated, /^provider:/m, "must not contain 'provider:' key");
  assertNotMatch(generated, /^tools:/m, "must not contain 'tools:' key");
});

// ---------------------------------------------------------------------------
// No Claude-only keys (disallowedTools, trigger_keywords, level) in output
// ---------------------------------------------------------------------------
Deno.test("no claude-only keys in riskmancer output", async () => {
  const srcFile = join(SRC_DIR, "riskmancer.md");
  const generated = await generateAgentOutput(srcFile);

  assertNotMatch(
    generated,
    /^disallowedTools:/m,
    "must not contain 'disallowedTools:' key",
  );
  assertNotMatch(
    generated,
    /^trigger_keywords:/m,
    "must not contain 'trigger_keywords:' key",
  );
  assertNotMatch(generated, /^level:/m, "must not contain 'level:' key");
});

// ---------------------------------------------------------------------------
// permission is a YAML array (lines with '  - ' items)
// ---------------------------------------------------------------------------
Deno.test("permission is YAML array in bitsmith output", async () => {
  const srcFile = join(SRC_DIR, "bitsmith.md");
  const generated = await generateAgentOutput(srcFile);

  assertMatch(generated, /^permission:$/m, "must contain 'permission:' key");
  assertMatch(
    generated,
    /^ {2}- \w+/m,
    "permission must have YAML array items",
  );
});

Deno.test("permission is YAML array in riskmancer output", async () => {
  const srcFile = join(SRC_DIR, "riskmancer.md");
  const generated = await generateAgentOutput(srcFile);

  assertMatch(generated, /^permission:$/m, "must contain 'permission:' key");
  assertMatch(
    generated,
    /^ {2}- \w+/m,
    "permission must have YAML array items",
  );
});

// ---------------------------------------------------------------------------
// model uses anthropic/ prefix
// ---------------------------------------------------------------------------
Deno.test("model has anthropic/ prefix in bitsmith output", async () => {
  const srcFile = join(SRC_DIR, "bitsmith.md");
  const generated = await generateAgentOutput(srcFile);

  assertMatch(
    generated,
    /^model: anthropic\//m,
    "model must use anthropic/ prefix",
  );
});

Deno.test("model has anthropic/ prefix in riskmancer output (claude-opus)", async () => {
  const srcFile = join(SRC_DIR, "riskmancer.md");
  const generated = await generateAgentOutput(srcFile);

  assertMatch(
    generated,
    /^model: anthropic\/claude-opus/m,
    "riskmancer model must use anthropic/claude-opus prefix",
  );
});

// ---------------------------------------------------------------------------
// 'agent' must NOT appear in permission array (no OpenCode equivalent)
// ---------------------------------------------------------------------------
Deno.test("'agent' does not appear in permission array in bitsmith output", async () => {
  const srcFile = join(SRC_DIR, "bitsmith.md");
  const generated = await generateAgentOutput(srcFile);

  assertNotMatch(
    generated,
    /^ {2}- agent$/m,
    "permission must not contain 'agent' tool",
  );
});

// ---------------------------------------------------------------------------
// mode: subagent present in output
// ---------------------------------------------------------------------------
Deno.test("mode: subagent present in bitsmith output", async () => {
  const srcFile = join(SRC_DIR, "bitsmith.md");
  const generated = await generateAgentOutput(srcFile);

  assertMatch(generated, /^mode: subagent$/m, "must contain 'mode: subagent'");
});

// ---------------------------------------------------------------------------
// description present in output
// ---------------------------------------------------------------------------
Deno.test("description present in bitsmith output", async () => {
  const srcFile = join(SRC_DIR, "bitsmith.md");
  const generated = await generateAgentOutput(srcFile);

  assertMatch(generated, /^description: /m, "must contain 'description:' key");
});

// ---------------------------------------------------------------------------
// riskmancer: disallowedTools (Write, Edit) excluded from permission
// ---------------------------------------------------------------------------
Deno.test("riskmancer excludes write and edit from permission (disallowedTools)", async () => {
  const srcFile = join(SRC_DIR, "riskmancer.md");
  const generated = await generateAgentOutput(srcFile);

  // riskmancer's opencode block explicitly lists read, bash, grep, glob
  // (write/edit are in disallowedTools but the opencode block overrides anyway)
  assertNotMatch(
    generated,
    /^ {2}- write$/m,
    "permission must not contain 'write'",
  );
  assertNotMatch(
    generated,
    /^ {2}- edit$/m,
    "permission must not contain 'edit'",
  );
});

// ---------------------------------------------------------------------------
// generated header present in output
// ---------------------------------------------------------------------------
Deno.test("generated header present in bitsmith output", async () => {
  const srcFile = join(SRC_DIR, "bitsmith.md");
  const generated = await generateAgentOutput(srcFile);

  assertMatch(
    generated,
    /<!-- Generated by ai-tpk adapters\. Do not edit directly\. -->/,
    "must contain generated header comment",
  );
});

// ---------------------------------------------------------------------------
// hasOpencodeBlock utility
// ---------------------------------------------------------------------------
Deno.test("hasOpencodeBlock returns true for bitsmith", async () => {
  const srcFile = join(SRC_DIR, "bitsmith.md");
  const frontmatter = await extractFrontmatter(srcFile);
  assertEquals(hasOpencodeBlock(frontmatter), true);
});

// ---------------------------------------------------------------------------
// toolUsesDelegation utility
// ---------------------------------------------------------------------------
Deno.test("toolUsesDelegation returns true for bitsmith (uses Agent)", async () => {
  const srcFile = join(SRC_DIR, "bitsmith.md");
  const frontmatter = await extractFrontmatter(srcFile);
  assertEquals(toolUsesDelegation(frontmatter), true);
});

Deno.test("toolUsesDelegation returns true for dungeonmaster (uses Task)", async () => {
  const srcFile = join(SRC_DIR, "dungeonmaster.md");
  const frontmatter = await extractFrontmatter(srcFile);
  assertEquals(toolUsesDelegation(frontmatter), true);
});

Deno.test("toolUsesDelegation returns false for riskmancer (no Agent/Task)", async () => {
  const srcFile = join(SRC_DIR, "riskmancer.md");
  const frontmatter = await extractFrontmatter(srcFile);
  assertEquals(toolUsesDelegation(frontmatter), false);
});

// ---------------------------------------------------------------------------
// generateAgentsMd: AGENTS.md generated and lists all 11 agents
// ---------------------------------------------------------------------------
Deno.test("generateAgentsMd lists all 11 agents", async () => {
  const content = await generateAgentsMd(SRC_DIR);

  const expectedAgents = [
    "bitsmith",
    "dungeonmaster",
    "everwise",
    "knotcutter",
    "pathfinder",
    "quill",
    "riskmancer",
    "ruinor",
    "talekeeper",
    "truthhammer",
    "windwarden",
  ];

  for (const name of expectedAgents) {
    assertMatch(
      content,
      new RegExp(`\\*\\*${name}\\*\\*`),
      `AGENTS.md must list agent: ${name}`,
    );
  }
});

Deno.test("generateAgentsMd has generated header", async () => {
  const content = await generateAgentsMd(SRC_DIR);

  assertMatch(
    content,
    /<!-- Generated by ai-tpk adapters\. Do not edit directly\. -->/,
    "AGENTS.md must contain generated header",
  );
});

Deno.test("generateAgentsMd matches committed AGENTS.md", async () => {
  const generated = await generateAgentsMd(SRC_DIR);
  const committed = await Deno.readTextFile(AGENTS_MD_PATH);

  assertEquals(generated, committed);
});

// ---------------------------------------------------------------------------
// Idempotency: running generateAgentOutput twice produces identical output
// ---------------------------------------------------------------------------
Deno.test("generateAgentOutput is idempotent for bitsmith", async () => {
  const srcFile = join(SRC_DIR, "bitsmith.md");
  const first = await generateAgentOutput(srcFile);
  const second = await generateAgentOutput(srcFile);
  assertEquals(first, second);
});

Deno.test("generateAgentOutput is idempotent for riskmancer", async () => {
  const srcFile = join(SRC_DIR, "riskmancer.md");
  const first = await generateAgentOutput(srcFile);
  const second = await generateAgentOutput(srcFile);
  assertEquals(first, second);
});

// ---------------------------------------------------------------------------
// --dry-run: does not write files
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
      join(import.meta.dirname!, "to-opencode.ts"),
      "--dry-run",
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const result = await cmd.output();
  assertEquals(result.code, 0, "dry-run should exit 0");

  // stdout should contain agent content for bitsmith
  const stdout = new TextDecoder().decode(result.stdout);
  assertMatch(
    stdout,
    /=== Would write:/,
    "stdout should contain dry-run header",
  );
  assertMatch(
    stdout,
    /description: "/,
    "stdout should contain bitsmith frontmatter",
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
// All 11 generated opencode/agents/*.md files are byte-identical to committed
// ---------------------------------------------------------------------------
const allAgents = [
  "bitsmith",
  "dungeonmaster",
  "everwise",
  "knotcutter",
  "pathfinder",
  "quill",
  "riskmancer",
  "ruinor",
  "talekeeper",
  "truthhammer",
  "windwarden",
];

for (const name of allAgents) {
  Deno.test(
    `generateAgentOutput ${name} matches committed opencode/agents/${name}.md`,
    async () => {
      const srcFile = join(SRC_DIR, `${name}.md`);
      const generated = await generateAgentOutput(srcFile);

      const generatedLines = generated.split("\n");
      const generatedBody = generatedLines.slice(2).join("\n");

      const expected = await readCommittedBody(name);

      assertEquals(
        generatedBody,
        expected,
        `${name}: generated output must be byte-identical to committed file`,
      );
    },
  );
}
