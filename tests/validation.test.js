import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertArray,
  assertEnum,
  assertIntegerRange,
  assertIsoTimestamp,
  assertString
} from "../src/lib/validation.js";

describe("validation utilities", () => {
  describe("assertString", () => {
    it("accepts non-empty strings", () => {
      assert.doesNotThrow(() => assertString("hello", "field"));
    });

    it("rejects empty strings", () => {
      assert.throws(() => assertString("", "field"), { code: "validation_error" });
    });

    it("rejects whitespace-only strings", () => {
      assert.throws(() => assertString("   ", "field"), { code: "validation_error" });
    });

    it("rejects non-string values", () => {
      assert.throws(() => assertString(123, "field"), { code: "validation_error" });
      assert.throws(() => assertString(null, "field"), { code: "validation_error" });
      assert.throws(() => assertString(undefined, "field"), { code: "validation_error" });
    });
  });

  describe("assertArray", () => {
    it("accepts arrays", () => {
      assert.doesNotThrow(() => assertArray([1, 2], "field"));
    });

    it("accepts empty arrays", () => {
      assert.doesNotThrow(() => assertArray([], "field"));
    });

    it("rejects non-array values", () => {
      assert.throws(() => assertArray("not-array", "field"), { code: "validation_error" });
      assert.throws(() => assertArray(123, "field"), { code: "validation_error" });
      assert.throws(() => assertArray(null, "field"), { code: "validation_error" });
    });
  });

  describe("assertEnum", () => {
    it("accepts values in the allowed set", () => {
      assert.doesNotThrow(() => assertEnum("a", "field", ["a", "b", "c"]));
    });

    it("rejects values not in the allowed set", () => {
      assert.throws(() => assertEnum("d", "field", ["a", "b", "c"]), { code: "validation_error" });
    });
  });

  describe("assertIntegerRange", () => {
    it("accepts integers within range", () => {
      assert.doesNotThrow(() => assertIntegerRange(5, "field", 0, 10));
    });

    it("accepts integers at boundaries", () => {
      assert.doesNotThrow(() => assertIntegerRange(0, "field", 0, 10));
      assert.doesNotThrow(() => assertIntegerRange(10, "field", 0, 10));
    });

    it("rejects integers below range", () => {
      assert.throws(() => assertIntegerRange(-1, "field", 0, 10), { code: "validation_error" });
    });

    it("rejects integers above range", () => {
      assert.throws(() => assertIntegerRange(11, "field", 0, 10), { code: "validation_error" });
    });

    it("rejects non-integers", () => {
      assert.throws(() => assertIntegerRange(5.5, "field", 0, 10), { code: "validation_error" });
    });
  });

  describe("assertIsoTimestamp", () => {
    it("accepts valid ISO 8601 timestamps", () => {
      assert.doesNotThrow(() => assertIsoTimestamp("2026-06-18T12:00:00.000Z", "field"));
    });

    it("rejects invalid timestamps", () => {
      assert.throws(() => assertIsoTimestamp("not-a-date", "field"), { code: "validation_error" });
    });

    it("rejects empty strings", () => {
      assert.throws(() => assertIsoTimestamp("", "field"), { code: "validation_error" });
    });
  });
});
