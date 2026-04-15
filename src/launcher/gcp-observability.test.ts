import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  validateGcpProjectId,
  checkAdcCredentials,
} from "./mcp/gcp-observability.js";

// ---------------------------------------------------------------------------
// Shared temp directory — cleaned up after all tests complete
// ---------------------------------------------------------------------------

const tmpDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "ai-tpk-gcp-observability-test-"),
);

after(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

// ---------------------------------------------------------------------------
// Helper: write a file to the temp dir and return its path
// ---------------------------------------------------------------------------

function writeTempFile(name: string, content: string): string {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

// ---------------------------------------------------------------------------
// validateGcpProjectId
// ---------------------------------------------------------------------------

describe("validateGcpProjectId", () => {
  describe("valid inputs", () => {
    it('accepts "my-project-123"', () => {
      assert.ok(validateGcpProjectId("my-project-123"));
    });

    it('accepts "a12345" (6 chars, minimum length)', () => {
      assert.ok(validateGcpProjectId("a12345"));
    });

    it('accepts "abcdef-ghijkl-mnopqr-stuvwx-yz" (30 chars, maximum length)', () => {
      assert.ok(validateGcpProjectId("abcdef-ghijkl-mnopqr-stuvwx-yz"));
    });
  });

  describe("invalid inputs", () => {
    it('rejects "short" (5 chars, below minimum)', () => {
      assert.ok(!validateGcpProjectId("short"));
    });

    it('rejects "My-Project" (uppercase letters)', () => {
      assert.ok(!validateGcpProjectId("My-Project"));
    });

    it('rejects "1-starts-with-digit" (must start with a letter)', () => {
      assert.ok(!validateGcpProjectId("1-starts-with-digit"));
    });

    it('rejects "ends-with-hyphen-" (must not end with a hyphen)', () => {
      assert.ok(!validateGcpProjectId("ends-with-hyphen-"));
    });

    it('rejects "has spaces" (spaces not allowed)', () => {
      assert.ok(!validateGcpProjectId("has spaces"));
    });

    it('rejects "has_underscores" (underscores not allowed)', () => {
      assert.ok(!validateGcpProjectId("has_underscores"));
    });

    it('rejects "" (empty string)', () => {
      assert.ok(!validateGcpProjectId(""));
    });

    it("rejects a 31-character string (above maximum length)", () => {
      assert.ok(!validateGcpProjectId("a".repeat(31)));
    });

    it('rejects "a--bcdef" (consecutive hyphens)', () => {
      assert.ok(!validateGcpProjectId("a--bcdef"));
    });

    it('rejects "abc--def-ghijk" (consecutive hyphens in middle of valid-length string)', () => {
      assert.ok(!validateGcpProjectId("abc--def-ghijk"));
    });
  });
});

// ---------------------------------------------------------------------------
// checkAdcCredentials
// ---------------------------------------------------------------------------

describe("checkAdcCredentials", () => {
  // Save and restore GOOGLE_APPLICATION_CREDENTIALS for env var isolation
  let savedEnvCredPath: string | undefined;

  before(() => {
    savedEnvCredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  });

  after(() => {
    if (savedEnvCredPath !== undefined) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = savedEnvCredPath;
    } else {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
  });

  it("throws when neither GOOGLE_APPLICATION_CREDENTIALS is set nor default ADC path exists", () => {
    const missingPath = path.join(tmpDir, "does-not-exist.json");
    assert.throws(
      () => checkAdcCredentials(missingPath),
      (err: unknown) => err instanceof Error,
    );
  });

  it("does not throw when default ADC file exists (via adcPath param)", () => {
    const adcFile = writeTempFile(
      "adc-credentials.json",
      '{"type":"authorized_user"}',
    );
    assert.doesNotThrow(() => checkAdcCredentials(adcFile));
  });

  it("does not throw when GOOGLE_APPLICATION_CREDENTIALS points to an existing file (even if default ADC path is missing)", () => {
    const credFile = writeTempFile(
      "env-credentials.json",
      '{"type":"service_account"}',
    );
    const missingAdcPath = path.join(tmpDir, "missing-adc.json");
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credFile;
    try {
      assert.doesNotThrow(() => checkAdcCredentials(missingAdcPath));
    } finally {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
  });

  it("throws when GOOGLE_APPLICATION_CREDENTIALS points to non-existent file AND default ADC path is missing", () => {
    const missingEnvPath = path.join(tmpDir, "missing-env-cred.json");
    const missingAdcPath = path.join(tmpDir, "missing-adc-2.json");
    process.env.GOOGLE_APPLICATION_CREDENTIALS = missingEnvPath;
    try {
      assert.throws(
        () => checkAdcCredentials(missingAdcPath),
        (err: unknown) => err instanceof Error,
      );
    } finally {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
  });

  it("error message includes GOOGLE_APPLICATION_CREDENTIALS and gcloud auth application-default login", () => {
    const missingPath = path.join(tmpDir, "missing-for-message-test.json");
    let caughtError: Error | null = null;
    try {
      checkAdcCredentials(missingPath);
    } catch (err) {
      if (err instanceof Error) {
        caughtError = err;
      }
    }
    assert.ok(caughtError !== null, "Expected an error to be thrown");
    assert.ok(
      caughtError!.message.includes("GOOGLE_APPLICATION_CREDENTIALS"),
      "Error message must mention GOOGLE_APPLICATION_CREDENTIALS",
    );
    assert.ok(
      caughtError!.message.includes("gcloud auth application-default login"),
      "Error message must mention gcloud auth application-default login",
    );
  });
});
