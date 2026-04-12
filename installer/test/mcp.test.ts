import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  expandVars,
  loadMcpServers,
  buildAddArgs,
  computeConfigSignature,
  readStamps,
  writeStamps,
} from "../mcp.js";

// ---------------------------------------------------------------------------
// Shared temp directory — cleaned up after all tests complete
// ---------------------------------------------------------------------------

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-tpk-mcp-test-"));

after(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

// ---------------------------------------------------------------------------
// Helper: write a minimal mcp-servers.json to a temp repo root and return the
// path to that root directory.
// ---------------------------------------------------------------------------

function writeMcpFile(servers: unknown[]): string {
  const repoRoot = fs.mkdtempSync(path.join(tmpDir, "repo-"));
  fs.writeFileSync(
    path.join(repoRoot, "mcp-servers.json"),
    JSON.stringify({ servers }),
    "utf8",
  );
  return repoRoot;
}

// ---------------------------------------------------------------------------
// expandVars
// ---------------------------------------------------------------------------

describe("expandVars", () => {
  it("expands $HOME", () => {
    const home = os.homedir();
    assert.strictEqual(expandVars("$HOME/.config"), `${home}/.config`);
  });

  it("expands ${HOME}", () => {
    const home = os.homedir();
    assert.strictEqual(expandVars("${HOME}/.config"), `${home}/.config`);
  });

  it("expands $USER", () => {
    const user = os.userInfo().username;
    assert.strictEqual(expandVars("hello-$USER"), `hello-${user}`);
  });

  it("expands ${USER}", () => {
    const user = os.userInfo().username;
    assert.strictEqual(expandVars("${USER}-name"), `${user}-name`);
  });

  it("does not expand arbitrary env vars like $GRAFANA_URL", () => {
    const original = "$GRAFANA_URL";
    assert.strictEqual(expandVars(original), original);
  });

  it("leaves a string with no vars unchanged", () => {
    assert.strictEqual(expandVars("no-vars-here"), "no-vars-here");
  });
});

// ---------------------------------------------------------------------------
// loadMcpServers — validation
// ---------------------------------------------------------------------------

describe("loadMcpServers", () => {
  it("returns [] when mcp-servers.json does not exist", () => {
    const repoRoot = fs.mkdtempSync(path.join(tmpDir, "repo-empty-"));
    const result = loadMcpServers(repoRoot);
    assert.deepStrictEqual(result, []);
  });

  it("loads a valid command-based entry (no wrapper)", () => {
    const repoRoot = writeMcpFile([
      {
        name: "kubernetes",
        scope: "user",
        transport: "stdio",
        command: "kubectl",
        args: ["mcp", "serve"],
      },
    ]);
    const servers = loadMcpServers(repoRoot);
    assert.strictEqual(servers.length, 1);
    assert.strictEqual(servers[0]?.name, "kubernetes");
  });

  it("loads a valid wrapper-based entry (no command)", () => {
    const repoRoot = writeMcpFile([
      {
        name: "grafana",
        scope: "user",
        transport: "stdio",
        wrapper: "wrappers/mcp-grafana.sh",
      },
    ]);
    const servers = loadMcpServers(repoRoot);
    assert.strictEqual(servers.length, 1);
    assert.strictEqual(servers[0]?.name, "grafana");
  });

  it("throws when entry has both wrapper and command", () => {
    const repoRoot = writeMcpFile([
      {
        name: "bad-server",
        scope: "user",
        transport: "stdio",
        command: "some-cmd",
        wrapper: "wrappers/some.sh",
      },
    ]);
    assert.throws(
      () => loadMcpServers(repoRoot),
      (err: unknown) =>
        err instanceof Error && err.message.includes("must not have both"),
    );
  });

  it("throws when entry has neither wrapper nor command", () => {
    const repoRoot = writeMcpFile([
      {
        name: "bad-server",
        scope: "user",
        transport: "stdio",
      },
    ]);
    assert.throws(
      () => loadMcpServers(repoRoot),
      (err: unknown) =>
        err instanceof Error && err.message.includes("must have either"),
    );
  });

  it("throws on invalid scope", () => {
    const repoRoot = writeMcpFile([
      {
        name: "bad-scope",
        scope: "global",
        transport: "stdio",
        command: "some-cmd",
      },
    ]);
    assert.throws(
      () => loadMcpServers(repoRoot),
      (err: unknown) =>
        err instanceof Error && err.message.includes("invalid scope"),
    );
  });

  it("throws on invalid transport", () => {
    const repoRoot = writeMcpFile([
      {
        name: "bad-transport",
        scope: "user",
        transport: "websocket",
        command: "some-cmd",
      },
    ]);
    assert.throws(
      () => loadMcpServers(repoRoot),
      (err: unknown) =>
        err instanceof Error && err.message.includes("invalid transport"),
    );
  });
});

// ---------------------------------------------------------------------------
// buildAddArgs — wrapper-based servers
// ---------------------------------------------------------------------------

describe("buildAddArgs — wrapper-based server", () => {
  it("returns correct args with absolute wrapper path and no -e flags when wrapper file exists", () => {
    // Create a real wrapper file so statSync succeeds
    const repoRoot = fs.mkdtempSync(path.join(tmpDir, "repo-wrapper-"));
    const fakeHomedir = fs.mkdtempSync(path.join(tmpDir, "home-wrapper-"));
    const wrappersDir = path.join(fakeHomedir, ".claude", "wrappers");
    fs.mkdirSync(wrappersDir, { recursive: true });
    const wrapperFile = path.join(wrappersDir, "mcp-grafana.sh");
    fs.writeFileSync(
      wrapperFile,
      "#!/usr/bin/env bash\nexec uvx mcp-grafana\n",
    );

    const server = {
      name: "grafana",
      scope: "user" as const,
      transport: "stdio" as const,
      wrapper: "wrappers/mcp-grafana.sh",
    };

    const args = buildAddArgs(server, repoRoot, fakeHomedir);

    const expectedWrapperPath = path.join(
      fakeHomedir,
      ".claude",
      "wrappers/mcp-grafana.sh",
    );
    assert.deepStrictEqual(args, [
      "-s",
      "user",
      "-t",
      "stdio",
      "--",
      "grafana",
      expectedWrapperPath,
    ]);

    // Must not contain any -e flags
    assert.ok(
      !args.includes("-e"),
      "wrapper-based args must not contain -e flags",
    );
  });

  it("throws with descriptive error when wrapper file does not exist", () => {
    const repoRoot = fs.mkdtempSync(path.join(tmpDir, "repo-missing-"));
    const fakeHomedir = fs.mkdtempSync(path.join(tmpDir, "home-missing-"));

    const server = {
      name: "grafana",
      scope: "user" as const,
      transport: "stdio" as const,
      wrapper: "wrappers/mcp-grafana.sh",
    };

    const expectedWrapperPath = path.join(
      fakeHomedir,
      ".claude",
      "wrappers/mcp-grafana.sh",
    );

    assert.throws(
      () => buildAddArgs(server, repoRoot, fakeHomedir),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes("Wrapper script not found"),
          `expected "Wrapper script not found" in: ${err.message}`,
        );
        assert.ok(
          err.message.includes(expectedWrapperPath),
          `expected path "${expectedWrapperPath}" in: ${err.message}`,
        );
        assert.ok(
          err.message.includes("grafana"),
          `expected server name "grafana" in: ${err.message}`,
        );
        return true;
      },
    );
  });

  it("resolves user-scope wrapper against homedir/.claude/ instead of repoRoot", () => {
    const repoRoot = fs.mkdtempSync(path.join(tmpDir, "repo-user-scope-"));
    const fakeHomedir = fs.mkdtempSync(path.join(tmpDir, "home-user-scope-"));
    const wrappersDir = path.join(fakeHomedir, ".claude", "wrappers");
    fs.mkdirSync(wrappersDir, { recursive: true });
    fs.writeFileSync(
      path.join(wrappersDir, "mcp-test.sh"),
      "#!/usr/bin/env bash\nexec echo test\n",
    );

    const server = {
      name: "test-server",
      scope: "user" as const,
      transport: "stdio" as const,
      wrapper: "wrappers/mcp-test.sh",
    };

    const args = buildAddArgs(server, repoRoot, fakeHomedir);

    const expectedWrapperPath = path.join(
      fakeHomedir,
      ".claude",
      "wrappers/mcp-test.sh",
    );
    assert.ok(
      args.includes(expectedWrapperPath),
      `expected args to contain "${expectedWrapperPath}", got: ${JSON.stringify(args)}`,
    );
  });

  it("resolves project-scope wrapper against repoRoot", () => {
    const fakeRepoRoot = fs.mkdtempSync(path.join(tmpDir, "repo-proj-scope-"));
    const wrappersDir = path.join(fakeRepoRoot, "wrappers");
    fs.mkdirSync(wrappersDir);
    fs.writeFileSync(
      path.join(wrappersDir, "some.sh"),
      "#!/usr/bin/env bash\nexec echo some\n",
    );

    const server = {
      name: "some-server",
      scope: "project" as const,
      transport: "stdio" as const,
      wrapper: "wrappers/some.sh",
    };

    const args = buildAddArgs(server, fakeRepoRoot);

    const expectedWrapperPath = path.join(fakeRepoRoot, "wrappers/some.sh");
    assert.ok(
      args.includes(expectedWrapperPath),
      `expected args to contain "${expectedWrapperPath}", got: ${JSON.stringify(args)}`,
    );
  });
});

// ---------------------------------------------------------------------------
// buildAddArgs — command-based servers
// ---------------------------------------------------------------------------

describe("buildAddArgs — command-based server", () => {
  it("returns correct args with -e flags and command", () => {
    const repoRoot = fs.mkdtempSync(path.join(tmpDir, "repo-cmd-"));

    const server = {
      name: "kubernetes",
      scope: "user" as const,
      transport: "stdio" as const,
      command: "kubectl",
      args: ["mcp", "serve"],
      env: {
        KUBECONFIG: "/home/user/.kube/config",
      },
    };

    const args = buildAddArgs(server, repoRoot);

    assert.deepStrictEqual(args, [
      "-s",
      "user",
      "-t",
      "stdio",
      "-e",
      "KUBECONFIG=/home/user/.kube/config",
      "--",
      "kubernetes",
      "kubectl",
      "mcp",
      "serve",
    ]);
  });

  it("expands $HOME in env values", () => {
    const home = os.homedir();
    const repoRoot = fs.mkdtempSync(path.join(tmpDir, "repo-home-"));

    const server = {
      name: "mytool",
      scope: "user" as const,
      transport: "stdio" as const,
      command: "mytool",
      env: {
        CONFIG: "$HOME/.config/mytool",
      },
    };

    const args = buildAddArgs(server, repoRoot);

    const envFlag = args.find((a) => a.startsWith("CONFIG="));
    assert.ok(envFlag !== undefined, "should have CONFIG= env flag");
    assert.strictEqual(envFlag, `CONFIG=${home}/.config/mytool`);
  });

  it("appends args after the command", () => {
    const repoRoot = fs.mkdtempSync(path.join(tmpDir, "repo-args-"));

    const server = {
      name: "cloudwatch",
      scope: "user" as const,
      transport: "stdio" as const,
      command: "uvx",
      args: ["awslabs.cloudwatch-mcp-server@0.0.19"],
    };

    const args = buildAddArgs(server, repoRoot);

    // Command and args appear after "--"
    const separatorIndex = args.indexOf("--");
    assert.ok(separatorIndex !== -1, 'args must contain "--" separator');
    const afterSep = args.slice(separatorIndex + 1);
    assert.deepStrictEqual(afterSep, [
      "cloudwatch",
      "uvx",
      "awslabs.cloudwatch-mcp-server@0.0.19",
    ]);
  });

  it("handles a server with no env and no args", () => {
    const repoRoot = fs.mkdtempSync(path.join(tmpDir, "repo-noenv-"));

    const server = {
      name: "simple",
      scope: "project" as const,
      transport: "sse" as const,
      command: "simple-cmd",
    };

    const args = buildAddArgs(server, repoRoot);

    assert.deepStrictEqual(args, [
      "-s",
      "project",
      "-t",
      "sse",
      "--",
      "simple",
      "simple-cmd",
    ]);
  });
});

// ---------------------------------------------------------------------------
// computeConfigSignature
// ---------------------------------------------------------------------------

describe("computeConfigSignature", () => {
  const baseServer = {
    name: "grafana",
    scope: "user" as const,
    transport: "stdio" as const,
    wrapper: "wrappers/mcp-grafana.sh",
  };
  const repoRoot = "/tmp/fake-repo";
  const fakeHomedir = "/tmp/fake-home";

  it("produces identical signatures for identical inputs", () => {
    const sig1 = computeConfigSignature(baseServer, repoRoot, fakeHomedir);
    const sig2 = computeConfigSignature(baseServer, repoRoot, fakeHomedir);
    assert.strictEqual(sig1, sig2);
  });

  it("produces different signatures when wrapper path changes", () => {
    const other = { ...baseServer, wrapper: "wrappers/mcp-other.sh" };
    const sig1 = computeConfigSignature(baseServer, repoRoot, fakeHomedir);
    const sig2 = computeConfigSignature(other, repoRoot, fakeHomedir);
    assert.notStrictEqual(sig1, sig2);
  });

  it("produces different signatures when transport changes", () => {
    const other = { ...baseServer, transport: "sse" as const };
    const sig1 = computeConfigSignature(baseServer, repoRoot, fakeHomedir);
    const sig2 = computeConfigSignature(other, repoRoot, fakeHomedir);
    assert.notStrictEqual(sig1, sig2);
  });

  it("produces different signatures when scope changes", () => {
    const other = { ...baseServer, scope: "project" as const };
    const sig1 = computeConfigSignature(baseServer, repoRoot, fakeHomedir);
    const sig2 = computeConfigSignature(other, repoRoot, fakeHomedir);
    assert.notStrictEqual(sig1, sig2);
  });

  it("resolves user-scope wrapper against homedir", () => {
    const localHome = "/custom/home";
    const sig = computeConfigSignature(baseServer, repoRoot, localHome);
    const expectedPath = path.join(
      localHome,
      ".claude",
      "wrappers/mcp-grafana.sh",
    );
    assert.ok(
      sig.includes(expectedPath),
      `expected signature to contain "${expectedPath}", got: ${sig}`,
    );
  });

  it("throws when server has no wrapper field", () => {
    const commandServer = {
      name: "kubernetes",
      scope: "user" as const,
      transport: "stdio" as const,
      command: "kubectl",
    };
    assert.throws(() => computeConfigSignature(commandServer, repoRoot));
  });
});

// ---------------------------------------------------------------------------
// readStamps
// ---------------------------------------------------------------------------

describe("readStamps", () => {
  it("returns empty object when file does not exist", () => {
    const nonexistent = path.join(tmpDir, "no-such-stamps.json");
    const result = readStamps(nonexistent);
    assert.deepStrictEqual(result, {});
  });

  it("returns parsed stamps from valid JSON file", () => {
    const stampsPath = path.join(tmpDir, "valid-stamps.json");
    const stamps = { grafana: '{"name":"grafana"}', kubernetes: '{"name":"k8s"}' };
    fs.writeFileSync(stampsPath, JSON.stringify(stamps), "utf8");
    const result = readStamps(stampsPath);
    assert.deepStrictEqual(result, stamps);
  });

  it("returns empty object and does not throw on corrupted JSON", () => {
    const stampsPath = path.join(tmpDir, "corrupt-stamps.json");
    fs.writeFileSync(stampsPath, "not valid json {{{", "utf8");
    const result = readStamps(stampsPath);
    assert.deepStrictEqual(result, {});
  });
});

// ---------------------------------------------------------------------------
// writeStamps
// ---------------------------------------------------------------------------

describe("writeStamps", () => {
  it("writes stamps to disk as pretty JSON", () => {
    const stampsPath = path.join(tmpDir, "written-stamps.json");
    const stamps = { grafana: "sig1", kubernetes: "sig2" };
    writeStamps(stampsPath, stamps);
    const written = fs.readFileSync(stampsPath, "utf8");
    assert.strictEqual(written, JSON.stringify(stamps, null, 2));
  });

  it("does not throw when path is unwritable", () => {
    const stampsPath = path.join(tmpDir, "no", "such", "dir", "stamps.json");
    assert.doesNotThrow(() => writeStamps(stampsPath, { key: "value" }));
  });
});
