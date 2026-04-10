import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { installLauncherScript } from "../launcher-install.js";

function makeFakeLauncherRepo(root: string): void {
  const launcherDir = path.join(root, "launcher");
  const mcpDir = path.join(launcherDir, "mcp");
  fs.mkdirSync(launcherDir, { recursive: true });
  fs.mkdirSync(mcpDir, { recursive: true });
  fs.mkdirSync(path.join(launcherDir, "test"), { recursive: true });

  fs.writeFileSync(path.join(launcherDir, "main.ts"), "// main");
  fs.writeFileSync(path.join(launcherDir, "config.ts"), "// config");
  fs.writeFileSync(path.join(launcherDir, "types.ts"), "// types");
  fs.writeFileSync(path.join(mcpDir, "grafana.ts"), "// grafana");
  fs.writeFileSync(path.join(mcpDir, "cloudwatch.ts"), "// cloudwatch");
  fs.writeFileSync(path.join(launcherDir, "test", "config.test.ts"), "// test");
  fs.writeFileSync(path.join(launcherDir, "README.md"), "# readme");
  fs.writeFileSync(
    path.join(launcherDir, "package.json"),
    JSON.stringify({
      name: "myclaude-launcher",
      dependencies: { tsx: "^4.21.0" },
    }),
  );
  const shContent =
    [
      "#!/usr/bin/env bash",
      'LAUNCHER_DIR="$HOME/.claude/launcher"',
      'exec "$LAUNCHER_DIR/node_modules/.bin/tsx" main.ts "$@"',
    ].join("\n") + "\n";
  fs.writeFileSync(path.join(launcherDir, "myclaude.sh"), shContent);
  fs.chmodSync(path.join(launcherDir, "myclaude.sh"), 0o755);
}

describe("installLauncherScript", () => {
  let fakeRepo: string;
  let fakeHome: string;

  before(() => {
    fakeRepo = fs.mkdtempSync(path.join(os.tmpdir(), "launcher-test-repo-"));
    fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "launcher-test-home-"));
    makeFakeLauncherRepo(fakeRepo);
  });

  after(() => {
    fs.rmSync(fakeRepo, { recursive: true, force: true });
    fs.rmSync(fakeHome, { recursive: true, force: true });
  });

  it("copies root-level .ts files to ~/.claude/launcher/", () => {
    installLauncherScript(fakeRepo, {
      skipNpmInstall: true,
      homeDir: fakeHome,
    });
    const dest = path.join(fakeHome, ".claude", "launcher");
    assert.ok(fs.existsSync(path.join(dest, "main.ts")));
    assert.ok(fs.existsSync(path.join(dest, "config.ts")));
    assert.ok(fs.existsSync(path.join(dest, "types.ts")));
  });

  it("copies mcp/ subdirectory .ts files", () => {
    const dest = path.join(fakeHome, ".claude", "launcher", "mcp");
    assert.ok(fs.existsSync(path.join(dest, "grafana.ts")));
    assert.ok(fs.existsSync(path.join(dest, "cloudwatch.ts")));
  });

  it("does NOT copy test/ directory", () => {
    const dest = path.join(fakeHome, ".claude", "launcher");
    assert.ok(!fs.existsSync(path.join(dest, "test")));
  });

  it("does NOT copy README.md or myclaude.sh into launcher dir", () => {
    const dest = path.join(fakeHome, ".claude", "launcher");
    assert.ok(!fs.existsSync(path.join(dest, "README.md")));
    assert.ok(!fs.existsSync(path.join(dest, "myclaude.sh")));
  });

  it("copies package.json to launcher dir", () => {
    const dest = path.join(fakeHome, ".claude", "launcher", "package.json");
    assert.ok(fs.existsSync(dest));
    const pkg = JSON.parse(fs.readFileSync(dest, "utf8")) as { name?: string };
    assert.equal(pkg.name, "myclaude-launcher");
  });

  it("installs ~/bin/myclaude with correct content and permissions", () => {
    const binScript = path.join(fakeHome, "bin", "myclaude");
    assert.ok(fs.existsSync(binScript));
    const content = fs.readFileSync(binScript, "utf8");
    assert.ok(
      content.includes("$HOME/.claude/launcher"),
      "should reference launcher dir",
    );
    assert.ok(
      content.startsWith("#!/usr/bin/env bash"),
      "should have bash shebang",
    );
    const mode = fs.statSync(binScript).mode & 0o777;
    assert.equal(mode, 0o755, "should be executable");
  });

  it("cleans stale files on re-install", () => {
    // Plant a stale file in the destination
    const dest = path.join(fakeHome, ".claude", "launcher");
    fs.writeFileSync(path.join(dest, "stale.ts"), "// stale");

    // Re-run install
    installLauncherScript(fakeRepo, {
      skipNpmInstall: true,
      homeDir: fakeHome,
    });

    // Stale file should be gone
    assert.ok(!fs.existsSync(path.join(dest, "stale.ts")));
    // Real files should still be there
    assert.ok(fs.existsSync(path.join(dest, "main.ts")));
  });
});
