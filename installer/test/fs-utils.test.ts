import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { backupIfExists, installPath, installDir } from "../fs-utils.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-tpk-test-"));

after(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

describe("backupIfExists", () => {
  it("renames an existing file", () => {
    const target = path.join(tmpDir, "backup-file.txt");
    fs.writeFileSync(target, "hello");
    backupIfExists(target);
    assert.ok(!fs.existsSync(target), "original path should be gone");
    const backups = fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith("backup-file.txt.backup."));
    assert.strictEqual(backups.length, 1);
  });

  it("renames an existing directory", () => {
    const target = path.join(tmpDir, "backup-dir");
    fs.mkdirSync(target);
    backupIfExists(target);
    assert.ok(!fs.existsSync(target));
    const backups = fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith("backup-dir.backup."));
    assert.strictEqual(backups.length, 1);
  });

  it("is a no-op for a non-existent path", () => {
    const target = path.join(tmpDir, "does-not-exist");
    assert.doesNotThrow(() => backupIfExists(target));
    assert.ok(!fs.existsSync(target));
  });

  it("silently skips a dangling symlink (known limitation: statSync follows symlinks)", () => {
    // KNOWN LIMITATION: backupIfExists uses fs.statSync which follows symlinks.
    // For a dangling symlink (target does not exist), statSync throws ENOENT and
    // the function returns without backing up or removing the symlink.
    // A future fix should switch to lstatSync to detect and back up dangling symlinks.
    const linkPath = path.join(tmpDir, "dangling-link");
    fs.symlinkSync(path.join(tmpDir, "nonexistent-target"), linkPath);
    backupIfExists(linkPath);
    // The dangling symlink should still be present (was not backed up)
    const lstat = fs.lstatSync(linkPath);
    assert.ok(
      lstat.isSymbolicLink(),
      "dangling symlink should remain untouched",
    );
  });
});

describe("installPath (symlink mode)", () => {
  it("creates a symlink pointing to the absolute src path", () => {
    const src = path.join(tmpDir, "src-file.txt");
    const dest = path.join(tmpDir, "dest-symlink.txt");
    fs.writeFileSync(src, "content");
    installPath(src, dest, "symlink");
    const lstat = fs.lstatSync(dest);
    assert.ok(lstat.isSymbolicLink());
    assert.strictEqual(fs.readlinkSync(dest), path.resolve(src));
  });

  it("backs up existing symlink on second call and creates new one", () => {
    const src = path.join(tmpDir, "src-for-second-call.txt");
    const dest = path.join(tmpDir, "dest-second-call.txt");
    fs.writeFileSync(src, "v2");
    installPath(src, dest, "symlink");
    installPath(src, dest, "symlink");
    const backups = fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith("dest-second-call.txt.backup."));
    assert.strictEqual(backups.length, 1);
    assert.ok(fs.lstatSync(dest).isSymbolicLink());
  });
});

describe("installPath (copy mode)", () => {
  it("recursively copies a directory", () => {
    const srcDir = path.join(tmpDir, "copy-src");
    const destDir = path.join(tmpDir, "copy-dest");
    fs.mkdirSync(srcDir);
    fs.writeFileSync(path.join(srcDir, "nested.txt"), "nested");
    installPath(srcDir, destDir, "copy");
    assert.ok(fs.existsSync(path.join(destDir, "nested.txt")));
  });

  it("backs up existing copy on second call", () => {
    const srcDir = path.join(tmpDir, "copy-src2");
    const destDir = path.join(tmpDir, "copy-dest2");
    fs.mkdirSync(srcDir);
    installPath(srcDir, destDir, "copy");
    installPath(srcDir, destDir, "copy");
    const backups = fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith("copy-dest2.backup."));
    assert.strictEqual(backups.length, 1);
  });
});

describe("installDir", () => {
  it("skips when source directory does not exist", () => {
    const destPath = path.join(tmpDir, ".nonexistent-dest");
    installDir(
      tmpDir,
      "nonexistent-src",
      ".nonexistent-dest",
      "symlink",
      tmpDir,
    );
    assert.ok(
      !fs.existsSync(destPath),
      "dest should not be created when src is missing",
    );
  });

  it("installs when source directory exists", () => {
    const srcDir = path.join(tmpDir, "real-src");
    fs.mkdirSync(srcDir);
    fs.writeFileSync(path.join(srcDir, "file.txt"), "data");
    installDir(tmpDir, "real-src", ".real-dest", "symlink", tmpDir);
    const destPath = path.join(tmpDir, ".real-dest");
    assert.ok(fs.lstatSync(destPath).isSymbolicLink());
  });
});
