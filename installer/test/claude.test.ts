import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { installClaudeWhitelist } from "../claude.js";
import { CLAUDE_WHITELIST_DIRS, CLAUDE_WHITELIST_FILES } from "../constants.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-tpk-test-"));

// Build a fake source tree: tmpDir/claude/ with all whitelisted items
function buildFakeClaudeSrc(
  base: string,
  include: string[] = [...CLAUDE_WHITELIST_FILES, ...CLAUDE_WHITELIST_DIRS],
) {
  const claudeSrc = path.join(base, "claude");
  fs.mkdirSync(claudeSrc, { recursive: true });
  for (const name of include) {
    const p = path.join(claudeSrc, name);
    if (CLAUDE_WHITELIST_FILES.includes(name)) {
      fs.writeFileSync(p, `fake ${name}`);
    } else {
      fs.mkdirSync(p, { recursive: true });
    }
  }
  return base;
}

after(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

describe("installClaudeWhitelist", () => {
  it("installs all whitelisted items into destRoot/.claude", () => {
    const src = path.join(tmpDir, "full-install-src");
    const dest = path.join(tmpDir, "full-install-dest");
    buildFakeClaudeSrc(src);
    installClaudeWhitelist(src, "symlink", dest);
    const dotClaude = path.join(dest, ".claude");
    for (const name of CLAUDE_WHITELIST_FILES) {
      assert.ok(
        fs.existsSync(path.join(dotClaude, name)),
        `${name} should be installed`,
      );
    }
    for (const name of CLAUDE_WHITELIST_DIRS) {
      assert.ok(
        fs.existsSync(path.join(dotClaude, name)),
        `${name}/ should be installed`,
      );
    }
  });

  it("skips missing items without throwing", () => {
    const src = path.join(tmpDir, "partial-install-src");
    const dest = path.join(tmpDir, "partial-install-dest");
    // Only include a subset
    buildFakeClaudeSrc(src, ["settings.json", "skills"]);
    assert.doesNotThrow(() => installClaudeWhitelist(src, "symlink", dest));
    const dotClaude = path.join(dest, ".claude");
    assert.ok(fs.existsSync(path.join(dotClaude, "settings.json")));
    assert.ok(fs.existsSync(path.join(dotClaude, "skills")));
    assert.ok(!fs.existsSync(path.join(dotClaude, "CLAUDE.md")));
  });

  it("backs up a legacy symlink at destRoot/.claude and replaces with real directory", () => {
    const src = path.join(tmpDir, "legacy-src");
    const dest = path.join(tmpDir, "legacy-dest");
    buildFakeClaudeSrc(src, ["settings.json"]);
    fs.mkdirSync(dest, { recursive: true });
    // Create a legacy symlink at dest/.claude pointing somewhere (live target)
    const legacyTarget = path.join(tmpDir, "legacy-target");
    fs.mkdirSync(legacyTarget);
    const dotClaude = path.join(dest, ".claude");
    fs.symlinkSync(legacyTarget, dotClaude);
    assert.ok(
      fs.lstatSync(dotClaude).isSymbolicLink(),
      "setup: should be a symlink",
    );
    installClaudeWhitelist(src, "symlink", dest);
    // The symlink should have been backed up
    const backups = fs
      .readdirSync(dest)
      .filter((f) => f.startsWith(".claude.backup."));
    assert.strictEqual(backups.length, 1, "legacy symlink should be backed up");
    // And replaced with a real directory
    assert.ok(
      fs.lstatSync(dotClaude).isDirectory(),
      "should now be a real directory",
    );
  });
});
