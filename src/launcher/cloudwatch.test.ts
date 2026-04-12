import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadAwsProfiles } from "./mcp/cloudwatch.js";

// ---------------------------------------------------------------------------
// Shared temp directory — cleaned up after all tests complete
// ---------------------------------------------------------------------------

const tmpDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "ai-tpk-cloudwatch-test-"),
);

after(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

// ---------------------------------------------------------------------------
// Helper: write an AWS config file to the temp dir and return its path
// ---------------------------------------------------------------------------

function writeAwsConfig(name: string, content: string): string {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

// ---------------------------------------------------------------------------
// loadAwsProfiles
// ---------------------------------------------------------------------------

describe("loadAwsProfiles", () => {
  it('parses [default] as "default"', () => {
    const filePath = writeAwsConfig(
      "default-only.ini",
      `
[default]
region = us-east-1
`,
    );
    const profiles = loadAwsProfiles(filePath);
    assert.deepStrictEqual(profiles, ["default"]);
  });

  it('parses [profile foo-bar] as "foo-bar"', () => {
    const filePath = writeAwsConfig(
      "named-profile.ini",
      `
[profile foo-bar]
region = eu-west-1
`,
    );
    const profiles = loadAwsProfiles(filePath);
    assert.deepStrictEqual(profiles, ["foo-bar"]);
  });

  it("handles a file with multiple profiles (default + named)", () => {
    const filePath = writeAwsConfig(
      "multi-profile.ini",
      `
[default]
region = us-east-1

[profile dev]
region = us-west-2

[profile prod]
region = eu-central-1
`,
    );
    const profiles = loadAwsProfiles(filePath);
    assert.deepStrictEqual(profiles, ["default", "dev", "prod"]);
  });

  it("ignores non-profile sections (e.g. [sso-session my-session])", () => {
    const filePath = writeAwsConfig(
      "with-sso.ini",
      `
[default]
region = us-east-1

[sso-session my-session]
sso_start_url = https://example.awsapps.com/start
`,
    );
    const profiles = loadAwsProfiles(filePath);
    assert.deepStrictEqual(profiles, ["default"]);
  });

  it("trims whitespace from profile names", () => {
    const filePath = writeAwsConfig(
      "padded.ini",
      `
[profile  padded ]
region = us-east-1
`,
    );
    const profiles = loadAwsProfiles(filePath);
    assert.deepStrictEqual(profiles, ["padded"]);
  });

  it("throws when the config file does not exist", () => {
    const missingPath = path.join(tmpDir, "does-not-exist.ini");
    assert.throws(
      () => loadAwsProfiles(missingPath),
      (err: unknown) =>
        err instanceof Error && err.message.includes("AWS config not found"),
    );
  });

  it("throws when no profiles are found in the file", () => {
    const filePath = writeAwsConfig(
      "no-profiles.ini",
      `
# This file has no profile sections
region = us-east-1
output = json
`,
    );
    assert.throws(
      () => loadAwsProfiles(filePath),
      (err: unknown) =>
        err instanceof Error && err.message.includes("No AWS profiles found"),
    );
  });
});
