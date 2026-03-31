import {
  assert,
  assertEquals,
  assertMatch,
  assertNotEquals,
  assertRejects,
} from "@std/assert";
import {
  agentNameFromFile,
  extractFrontmatter,
  getArray,
  getBody,
  getField,
  getNamespacedField,
  mapModelOpencode,
} from "./parse.ts";
import type { ClaudeBlock } from "../types.ts";

const REPO_ROOT = new URL("../../", import.meta.url).pathname.replace(
  /\/$/,
  "",
);
const BITSMITH = `${REPO_ROOT}/src/agents/bitsmith.md`;
const RISKMANCER = `${REPO_ROOT}/src/agents/riskmancer.md`;
const KNOTCUTTER = `${REPO_ROOT}/src/agents/knotcutter.md`;

Deno.test("extractFrontmatter bitsmith - description is non-empty", async () => {
  const fm = await extractFrontmatter(BITSMITH);
  assertNotEquals(fm.description, "");
  assertNotEquals(fm.description, undefined);
});

Deno.test("extractFrontmatter bitsmith - model is claude-sonnet-4-6", async () => {
  const fm = await extractFrontmatter(BITSMITH);
  assertEquals(fm.model, "claude-sonnet-4-6");
});

Deno.test("extractFrontmatter bitsmith - claude.tools is correct", async () => {
  const fm = await extractFrontmatter(BITSMITH);
  assertEquals(fm.claude?.tools, "Read, Write, Edit, Bash, Grep, Glob, Agent");
});

Deno.test("extractFrontmatter bitsmith - opencode.permission is string array", async () => {
  const fm = await extractFrontmatter(BITSMITH);
  const perms = fm.opencode?.permission;
  assertEquals(Array.isArray(perms), true);
  assertNotEquals(perms?.length, 0);
});

Deno.test("extractFrontmatter riskmancer - model is claude-opus-4-6", async () => {
  const fm = await extractFrontmatter(RISKMANCER);
  assertEquals(fm.model, "claude-opus-4-6");
});

Deno.test("extractFrontmatter riskmancer - claude.disallowedTools is non-empty", async () => {
  const fm = await extractFrontmatter(RISKMANCER);
  assertNotEquals(fm.claude?.disallowedTools, undefined);
  assertNotEquals(fm.claude?.disallowedTools, "");
});

Deno.test("extractFrontmatter riskmancer - claude.trigger_keywords is array with multiple elements", async () => {
  const fm = await extractFrontmatter(RISKMANCER);
  const kw = fm.claude?.trigger_keywords;
  assertEquals(Array.isArray(kw), true);
  assert(
    (kw ?? []).length >= 2,
    "trigger_keywords should have at least 2 elements",
  );
});

Deno.test("getArray knotcutter - claude.tools returns [] (field absent)", async () => {
  const fm = await extractFrontmatter(KNOTCUTTER);
  const result = getArray(fm, "claude.tools");
  assertEquals(result, []);
});

Deno.test("getNamespacedField knotcutter - claude.disallowedTools returns correct string", async () => {
  const fm = await extractFrontmatter(KNOTCUTTER);
  const result = getNamespacedField<ClaudeBlock, "disallowedTools">(
    fm,
    "claude",
    "disallowedTools",
  );
  assertNotEquals(result, undefined);
  assertNotEquals(result, "");
});

Deno.test("getBody bitsmith - returns non-empty string", async () => {
  const body = await getBody(BITSMITH);
  assertNotEquals(body, "");
});

Deno.test("getBody bitsmith - does not start with bare --- line", async () => {
  const body = await getBody(BITSMITH);
  const lines = body.split("\n");
  // The first non-empty line should not be bare '---'
  const firstContentLine = lines.find((l: string) => l.trim() !== "");
  assertNotEquals(firstContentLine, "---");
});

Deno.test("mapModelOpencode - adds anthropic/ prefix to bare model ID", () => {
  assertEquals(
    mapModelOpencode("claude-sonnet-4-6"),
    "anthropic/claude-sonnet-4-6",
  );
});

Deno.test("mapModelOpencode - does not double-prefix already-prefixed model", () => {
  assertEquals(
    mapModelOpencode("anthropic/claude-opus-4-6"),
    "anthropic/claude-opus-4-6",
  );
});

Deno.test("mapModelOpencode - returns empty string for undefined", () => {
  assertEquals(mapModelOpencode(undefined), "");
});

Deno.test("mapModelOpencode - returns empty string for empty string", () => {
  assertEquals(mapModelOpencode(""), "");
});

Deno.test("agentNameFromFile - returns basename without .md extension", () => {
  assertEquals(agentNameFromFile("src/agents/bitsmith.md"), "bitsmith");
});

Deno.test("agentNameFromFile - works with full absolute path", () => {
  assertEquals(agentNameFromFile(BITSMITH), "bitsmith");
});

Deno.test("getField - returns description for bitsmith", async () => {
  const fm = await extractFrontmatter(BITSMITH);
  const desc = getField(fm, "description");
  assertNotEquals(desc, undefined);
  assertNotEquals(desc, "");
});

Deno.test("getArray bitsmith - opencode.permission returns non-empty string[]", async () => {
  const fm = await extractFrontmatter(BITSMITH);
  const perms = getArray(fm, "opencode.permission");
  assertEquals(Array.isArray(perms), true);
  assertNotEquals(perms.length, 0);
  // All elements must be strings
  perms.forEach((p: string) => assertEquals(typeof p, "string"));
});

Deno.test("getArray bitsmith - opencode.permission returns 6 elements", async () => {
  const fm = await extractFrontmatter(BITSMITH);
  const perms = getArray(fm, "opencode.permission");
  assertEquals(perms.length, 6);
});

Deno.test("getArray riskmancer - claude.trigger_keywords returns multiple elements", async () => {
  const fm = await extractFrontmatter(RISKMANCER);
  const kw = getArray(fm, "claude.trigger_keywords");
  assertNotEquals(kw.length < 2, true);
});

Deno.test("extractFrontmatter - throws descriptive error when description is missing", async () => {
  const tmp = Deno.makeTempFileSync({ suffix: ".md" });
  try {
    await Deno.writeTextFile(
      tmp,
      "---\nmodel: claude-sonnet-4-6\n---\nSome body text.\n",
    );
    await assertRejects(
      () => extractFrontmatter(tmp),
      Error,
      "missing or empty required field 'description'",
    );
  } finally {
    await Deno.remove(tmp);
  }
});

Deno.test("nested YAML structure access via @std/yaml parse - confirms nested objects parse correctly", async () => {
  const fm = await extractFrontmatter(BITSMITH);
  // Verify that nested claude and opencode blocks are plain JS objects
  assertEquals(typeof fm.claude, "object");
  assertEquals(typeof fm.opencode, "object");
  // Verify nested field access works
  assertMatch(fm.claude?.tools ?? "", /Read/);
  assertEquals(fm.opencode?.mode, "subagent");
});
