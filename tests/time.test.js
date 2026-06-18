import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nowIso, addHours, compareIso } from "../src/lib/time.js";

describe("time utilities", () => {
  it("nowIso returns a valid ISO 8601 timestamp", () => {
    const ts = nowIso();
    assert.match(ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    const date = new Date(ts);
    assert.ok(!isNaN(date.getTime()));
  });

  it("addHours correctly adds hours to an ISO timestamp", () => {
    const base = "2026-06-18T12:00:00.000Z";
    const result = addHours(base, 4);
    assert.equal(result, "2026-06-18T16:00:00.000Z");
  });

  it("addHours handles negative hours", () => {
    const base = "2026-06-18T12:00:00.000Z";
    const result = addHours(base, -2);
    assert.equal(result, "2026-06-18T10:00:00.000Z");
  });

  it("compareIso returns negative when left is before right", () => {
    const result = compareIso("2026-06-18T10:00:00.000Z", "2026-06-18T12:00:00.000Z");
    assert.ok(result < 0);
  });

  it("compareIso returns positive when left is after right", () => {
    const result = compareIso("2026-06-18T14:00:00.000Z", "2026-06-18T12:00:00.000Z");
    assert.ok(result > 0);
  });

  it("compareIso returns 0 for equal timestamps", () => {
    const result = compareIso("2026-06-18T12:00:00.000Z", "2026-06-18T12:00:00.000Z");
    assert.equal(result, 0);
  });
});
