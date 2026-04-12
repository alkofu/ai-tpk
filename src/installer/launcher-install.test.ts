import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { installLauncherScript } from "./launcher-install.js";

function makeFakeRepo(
  root: string,
  { withBundle = true }: { withBundle?: boolean } = {},
): void {
  const launcherDir = path.join(root, "src", "launcher");
  fs.mkdirSync(launcherDir, { recursive: true });

  const shContent =
    ["#!/usr/bin/env bash", 'exec node "$HOME/.ai-tpk/launcher.cjs" "$@"'].join(
      "\n",
    ) + "\n";
  fs.writeFileSync(path.join(launcherDir, "myclaude.sh"), shContent);
  fs.chmodSync(path.join(launcherDir, "myclaude.sh"), 0o755);

  if (withBundle) {
    const distDir = path.join(root, "dist");
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(
      path.join(distDir, "launcher.cjs"),
      "// fake launcher bundle\n",
    );
  }
}

describe("installLauncherScript", () => {
  let fakeRepo: string;
  let fakeHome: string;

  before(() => {
    fakeRepo = fs.mkdtempSync(path.join(os.tmpdir(), "launcher-test-repo-"));
    fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "launcher-test-home-"));
    makeFakeRepo(fakeRepo);
    installLauncherScript(fakeRepo, { homeDir: fakeHome });
  });

  after(() => {
    fs.rmSync(fakeRepo, { recursive: true, force: true });
    fs.rmSync(fakeHome, { recursive: true, force: true });
  });

  it("copies dist/launcher.cjs to ~/.ai-tpk/launcher.cjs", () => {
    const destBundle = path.join(fakeHome, ".ai-tpk", "launcher.cjs");
    assert.ok(fs.existsSync(destBundle));
    const content = fs.readFileSync(destBundle, "utf8");
    assert.ok(content.includes("fake launcher bundle"));
  });

  it("creates ~/.ai-tpk/ directory if it doesn't exist", () => {
    const aiTpkDir = path.join(fakeHome, ".ai-tpk");
    assert.ok(fs.existsSync(aiTpkDir));
    assert.ok(fs.statSync(aiTpkDir).isDirectory());
  });

  it("throws if dist/launcher.cjs is missing", () => {
    const freshRepo = fs.mkdtempSync(
      path.join(os.tmpdir(), "launcher-test-fresh-repo-"),
    );
    const freshHome = fs.mkdtempSync(
      path.join(os.tmpdir(), "launcher-test-fresh-home-"),
    );
    try {
      makeFakeRepo(freshRepo, { withBundle: false });
      assert.throws(
        () => installLauncherScript(freshRepo, { homeDir: freshHome }),
        /dist\/launcher\.cjs not found/,
      );
      assert.ok(!fs.existsSync(path.join(freshHome, ".ai-tpk")));
    } finally {
      fs.rmSync(freshRepo, { recursive: true, force: true });
      fs.rmSync(freshHome, { recursive: true, force: true });
    }
  });

  it("installs ~/bin/myclaude wrapper with correct content and permissions", () => {
    const binScript = path.join(fakeHome, "bin", "myclaude");
    assert.ok(fs.existsSync(binScript));
    const content = fs.readFileSync(binScript, "utf8");
    assert.ok(content.startsWith("#!/usr/bin/env bash"));
    assert.ok(content.includes(".ai-tpk/launcher.cjs"));
    const mode = fs.statSync(binScript).mode & 0o777;
    assert.equal(mode, 0o755);
  });

  it("removes old ~/.claude/launcher/ on re-install (migration cleanup)", () => {
    const oldLauncherDir = path.join(fakeHome, ".claude", "launcher");
    fs.mkdirSync(oldLauncherDir, { recursive: true });
    fs.writeFileSync(path.join(oldLauncherDir, "main.ts"), "// old main");

    installLauncherScript(fakeRepo, { homeDir: fakeHome });

    assert.ok(!fs.existsSync(oldLauncherDir));
    assert.ok(fs.existsSync(path.join(fakeHome, ".ai-tpk", "launcher.cjs")));
  });

  it("preserves unrelated ~/.ai-tpk/ files on re-install", () => {
    fs.writeFileSync(
      path.join(fakeHome, ".ai-tpk", "other-tool.json"),
      '{"tool":"other"}',
    );

    installLauncherScript(fakeRepo, { homeDir: fakeHome });

    assert.ok(fs.existsSync(path.join(fakeHome, ".ai-tpk", "other-tool.json")));
    assert.ok(fs.existsSync(path.join(fakeHome, ".ai-tpk", "launcher.cjs")));
  });

  it("removes stale ~/.ai-tpk/launcher.js on re-install", () => {
    const staleJs = path.join(fakeHome, ".ai-tpk", "launcher.js");
    fs.writeFileSync(staleJs, "// stale bundle\n");

    installLauncherScript(fakeRepo, { homeDir: fakeHome });

    assert.ok(!fs.existsSync(staleJs));
    assert.ok(fs.existsSync(path.join(fakeHome, ".ai-tpk", "launcher.cjs")));
  });
});
