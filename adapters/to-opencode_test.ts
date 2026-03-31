// adapters/to-opencode_test.ts — Tests for the OpenCode adapter.
//
// Verifies structural correctness of generateAgentOutput() and generateAgentsMd()
// output. No reliance on committed baseline files — tests run on a clean checkout.

import { assert, assertEquals, assertMatch, assertNotMatch } from "@std/assert";
import { exists } from "@std/fs";
import { join } from "@std/path";
import {
  generateAgentOutput,
  generateAgentsMd,
  hasOpencodeBlock,
  toolUsesDelegation,
} from "./to-opencode.ts";
import { generateClaudeAgent } from "./to-claude.ts";
import { extractFrontmatter } from "./lib/parse.ts";

const REPO_ROOT = join(import.meta.dirname!, "..");
const SRC_DIR = join(REPO_ROOT, "src", "agents");

// Keys that must NOT appear in OpenCode frontmatter
const FORBIDDEN_KEYS = [
  "name",
  "share",
  "provider",
  "tools",
  "level",
  "disallowedTools",
  "mandatory",
  "trigger_keywords",
  "invoke_when",
];

// ---------------------------------------------------------------------------
// Helper: extract body after closing --- delimiter, stripping NOTE comments
// ---------------------------------------------------------------------------
function extractBody(content: string): string {
  const lines = content.split("\n");

  // Find the end of the frontmatter (second ---)
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
  if (bodyStart === -1) return "";

  // Strip leading blank lines and <!-- NOTE: ... --> comment blocks
  let cursor = bodyStart;
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (line.trim() === "") {
      cursor++;
      continue;
    }
    if (line.startsWith("<!-- NOTE:")) {
      // Skip until end of this comment block
      while (cursor < lines.length && !lines[cursor].endsWith("-->")) {
        cursor++;
      }
      cursor++; // skip the closing --> line
      continue;
    }
    break;
  }

  return lines.slice(cursor).join("\n");
}

// ---------------------------------------------------------------------------
// dungeonmaster: uses Task tool → must contain Agent/Task delegation NOTE
// ---------------------------------------------------------------------------
Deno.test(
  "generateAgentOutput dungeonmaster contains delegation NOTE",
  async () => {
    const srcFile = join(SRC_DIR, "dungeonmaster.md");
    const generated = await generateAgentOutput(srcFile);

    assertMatch(
      generated,
      /<!-- NOTE: This agent relies on Agent\/Task tool delegation/,
      "dungeonmaster output must contain Agent/Task delegation NOTE",
    );
  },
);

// ---------------------------------------------------------------------------
// No forbidden keys (name, share, provider, tools, ...) in output files
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
// Only allowed keys appear in frontmatter
// ---------------------------------------------------------------------------
Deno.test("bitsmith output frontmatter contains only allowed keys", async () => {
  const ALLOWED_KEYS = new Set([
    "description",
    "model",
    "mode",
    "permission",
    "temperature",
    "top_p",
    "color",
    "steps",
  ]);

  const srcFile = join(SRC_DIR, "bitsmith.md");
  const generated = await generateAgentOutput(srcFile);

  // Parse top-level keys from frontmatter (between --- delimiters)
  const lines = generated.split("\n");
  let delimCount = 0;
  for (const line of lines) {
    if (line === "---") {
      delimCount++;
      if (delimCount === 2) break;
      continue;
    }
    if (delimCount === 1) {
      const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):/);
      if (match) {
        assert(
          ALLOWED_KEYS.has(match[1]),
          `bitsmith output: frontmatter key '${
            match[1]
          }' is not in the allowed set`,
        );
      }
    }
  }
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

Deno.test(
  "model has anthropic/ prefix in riskmancer output (claude-opus)",
  async () => {
    const srcFile = join(SRC_DIR, "riskmancer.md");
    const generated = await generateAgentOutput(srcFile);

    assertMatch(
      generated,
      /^model: anthropic\/claude-opus/m,
      "riskmancer model must use anthropic/claude-opus prefix",
    );
  },
);

// ---------------------------------------------------------------------------
// 'agent' must NOT appear in permission array (no OpenCode equivalent)
// ---------------------------------------------------------------------------
Deno.test(
  "'agent' does not appear in permission array in bitsmith output",
  async () => {
    const srcFile = join(SRC_DIR, "bitsmith.md");
    const generated = await generateAgentOutput(srcFile);

    assertNotMatch(
      generated,
      /^ {2}- agent$/m,
      "permission must not contain 'agent' tool",
    );
  },
);

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
Deno.test(
  "riskmancer excludes write and edit from permission (disallowedTools)",
  async () => {
    const srcFile = join(SRC_DIR, "riskmancer.md");
    const generated = await generateAgentOutput(srcFile);

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
  },
);

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
Deno.test(
  "toolUsesDelegation returns true for bitsmith (uses Agent)",
  async () => {
    const srcFile = join(SRC_DIR, "bitsmith.md");
    const frontmatter = await extractFrontmatter(srcFile);
    assertEquals(toolUsesDelegation(frontmatter), true);
  },
);

Deno.test(
  "toolUsesDelegation returns true for dungeonmaster (uses Task)",
  async () => {
    const srcFile = join(SRC_DIR, "dungeonmaster.md");
    const frontmatter = await extractFrontmatter(srcFile);
    assertEquals(toolUsesDelegation(frontmatter), true);
  },
);

Deno.test(
  "toolUsesDelegation returns false for riskmancer (no Agent/Task)",
  async () => {
    const srcFile = join(SRC_DIR, "riskmancer.md");
    const frontmatter = await extractFrontmatter(srcFile);
    assertEquals(toolUsesDelegation(frontmatter), false);
  },
);

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

// ---------------------------------------------------------------------------
// All agents: no forbidden keys, correct structure
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

Deno.test(
  "generateAgentOutput - all agents have no forbidden keys",
  async () => {
    for (const name of allAgents) {
      const srcFile = join(SRC_DIR, `${name}.md`);
      const generated = await generateAgentOutput(srcFile);

      for (const key of FORBIDDEN_KEYS) {
        assert(
          !new RegExp(`^${key}:`, "m").test(generated),
          `${name}: output must not contain forbidden key '${key}'`,
        );
      }
    }
  },
);

Deno.test(
  "generateAgentOutput - all agents have generated header and non-empty body",
  async () => {
    for (const name of allAgents) {
      const srcFile = join(SRC_DIR, `${name}.md`);
      const generated = await generateAgentOutput(srcFile);

      // Header present
      assert(
        generated.includes(
          "<!-- Generated by ai-tpk adapters. Do not edit directly. -->",
        ),
        `${name}: missing generated header`,
      );

      // Body non-empty (extract body after closing ---)
      const lines = generated.split("\n");
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
      assert(bodyStart !== -1, `${name}: must have closing --- delimiter`);
      const body = lines.slice(bodyStart).join("\n");
      assert(body.trim().length > 0, `${name}: body must be non-empty`);
    }
  },
);

// ---------------------------------------------------------------------------
// Best-effort note present for agents without opencode: block
// ---------------------------------------------------------------------------
Deno.test(
  "generateAgentOutput includes best-effort note for agents without opencode: block",
  async () => {
    // Use a test fixture that deliberately lacks an opencode: block
    const fixtureFile = join(
      import.meta.dirname!,
      "testdata",
      "no-opencode-block.md",
    );
    const frontmatter = await extractFrontmatter(fixtureFile);

    // Confirm the fixture has no opencode block
    assertEquals(
      hasOpencodeBlock(frontmatter),
      false,
      "fixture must not have an opencode: block for this test to be valid",
    );

    const generated = await generateAgentOutput(fixtureFile);
    assertMatch(
      generated,
      /<!-- NOTE: No opencode: block found in source\. Best-effort generation from claude: block\. -->/,
      "output must contain best-effort NOTE when no opencode: block is present",
    );
  },
);

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
// dry-run: does not create files
// ---------------------------------------------------------------------------
Deno.test("--dry-run prints output and does not create files", async () => {
  const outFile = join(REPO_ROOT, "opencode", "agents", "bitsmith.md");

  // Remove the output file if it exists, so we can verify dry-run doesn't create it
  try {
    await Deno.remove(outFile);
  } catch {
    // File doesn't exist — that's fine
  }

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

  // The output file must NOT exist after dry-run
  const fileExists = await exists(outFile);
  assertEquals(fileExists, false, "dry-run must not create output files");
});

// ---------------------------------------------------------------------------
// Cross-harness body comparison: system prompt body identical between harnesses
// ---------------------------------------------------------------------------
Deno.test(
  "Cross-harness: system prompt body is identical between Claude and OpenCode for all agents",
  async () => {
    for (const name of allAgents) {
      const srcFile = join(SRC_DIR, `${name}.md`);
      const claudeOutput = await generateClaudeAgent(srcFile);
      const opencodeOutput = await generateAgentOutput(srcFile);

      const claudeBody = extractBody(claudeOutput);
      const opencodeBody = extractBody(opencodeOutput);

      assertEquals(
        claudeBody,
        opencodeBody,
        `${name}: system prompt body must be identical between Claude and OpenCode outputs`,
      );
    }
  },
);
