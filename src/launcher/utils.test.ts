import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { errorMessage, tryLoad } from "./utils.js";

describe("errorMessage", () => {
  it("returns the message property when given an Error instance", () => {
    assert.strictEqual(errorMessage(new Error("boom")), "boom");
  });

  it("returns the string itself when given a plain string", () => {
    assert.strictEqual(
      errorMessage("something went wrong"),
      "something went wrong",
    );
  });

  it("returns a string representation when given a number", () => {
    assert.strictEqual(errorMessage(42), "42");
  });

  it("returns 'null' when given null", () => {
    assert.strictEqual(errorMessage(null), "null");
  });

  it("returns 'undefined' when given undefined", () => {
    assert.strictEqual(errorMessage(undefined), "undefined");
  });
});

describe("tryLoad", () => {
  it("returns the value from the callback when it succeeds", () => {
    assert.deepStrictEqual(
      tryLoad(() => [1, 2, 3], "test"),
      [1, 2, 3],
    );
  });
});
